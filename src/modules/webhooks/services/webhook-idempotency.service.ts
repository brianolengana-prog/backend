/**
 * Webhook Idempotency Service
 * Ensures webhook events are processed exactly once
 * 
 * @module Webhooks
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { CreateWebhookEventDto } from '../dto/webhook-event.dto';
import Stripe from 'stripe';

export interface ProcessWebhookOptions {
  event: Stripe.Event;
  ipAddress?: string;
  userAgent?: string;
  processor: (event: Stripe.Event) => Promise<void>;
}

export interface ProcessWebhookResult {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  idempotencyKey: string;
  processingTimeMs: number;
  error?: string;
}

export class WebhookIdempotencyService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly webhookEventRepository: WebhookEventRepository
  ) {}

  /**
   * Generate idempotency key from Stripe event
   */
  generateIdempotencyKey(event: Stripe.Event): string {
    return `${event.id}_${event.type}`;
  }

  /**
   * Process webhook with idempotency protection
   * Uses database transactions to ensure atomicity
   */
  async processWebhook(
    options: ProcessWebhookOptions
  ): Promise<ProcessWebhookResult> {
    const { event, ipAddress, userAgent, processor } = options;
    const startTime = Date.now();
    const idempotencyKey = this.generateIdempotencyKey(event);

    try {
      // Use transaction to ensure atomicity
      return await this.prisma.$transaction(
        async (tx) => {
          // Check for existing event with SELECT FOR UPDATE (row-level locking)
          const existingEvent = await this.webhookEventRepository.findByIdempotencyKey(
            idempotencyKey,
            tx
          );

          // If event already processed successfully, return early
          if (existingEvent?.isDuplicate()) {
            const processingTimeMs = Date.now() - startTime;
            return {
              success: true,
              duplicate: true,
              eventId: event.id,
              idempotencyKey,
              processingTimeMs,
            };
          }

          // If event exists but failed, check if we can retry
          if (existingEvent && !existingEvent.canRetry()) {
            if (existingEvent.isDeadLetter()) {
              const processingTimeMs = Date.now() - startTime;
              return {
                success: false,
                duplicate: false,
                eventId: event.id,
                idempotencyKey,
                processingTimeMs,
                error: `Event in dead letter queue: ${existingEvent.errorMessage}`,
              };
            }
          }

          // Create or update event record
          let webhookEvent: WebhookEvent;
          
          if (existingEvent) {
            // Event exists but failed - retry
            await this.webhookEventRepository.incrementRetry(
              existingEvent.id,
              tx
            );
            await this.webhookEventRepository.markAsProcessing(
              existingEvent.id,
              tx
            );
            webhookEvent = await this.webhookEventRepository.findById(
              existingEvent.id,
              tx
            ) as WebhookEvent;
          } else {
            // New event - create record
            const createDto: CreateWebhookEventDto = {
              idempotencyKey,
              eventId: event.id,
              eventType: event.type,
              rawPayload: event as unknown as Record<string, unknown>,
              metadata: this.extractMetadata(event),
              ipAddress,
              userAgent,
            };

            webhookEvent = await this.webhookEventRepository.create(createDto, tx);
            await this.webhookEventRepository.markAsProcessing(
              webhookEvent.id,
              tx
            );
          }

          // Process the webhook event
          try {
            await processor(event);

            // Mark as completed
            const processingTimeMs = Date.now() - startTime;
            await this.webhookEventRepository.markAsCompleted(
              webhookEvent.id,
              processingTimeMs,
              tx
            );

            return {
              success: true,
              duplicate: false,
              eventId: event.id,
              idempotencyKey,
              processingTimeMs,
            };
          } catch (error) {
            // Mark as failed (retry logic will be handled by caller)
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            await this.webhookEventRepository.markAsFailed(
              webhookEvent.id,
              errorMessage,
              tx
            );

            const processingTimeMs = Date.now() - startTime;
            
            // Re-throw error so caller can handle retry logic
            throw error;
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000, // 30 seconds
        }
      );
    } catch (error) {
      // Transaction failed - log and return error
      const errorMessage =
        error instanceof Error ? error.message : 'Transaction failed';
      const processingTimeMs = Date.now() - startTime;

      console.error('❌ Webhook processing transaction failed:', {
        eventId: event.id,
        idempotencyKey,
        error: errorMessage,
      });

      return {
        success: false,
        duplicate: false,
        eventId: event.id,
        idempotencyKey,
        processingTimeMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract metadata from Stripe event
   */
  private extractMetadata(event: Stripe.Event): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      apiVersion: event.api_version,
      created: event.created,
    };

    // Extract customer/subscription/invoice IDs from event data
    const obj = event.data.object as Record<string, unknown>;
    
    if (obj.customer) {
      metadata.customerId = obj.customer;
    }
    
    if (obj.id && typeof obj.id === 'string') {
      if (obj.id.startsWith('sub_')) {
        metadata.subscriptionId = obj.id;
      } else if (obj.id.startsWith('in_')) {
        metadata.invoiceId = obj.id;
      } else if (obj.id.startsWith('pi_')) {
        metadata.paymentIntentId = obj.id;
      }
    }

    // Extract user ID from metadata if present
    if (obj.metadata && typeof obj.metadata === 'object') {
      const eventMetadata = obj.metadata as Record<string, unknown>;
      if (eventMetadata.userId) {
        metadata.userId = eventMetadata.userId;
      }
    }

    return metadata;
  }

  /**
   * Check if event was already processed
   */
  async isProcessed(event: Stripe.Event): Promise<boolean> {
    const idempotencyKey = this.generateIdempotencyKey(event);
    const existingEvent = await this.webhookEventRepository.findByIdempotencyKey(
      idempotencyKey
    );
    return existingEvent?.isDuplicate() ?? false;
  }

  /**
   * Get processing status of an event
   */
  async getEventStatus(eventId: string): Promise<WebhookEvent | null> {
    return this.webhookEventRepository.findByEventId(eventId);
  }
}

