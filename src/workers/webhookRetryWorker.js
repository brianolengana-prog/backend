/**
 * Webhook Retry Worker
 * Background worker for processing webhook retries with exponential backoff
 * 
 * Uses Bull queue for distributed processing
 */

const Queue = require('bull');
const { PrismaClient } = require('@prisma/client');
const { WebhookRetryService } = require('../modules/webhooks/services/webhook-retry.service');
const { WebhookProcessorService } = require('../modules/webhooks/services/webhook-processor.service');
const stripeService = require('../services/stripe.service');
const env = require('../config/env');

class WebhookRetryWorker {
  constructor() {
    this.prisma = new PrismaClient();
    this.retryService = null;
    this.processor = null;
    this.queue = null;
    this.isRunning = false;
  }

  /**
   * Initialize worker
   */
  async initialize() {
    // Initialize retry service
    this.retryService = new WebhookRetryService(this.prisma, {
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
    });

    // Initialize webhook processor
    this.processor = new WebhookProcessorService(this.prisma, stripeService);

    // Get retry queue
    this.queue = this.retryService.getQueue();

    // Set up queue event handlers
    this.setupQueueHandlers();

    console.log('✅ Webhook Retry Worker initialized');
  }

  /**
   * Set up queue event handlers
   */
  setupQueueHandlers() {
    // Process retry jobs
    this.queue.process('retry-webhook', 5, async (job) => {
      const { webhookEventId, rawPayload, attemptNumber, ipAddress, userAgent } = job.data;

      console.log('🔄 Processing webhook retry:', {
        jobId: job.id,
        webhookEventId,
        attemptNumber,
      });

      try {
        // Process the retry
        await this.retryService.processRetry(
          job.data,
          async (event) => {
            // Delegate to webhook processor
            await this.processor.processWebhook({
              event,
              ipAddress,
              userAgent,
            });
          }
        );

        console.log('✅ Webhook retry succeeded:', {
          jobId: job.id,
          webhookEventId,
          attemptNumber,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error('❌ Webhook retry failed:', {
          jobId: job.id,
          webhookEventId,
          attemptNumber,
          error: errorMessage,
        });

        // Job will be retried by Bull if attempts remain
        // If max attempts reached, it will be moved to failed queue
        throw error;
      }
    });

    // Queue event handlers
    this.queue.on('completed', (job) => {
      console.log('✅ Retry job completed:', job.id);
    });

    this.queue.on('failed', async (job, error) => {
      console.error('❌ Retry job failed:', {
        jobId: job.id,
        error: error.message,
      });

      // Job has exhausted all retries - should be in DLQ already
      // But we'll double-check and ensure it's there
      if (job.data?.webhookEventId) {
        const { DeadLetterQueueService } = require('../modules/webhooks/services/dead-letter-queue.service');
        const dlqService = new DeadLetterQueueService(this.prisma);
        
        // Check if already in DLQ
        const existing = await this.prisma.deadLetterQueue.findUnique({
          where: { webhookEventId: job.data.webhookEventId },
        });

        if (!existing) {
          // Add to DLQ
          await dlqService.addToDLQ({
            webhookEventId: job.data.webhookEventId,
            eventId: job.data.eventId,
            eventType: job.data.eventType,
            errorCategory: 'retry_exhausted',
            errorMessage: error.message,
            finalAttempt: job.data.attemptNumber || job.attemptsMade,
            rawPayload: job.data.rawPayload,
            metadata: {
              jobId: job.id,
              attemptsMade: job.attemptsMade,
            },
            ipAddress: job.data.ipAddress,
            userAgent: job.data.userAgent,
          });
        }
      }
    });

    this.queue.on('stalled', (job) => {
      console.warn('⚠️ Retry job stalled:', job.id);
    });

    this.queue.on('error', (error) => {
      console.error('❌ Queue error:', error);
    });
  }

  /**
   * Start worker
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Worker already running');
      return;
    }

    await this.initialize();
    this.isRunning = true;

    console.log('🚀 Webhook Retry Worker started');
    console.log('📊 Queue stats:', await this.retryService.getQueueStats());
  }

  /**
   * Stop worker
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.queue) {
      await this.queue.close();
    }

    if (this.prisma) {
      await this.prisma.$disconnect();
    }

    this.isRunning = false;
    console.log('🛑 Webhook Retry Worker stopped');
  }

  /**
   * Get worker status
   */
  async getStatus() {
    if (!this.queue) {
      return { running: false, stats: null };
    }

    const stats = await this.retryService.getQueueStats();
    return {
      running: this.isRunning,
      stats,
    };
  }
}

// Export singleton instance
let workerInstance = null;

function getWorker() {
  if (!workerInstance) {
    workerInstance = new WebhookRetryWorker();
  }
  return workerInstance;
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  const worker = getWorker();
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  const worker = getWorker();
  await worker.stop();
  process.exit(0);
});

module.exports = { WebhookRetryWorker, getWorker };

// If running directly, start the worker
if (require.main === module) {
  const worker = getWorker();
  worker.start().catch((error) => {
    console.error('❌ Failed to start worker:', error);
    process.exit(1);
  });
}

