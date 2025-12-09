/**
 * Subscription Event Emitter Service
 * Emits events for subscription state changes (NestJS-style)
 * 
 * @module Subscriptions
 */

import { PrismaClient } from '@prisma/client';
import {
  SubscriptionStateChangedEvent,
  SubscriptionActivatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionPaymentFailedEvent,
  SubscriptionPastDueEvent,
  SubscriptionEventType,
} from '../events/subscription-state.events';
import { SubscriptionState } from '@prisma/client';

/**
 * Event handler interface
 * In NestJS, this would be implemented by event listeners
 */
export interface SubscriptionEventHandler {
  handle(event: SubscriptionStateChangedEvent): Promise<void> | void;
}

export class SubscriptionEventEmitterService {
  private handlers: Map<SubscriptionEventType, SubscriptionEventHandler[]> = new Map();

  constructor(private readonly prisma: PrismaClient) {
    // Initialize event handler maps
    Object.values(SubscriptionEventType).forEach((eventType) => {
      this.handlers.set(eventType, []);
    });
  }

  /**
   * Register event handler
   * In NestJS, this would be done via decorators: @OnEvent('subscription.state.changed')
   */
  on(eventType: SubscriptionEventType, handler: SubscriptionEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Emit state changed event
   */
  async emitStateChanged(event: SubscriptionStateChangedEvent): Promise<void> {
    const handlers = this.handlers.get(SubscriptionEventType.STATE_CHANGED) || [];

    // Execute all handlers
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event);
        } catch (error) {
          console.error('❌ Event handler error:', error);
        }
      })
    );

    // Log event (in production, you might also publish to message queue)
    console.log('📢 [EVENT_EMITTED]', {
      type: SubscriptionEventType.STATE_CHANGED,
      subscriptionId: event.subscriptionId,
      fromState: event.fromState,
      toState: event.toState,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Emit subscription activated event
   */
  async emitActivated(event: SubscriptionActivatedEvent): Promise<void> {
    const handlers = this.handlers.get(SubscriptionEventType.ACTIVATED) || [];

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event as any);
        } catch (error) {
          console.error('❌ Event handler error:', error);
        }
      })
    );

    console.log('📢 [EVENT_EMITTED]', {
      type: SubscriptionEventType.ACTIVATED,
      subscriptionId: event.subscriptionId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Emit subscription canceled event
   */
  async emitCanceled(event: SubscriptionCanceledEvent): Promise<void> {
    const handlers = this.handlers.get(SubscriptionEventType.CANCELED) || [];

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event as any);
        } catch (error) {
          console.error('❌ Event handler error:', error);
        }
      })
    );

    console.log('📢 [EVENT_EMITTED]', {
      type: SubscriptionEventType.CANCELED,
      subscriptionId: event.subscriptionId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Emit payment failed event
   */
  async emitPaymentFailed(event: SubscriptionPaymentFailedEvent): Promise<void> {
    const handlers = this.handlers.get(SubscriptionEventType.PAYMENT_FAILED) || [];

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event as any);
        } catch (error) {
          console.error('❌ Event handler error:', error);
        }
      })
    );

    console.log('📢 [EVENT_EMITTED]', {
      type: SubscriptionEventType.PAYMENT_FAILED,
      subscriptionId: event.subscriptionId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Emit past due event
   */
  async emitPastDue(event: SubscriptionPastDueEvent): Promise<void> {
    const handlers = this.handlers.get(SubscriptionEventType.PAST_DUE) || [];

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler.handle(event as any);
        } catch (error) {
          console.error('❌ Event handler error:', error);
        }
      })
    );

    console.log('📢 [EVENT_EMITTED]', {
      type: SubscriptionEventType.PAST_DUE,
      subscriptionId: event.subscriptionId,
      timestamp: event.timestamp.toISOString(),
    });
  }

  /**
   * Helper: Create state changed event from transition
   */
  async createStateChangedEvent(
    subscriptionId: string,
    fromState: SubscriptionState,
    toState: SubscriptionState,
    trigger: 'webhook' | 'user_action' | 'system' | 'admin',
    triggerId?: string,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<SubscriptionStateChangedEvent> {
    // Get subscription to get userId
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { userId: true },
    });

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    return {
      subscriptionId,
      userId: subscription.userId,
      fromState,
      toState,
      trigger,
      triggerId,
      reason,
      metadata,
      timestamp: new Date(),
    };
  }
}

