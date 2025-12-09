/**
 * Webhook Processor Service
 * Main service for processing Stripe webhook events with state machine integration
 * 
 * @module Webhooks
 */

import { PrismaClient, SubscriptionState } from '@prisma/client';
import Stripe from 'stripe';
import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { WebhookAuditService } from './webhook-audit.service';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';
import { SubscriptionStateMachineService } from '../../subscriptions/services/subscription-state-machine.service';

export interface ProcessWebhookRequest {
  event: Stripe.Event;
  ipAddress?: string;
  userAgent?: string;
}

export interface ProcessWebhookResponse {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  processingTimeMs: number;
  error?: string;
}

export class WebhookProcessorService {
  private readonly idempotencyService: WebhookIdempotencyService;
  private readonly auditService: WebhookAuditService;
  private readonly stateMachine: SubscriptionStateMachineService;
  private readonly retryService: WebhookRetryService;
  private readonly dlqService: DeadLetterQueueService;
  private readonly errorClassifier: WebhookErrorClassifierService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly stripeService: any, // Your existing StripeService
    redisConfig?: {
      host: string;
      port: number;
      password?: string;
    }
  ) {
    const webhookEventRepository = new WebhookEventRepository(prisma);
    this.idempotencyService = new WebhookIdempotencyService(
      prisma,
      webhookEventRepository
    );
    this.auditService = new WebhookAuditService(prisma);
    this.stateMachine = new SubscriptionStateMachineService(prisma);
    this.errorClassifier = new WebhookErrorClassifierService();
    this.dlqService = new DeadLetterQueueService(prisma);

    // Initialize retry service if Redis config provided
    if (redisConfig) {
      this.retryService = new WebhookRetryService(prisma, redisConfig);
    }
  }

  /**
   * Process Stripe webhook event with full idempotency, audit logging, and state machine
   */
  async processWebhook(
    request: ProcessWebhookRequest
  ): Promise<ProcessWebhookResponse> {
    const { event, ipAddress, userAgent } = request;

    // Validate event age (prevent replay attacks on old events)
    const eventAge = Date.now() / 1000 - event.created;
    const MAX_EVENT_AGE_SECONDS = 300; // 5 minutes

    if (eventAge > MAX_EVENT_AGE_SECONDS) {
      await this.auditService.logValidationFailure(
        event.id,
        `Event too old: ${eventAge}s (max: ${MAX_EVENT_AGE_SECONDS}s)`,
        ipAddress
      );
      return {
        success: false,
        duplicate: false,
        eventId: event.id,
        processingTimeMs: 0,
        error: `Event too old: ${eventAge}s`,
      };
    }

    // Process with idempotency protection
    let result;
    let webhookEventId: string | null = null;

    try {
      result = await this.idempotencyService.processWebhook({
        event,
        ipAddress,
        userAgent,
        processor: async (e) => {
          // Process webhook with state machine integration
          await this.processWebhookEvent(e, ipAddress, userAgent);
        },
      });

      // Get webhook event ID for retry logic
      const webhookEvent = await this.idempotencyService.getEventStatus(event.id);
      webhookEventId = webhookEvent?.id || null;
    } catch (error) {
      // Error occurred during processing - handle retry logic
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const classified = this.errorClassifier.classifyError(error);

      // Get webhook event ID
      const webhookEvent = await this.idempotencyService.getEventStatus(event.id);
      webhookEventId = webhookEvent?.id || null;

      // If retryable and retry service available, schedule retry
      if (classified.retryable && this.retryService && webhookEventId) {
        try {
          await this.retryService.scheduleRetry(
            webhookEventId,
            event,
            1, // First retry attempt
            error as Error,
            ipAddress,
            userAgent
          );

          // Return success with retry scheduled
          return {
            success: true,
            duplicate: false,
            eventId: event.id,
            processingTimeMs: 0,
            error: `Processing failed, retry scheduled: ${errorMessage}`,
          };
        } catch (retryError) {
          console.error('❌ Failed to schedule retry:', retryError);
        }
      }

      // If non-retryable or retry scheduling failed, send to DLQ
      if (!classified.retryable && webhookEventId) {
        await this.dlqService.addToDLQ({
          webhookEventId,
          eventId: event.id,
          eventType: event.type,
          errorCategory: classified.category,
          errorMessage,
          finalAttempt: 1,
          rawPayload: event as unknown as Record<string, unknown>,
          metadata: {
            reason: 'Non-retryable error on first attempt',
          },
          ipAddress,
          userAgent,
        });
      }

      // Return failure
      return {
        success: false,
        duplicate: false,
        eventId: event.id,
        processingTimeMs: 0,
        error: errorMessage,
      };
    }

    // Audit log the processing
    await this.auditService.logWebhookProcessing(
      event,
      {
        success: result.success,
        duplicate: result.duplicate,
        processingTimeMs: result.processingTimeMs,
        error: result.error,
      },
      ipAddress,
      userAgent
    );

    return {
      success: result.success,
      duplicate: result.duplicate,
      eventId: result.eventId,
      processingTimeMs: result.processingTimeMs,
      error: result.error,
    };
  }

  /**
   * Process webhook event with state machine integration
   */
  private async processWebhookEvent(
    event: Stripe.Event,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event, ipAddress, userAgent);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event, ipAddress, userAgent);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event);
        break;
      default:
        // Delegate to existing Stripe service for other events
        await this.stripeService.handleWebhook(event);
    }
  }

  /**
   * Handle subscription created/updated with state machine
   */
  private async handleSubscriptionUpdated(
    event: Stripe.Event,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Get or create subscription record
    const subscriptionRecord = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    // Map Stripe status to our state enum
    const targetState = this.stateMachine.mapStripeStatusToState(subscription.status);

    if (subscriptionRecord) {
      // Update existing subscription with state machine validation
      const transitionResult = await this.stateMachine.transition(
        subscriptionRecord.id,
        targetState,
        {
          trigger: 'webhook',
          triggerId: event.id,
          reason: `Stripe webhook: ${event.type}`,
          metadata: {
            stripeSubscriptionId: subscription.id,
            stripeStatus: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          },
          ipAddress,
          userAgent,
        }
      );

      if (!transitionResult.success) {
        console.error('❌ State transition failed:', transitionResult.error);
        throw new Error(`State transition failed: ${transitionResult.error}`);
      }

      // Update other subscription fields
      await this.prisma.subscription.update({
        where: { id: subscriptionRecord.id },
        data: {
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    } else {
      // Create new subscription (first time)
      // Get user ID from metadata or customer lookup
      const userId = subscription.metadata?.userId;
      if (!userId) {
        // Try to get from customer email
        const customer = await this.stripeService.stripe.customers.retrieve(
          subscription.customer as string
        );
        // You'll need to implement user lookup by email
        throw new Error('User ID not found in subscription metadata');
      }

      // Create subscription with initial state
      const newSubscription = await this.prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          status: targetState,
          priceId: subscription.items.data[0].price.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });

      // Record initial state transition
      await this.stateMachine.transition(
        newSubscription.id,
        targetState,
        {
          trigger: 'webhook',
          triggerId: event.id,
          reason: `Initial subscription creation: ${event.type}`,
          metadata: {
            stripeSubscriptionId: subscription.id,
            stripeStatus: subscription.status,
          },
          ipAddress,
          userAgent,
        }
      );
    }
  }

  /**
   * Handle subscription deleted with state machine
   */
  private async handleSubscriptionDeleted(
    event: Stripe.Event,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    
    const subscriptionRecord = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (subscriptionRecord) {
      // Transition to CANCELED state
      await this.stateMachine.transition(
        subscriptionRecord.id,
        this.stateMachine.mapStripeStatusToState('canceled'),
        {
          trigger: 'webhook',
          triggerId: event.id,
          reason: 'Subscription deleted via Stripe webhook',
          metadata: {
            stripeSubscriptionId: subscription.id,
          },
          ipAddress,
          userAgent,
        }
      );
    }
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (invoice.subscription) {
      const subscriptionRecord = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscriptionRecord && subscriptionRecord.status !== SubscriptionState.ACTIVE) {
        // Transition to ACTIVE if payment succeeded
        await this.stateMachine.transition(
          subscriptionRecord.id,
          SubscriptionState.ACTIVE,
          {
            trigger: 'webhook',
            triggerId: event.id,
            reason: 'Payment succeeded',
            metadata: {
              invoiceId: invoice.id,
              amountPaid: invoice.amount_paid,
            },
          }
        );
      }
    }

    // Delegate to existing service for other processing
    await this.stripeService.handleWebhook(event);
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (invoice.subscription) {
      const subscriptionRecord = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: invoice.subscription as string },
      });

      if (subscriptionRecord) {
        // Transition to PAST_DUE
        await this.stateMachine.transition(
          subscriptionRecord.id,
          SubscriptionState.PAST_DUE,
          {
            trigger: 'webhook',
            triggerId: event.id,
            reason: 'Payment failed',
            metadata: {
              invoiceId: invoice.id,
              amountDue: invoice.amount_due,
              attemptCount: invoice.attempt_count,
            },
          }
        );
      }
    }

    // Delegate to existing service for other processing
    await this.stripeService.handleWebhook(event);
  }

  /**
   * Verify Stripe webhook signature
   */
  async verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Promise<Stripe.Event> {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });

    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Signature verification failed';
      await this.auditService.logSignatureFailure(errorMessage);
      throw error;
    }
  }

  /**
   * Get event processing status
   */
  async getEventStatus(eventId: string) {
    return this.idempotencyService.getEventStatus(eventId);
  }
}
