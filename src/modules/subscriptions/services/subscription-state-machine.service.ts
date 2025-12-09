/**
 * Subscription State Machine Service
 * Enterprise-grade state machine with validation, audit, and event emission
 * 
 * @module Subscriptions
 */

import { PrismaClient, SubscriptionState, Prisma } from '@prisma/client';
import { SUBSCRIPTION_STATES } from '../entities/subscription-state.entity';
import { SubscriptionStateTransitionRepository } from '../repositories/subscription-state-transition.repository';
import { SubscriptionEventEmitterService } from './subscription-event-emitter.service';

export type StateTransitionTrigger = 'webhook' | 'user_action' | 'system' | 'admin';

export interface StateTransitionContext {
  trigger: StateTransitionTrigger;
  triggerId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface StateTransitionResult {
  success: boolean;
  fromState: SubscriptionState;
  toState: SubscriptionState;
  transitionId?: string;
  error?: string;
}

/**
 * State transition rules
 * Defines valid transitions from each state
 */
const STATE_TRANSITIONS: Record<SubscriptionState, SubscriptionState[]> = {
  [SubscriptionState.INCOMPLETE]: [
    SubscriptionState.INCOMPLETE_EXPIRED,
    SubscriptionState.TRIALING,
    SubscriptionState.ACTIVE,
  ],
  [SubscriptionState.INCOMPLETE_EXPIRED]: [
    // Terminal state - no transitions
  ],
  [SubscriptionState.TRIALING]: [
    SubscriptionState.ACTIVE,
    SubscriptionState.PAST_DUE,
    SubscriptionState.CANCELED,
  ],
  [SubscriptionState.ACTIVE]: [
    SubscriptionState.PAST_DUE,
    SubscriptionState.CANCELED,
    SubscriptionState.PENDING_CANCELLATION,
    SubscriptionState.UNPAID,
  ],
  [SubscriptionState.PAST_DUE]: [
    SubscriptionState.ACTIVE,
    SubscriptionState.CANCELED,
    SubscriptionState.UNPAID,
  ],
  [SubscriptionState.CANCELED]: [
    // Terminal state - no transitions (except reactivation via new subscription)
  ],
  [SubscriptionState.UNPAID]: [
    SubscriptionState.ACTIVE,
    SubscriptionState.CANCELED,
  ],
  [SubscriptionState.PENDING_CANCELLATION]: [
    SubscriptionState.CANCELED,
    SubscriptionState.ACTIVE, // If user reactivates before period end
  ],
};

export class SubscriptionStateMachineService {
  private transitionRepository: SubscriptionStateTransitionRepository;
  private eventEmitter: SubscriptionEventEmitterService;

  constructor(private readonly prisma: PrismaClient) {
    this.transitionRepository = new SubscriptionStateTransitionRepository(prisma);
    this.eventEmitter = new SubscriptionEventEmitterService(prisma);
  }

  /**
   * Check if a state transition is valid
   */
  canTransition(
    fromState: SubscriptionState,
    toState: SubscriptionState
  ): boolean {
    // Same state is always valid (idempotent)
    if (fromState === toState) {
      return true;
    }

    // Check if transition is allowed
    const allowedTransitions = STATE_TRANSITIONS[fromState] || [];
    return allowedTransitions.includes(toState);
  }

  /**
   * Get all valid transitions from a state
   */
  getValidTransitions(fromState: SubscriptionState): SubscriptionState[] {
    return STATE_TRANSITIONS[fromState] || [];
  }

  /**
   * Transition subscription to new state with validation and audit
   */
  async transition(
    subscriptionId: string,
    toState: SubscriptionState,
    context: StateTransitionContext,
    tx?: Prisma.TransactionClient
  ): Promise<StateTransitionResult> {
    const client = tx || this.prisma;

    try {
      return await client.$transaction(
        async (transactionClient) => {
          // Get current subscription state
          const subscription = await transactionClient.subscription.findUnique({
            where: { id: subscriptionId },
            select: { id: true, status: true },
          });

          if (!subscription) {
            return {
              success: false,
              fromState: toState, // Fallback
              toState,
              error: `Subscription ${subscriptionId} not found`,
            };
          }

          const fromState = subscription.status;

          // Validate transition
          if (!this.canTransition(fromState, toState)) {
            return {
              success: false,
              fromState,
              toState,
              error: `Invalid transition from ${fromState} to ${toState}. Valid transitions: ${this.getValidTransitions(fromState).join(', ')}`,
            };
          }

          // If already in target state, return success (idempotent)
          if (fromState === toState) {
            return {
              success: true,
              fromState,
              toState,
            };
          }

          // Update subscription state
          await transactionClient.subscription.update({
            where: { id: subscriptionId },
            data: { status: toState },
          });

          // Record state transition in audit table
          const transition = await this.transitionRepository.create(
            {
              subscriptionId,
              fromState,
              toState,
              trigger: context.trigger,
              triggerId: context.triggerId,
              reason: context.reason,
              metadata: context.metadata,
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            },
            transactionClient
          );

          // Emit state change event (for event-driven architecture)
          // This allows other services to react to state changes
          const stateChangedEvent = await this.eventEmitter.createStateChangedEvent(
            subscriptionId,
            fromState,
            toState,
            context.trigger,
            context.triggerId,
            context.reason,
            context.metadata
          );
          
          await this.eventEmitter.emitStateChanged(stateChangedEvent);

          // Emit specific events based on state transition
          await this.emitSpecificEvents(
            subscriptionId,
            fromState,
            toState,
            stateChangedEvent
          );

          return {
            success: true,
            fromState,
            toState,
            transitionId: transition.id,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ State transition failed:', {
        subscriptionId,
        error: errorMessage,
        context,
      });

      return {
        success: false,
        fromState: SubscriptionState.INCOMPLETE, // Fallback
        toState,
        error: errorMessage,
      };
    }
  }

  /**
   * Map Stripe subscription status to our state enum
   */
  mapStripeStatusToState(stripeStatus: string): SubscriptionState {
    const statusMap: Record<string, SubscriptionState> = {
      incomplete: SubscriptionState.INCOMPLETE,
      incomplete_expired: SubscriptionState.INCOMPLETE_EXPIRED,
      trialing: SubscriptionState.TRIALING,
      active: SubscriptionState.ACTIVE,
      past_due: SubscriptionState.PAST_DUE,
      canceled: SubscriptionState.CANCELED,
      unpaid: SubscriptionState.UNPAID,
    };

    const normalizedStatus = stripeStatus.toLowerCase();
    return statusMap[normalizedStatus] || SubscriptionState.INCOMPLETE;
  }

  /**
   * Get state entity with business logic
   */
  getStateEntity(state: SubscriptionState) {
    return SUBSCRIPTION_STATES[state];
  }

  /**
   * Emit specific events based on state transition
   */
  private async emitSpecificEvents(
    subscriptionId: string,
    fromState: SubscriptionState,
    toState: SubscriptionState,
    stateChangedEvent: any
  ): Promise<void> {
    // Emit activation event
    if (toState === SubscriptionState.ACTIVE && fromState !== SubscriptionState.ACTIVE) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true, priceId: true },
      });

      if (subscription) {
        await this.eventEmitter.emitActivated({
          subscriptionId,
          userId: subscription.userId,
          planId: subscription.priceId,
          timestamp: new Date(),
        });
      }
    }

    // Emit cancellation event
    if (toState === SubscriptionState.CANCELED) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true, cancelAtPeriodEnd: true },
      });

      if (subscription) {
        await this.eventEmitter.emitCanceled({
          subscriptionId,
          userId: subscription.userId,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          reason: stateChangedEvent.reason,
          timestamp: new Date(),
        });
      }
    }

    // Emit past due event
    if (toState === SubscriptionState.PAST_DUE) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { userId: true },
      });

      if (subscription) {
        await this.eventEmitter.emitPastDue({
          subscriptionId,
          userId: subscription.userId,
          daysPastDue: 0, // Calculate based on current period end
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Get transition history for a subscription
   */
  async getTransitionHistory(
    subscriptionId: string,
    limit = 50
  ): Promise<Array<{
    id: string;
    fromState: SubscriptionState;
    toState: SubscriptionState;
    trigger: string;
    reason?: string;
    createdAt: Date;
  }>> {
    return this.transitionRepository.findBySubscriptionId(subscriptionId, limit);
  }

  /**
   * Validate subscription can perform action based on state
   */
  canPerformAction(
    state: SubscriptionState,
    action: 'upload' | 'export' | 'upgrade' | 'cancel'
  ): boolean {
    const stateEntity = this.getStateEntity(state);

    switch (action) {
      case 'upload':
      case 'export':
        return stateEntity.allowsUsage();
      case 'upgrade':
        return stateEntity.isSubscriptionActive();
      case 'cancel':
        return stateEntity.isSubscriptionActive() && !stateEntity.isTerminal;
      default:
        return false;
    }
  }
}

