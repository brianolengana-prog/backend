/**
 * Webhook Retry Service
 * Handles retry logic with exponential backoff for failed webhooks
 * 
 * @module Webhooks
 */

import { PrismaClient } from '@prisma/client';
import Queue from 'bull';
import Stripe from 'stripe';
import { WebhookErrorClassifierService, ErrorCategory } from './webhook-error-classifier.service';
import { WebhookEventRepository } from '../repositories/webhook-event.repository';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  multiplier: number;
}

export interface RetryJobData {
  webhookEventId: string;
  eventId: string;
  eventType: string;
  rawPayload: Record<string, unknown>;
  attemptNumber: number;
  lastError?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class WebhookRetryService {
  private retryQueue: Queue;
  private errorClassifier: WebhookErrorClassifierService;
  private webhookEventRepository: WebhookEventRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisConfig: {
      host: string;
      port: number;
      password?: string;
    }
  ) {
    this.errorClassifier = new WebhookErrorClassifierService();
    this.webhookEventRepository = new WebhookEventRepository(prisma);

    // Initialize retry queue
    this.retryQueue = new Queue('webhook-retry', {
      redis: this.redisConfig,
      defaultJobOptions: {
        attempts: 10, // Max attempts per job
        backoff: {
          type: 'exponential',
          delay: 2000, // Base delay in ms
        },
        removeOnComplete: 100,
        removeOnFail: false, // Keep failed jobs for DLQ
      },
    });
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(
    attemptNumber: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number = 2
  ): number {
    const delay = baseDelay * Math.pow(multiplier, attemptNumber - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Schedule webhook retry with exponential backoff
   */
  async scheduleRetry(
    webhookEventId: string,
    event: Stripe.Event,
    attemptNumber: number,
    error: Error,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Classify error
    const classified = this.errorClassifier.classifyError(error);

    // Don't retry if error is non-retryable
    if (!classified.retryable) {
      console.log('❌ Error is non-retryable, sending to DLQ:', {
        webhookEventId,
        error: error.message,
        category: classified.category,
      });
      // Will be handled by webhook processor
      return;
    }

    // Get retry config
    const retryConfig = this.errorClassifier.getRetryConfig(error);
    const delay = this.calculateBackoffDelay(
      attemptNumber,
      retryConfig.baseDelay,
      300000, // Max 5 minutes
      2 // Exponential multiplier
    );

    // Create retry job data
    const jobData: RetryJobData = {
      webhookEventId,
      eventId: event.id,
      eventType: event.type,
      rawPayload: event as unknown as Record<string, unknown>,
      attemptNumber,
      lastError: error.message,
      ipAddress,
      userAgent,
    };

    // Add job to retry queue with calculated delay
    await this.retryQueue.add(
      'retry-webhook',
      jobData,
      {
        delay,
        attempts: retryConfig.maxRetries,
        backoff: {
          type: 'exponential',
          delay: retryConfig.baseDelay,
        },
        jobId: `webhook-retry-${webhookEventId}-${attemptNumber}`,
      }
    );

    console.log('🔄 Scheduled webhook retry:', {
      webhookEventId,
      eventId: event.id,
      attemptNumber,
      delay: `${delay}ms`,
      maxRetries: retryConfig.maxRetries,
    });
  }

  /**
   * Process retry job
   */
  async processRetry(jobData: RetryJobData, processor: (event: Stripe.Event) => Promise<void>): Promise<void> {
    const { webhookEventId, rawPayload, attemptNumber } = jobData;

    try {
      // Reconstruct Stripe event from payload
      const event = rawPayload as unknown as Stripe.Event;

      // Update webhook event status to RETRYING
      await this.webhookEventRepository.update(
        webhookEventId,
        {
          status: 'RETRYING' as any,
          retryCount: attemptNumber,
        }
      );

      // Process the webhook
      await processor(event);

      // Mark as completed
      await this.webhookEventRepository.update(
        webhookEventId,
        {
          status: 'COMPLETED' as any,
          processed: true,
          processedAt: new Date(),
        }
      );

      console.log('✅ Webhook retry succeeded:', {
        webhookEventId,
        attemptNumber,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update webhook event with error
      await this.webhookEventRepository.update(
        webhookEventId,
        {
          status: 'FAILED' as any,
          errorMessage: errorMessage,
          retryCount: attemptNumber,
        }
      );

      // Check if we should retry again
      const classified = this.errorClassifier.classifyError(error);
      const retryConfig = this.errorClassifier.getRetryConfig(error);

      if (classified.retryable && attemptNumber < retryConfig.maxRetries) {
        // Schedule another retry
        const event = rawPayload as unknown as Stripe.Event;
        await this.scheduleRetry(
          webhookEventId,
          event,
          attemptNumber + 1,
          error as Error,
          jobData.ipAddress,
          jobData.userAgent
        );
      } else {
        // Max retries reached or non-retryable - send to DLQ
        console.error('❌ Max retries reached, sending to DLQ:', {
          webhookEventId,
          attemptNumber,
          error: errorMessage,
        });
        // DLQ handling will be done by the processor
        throw error;
      }
    }
  }

  /**
   * Get retry queue
   */
  getQueue(): Queue {
    return this.retryQueue;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.retryQueue.getWaitingCount(),
      this.retryQueue.getActiveCount(),
      this.retryQueue.getCompletedCount(),
      this.retryQueue.getFailedCount(),
      this.retryQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }
}

