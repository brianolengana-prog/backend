/**
 * Webhook Event Entity
 * Represents a Stripe webhook event with idempotency protection
 * 
 * @module Webhooks
 */

import { WebhookEventStatus } from '@prisma/client';

export interface WebhookEventMetadata {
  customerId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  userId?: string;
  [key: string]: unknown;
}

export class WebhookEvent {
  id: string;
  idempotencyKey: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  processedAt?: Date;
  processingTimeMs?: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  status: WebhookEventStatus;
  rawPayload?: Record<string, unknown>;
  metadata?: WebhookEventMetadata;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<WebhookEvent>) {
    Object.assign(this, partial);
  }

  /**
   * Check if event can be retried
   */
  canRetry(): boolean {
    return (
      this.status === WebhookEventStatus.FAILED &&
      this.retryCount < this.maxRetries
    );
  }

  /**
   * Check if event is a duplicate
   */
  isDuplicate(): boolean {
    return this.processed && this.status === WebhookEventStatus.COMPLETED;
  }

  /**
   * Check if event is in dead letter queue
   */
  isDeadLetter(): boolean {
    return this.status === WebhookEventStatus.DEAD_LETTER;
  }
}

