/**
 * Enterprise Queue Manager
 * Handles distributed job processing for scalable extraction
 */

const Bull = require('bull');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class QueueManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.queues = new Map();
    this.workers = new Map();
    
    // Initialize different queues for different processing types
    this.initializeQueues();
  }

  initializeQueues() {
    const queueConfigs = [
      {
        name: 'extraction-high-priority',
        concurrency: 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      },
      {
        name: 'extraction-standard',
        concurrency: 10,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 }
      },
      {
        name: 'extraction-batch',
        concurrency: 20,
        attempts: 1,
        backoff: { type: 'fixed', delay: 10000 }
      },
      {
        name: 'ai-processing',
        concurrency: 3, // Limited by AI API rate limits
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 }
      }
    ];

    queueConfigs.forEach(config => {
      const queue = new Bull(config.name, {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD
        },
        defaultJobOptions: {
          attempts: config.attempts,
          backoff: config.backoff,
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50 // Keep last 50 failed jobs
        }
      });

      this.queues.set(config.name, queue);
      this.setupWorker(config.name, config.concurrency);
    });
  }

  setupWorker(queueName, concurrency) {
    const queue = this.queues.get(queueName);
    
    queue.process(concurrency, async (job) => {
      const { type, data, metadata } = job.data;
      
      try {
        // Update job progress
        await job.progress(10);
        
        // Route to appropriate processor
        let result;
        switch (type) {
          case 'document-extraction':
            result = await this.processDocumentExtraction(data, metadata, job);
            break;
          case 'ai-enhancement':
            result = await this.processAIEnhancement(data, metadata, job);
            break;
          case 'batch-processing':
            result = await this.processBatch(data, metadata, job);
            break;
          default:
            throw new Error(`Unknown job type: ${type}`);
        }
        
        await job.progress(100);
        return result;
        
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    });

    // Setup event listeners
    queue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed successfully`);
      this.notifyJobCompletion(job.id, result);
    });

    queue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
      this.notifyJobFailure(job.id, err);
    });

    queue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled`);
    });

    this.workers.set(queueName, queue);
  }

  async addJob(queueName, jobType, data, options = {}) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobId = uuidv4();
    const jobData = {
      id: jobId,
      type: jobType,
      data: data,
      metadata: {
        userId: options.userId,
        priority: options.priority || 'standard',
        createdAt: new Date().toISOString(),
        ...options.metadata
      }
    };

    const jobOptions = {
      jobId,
      priority: this.getPriorityValue(options.priority),
      delay: options.delay || 0,
      ...options.jobOptions
    };

    const job = await queue.add(jobData, jobOptions);
    
    console.log(`Job ${jobId} added to queue ${queueName}`);
    return {
      jobId,
      queueName,
      estimatedWaitTime: await this.getEstimatedWaitTime(queueName)
    };
  }

  async processDocumentExtraction(data, metadata, job) {
    const ExtractionOrchestrator = require('../extraction/ExtractionOrchestrator');
    
    await job.progress(20);
    
    // Process the document
    const result = await ExtractionOrchestrator.extractContacts(
      data.fileBuffer,
      data.mimeType,
      data.fileName,
      {
        ...data.options,
        progressCallback: (progress) => job.progress(20 + (progress * 0.6))
      }
    );
    
    await job.progress(80);
    
    // Save results if needed
    if (result.success && metadata.saveToDatabase) {
      await ExtractionOrchestrator.saveContacts(
        result.contacts,
        metadata.userId,
        metadata.jobId
      );
    }
    
    return {
      success: result.success,
      contacts: result.contacts,
      metadata: result.metadata,
      processingTime: Date.now() - new Date(metadata.createdAt).getTime()
    };
  }

  async processAIEnhancement(data, metadata, job) {
    const AIEnhancementService = require('./AIEnhancementService');
    
    await job.progress(30);
    
    const result = await AIEnhancementService.enhanceContacts(
      data.contacts,
      data.originalText,
      {
        progressCallback: (progress) => job.progress(30 + (progress * 0.6))
      }
    );
    
    return result;
  }

  async processBatch(data, metadata, job) {
    const results = [];
    const files = data.files;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = (i / files.length) * 100;
      await job.progress(progress);
      
      try {
        const result = await this.processDocumentExtraction(
          file,
          { ...metadata, batchIndex: i },
          job
        );
        results.push({ success: true, result, fileIndex: i });
      } catch (error) {
        results.push({ success: false, error: error.message, fileIndex: i });
      }
    }
    
    return {
      batchResults: results,
      totalFiles: files.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
  }

  getPriorityValue(priority) {
    const priorities = {
      'urgent': 1,
      'high': 2,
      'standard': 3,
      'low': 4,
      'batch': 5
    };
    return priorities[priority] || 3;
  }

  async getEstimatedWaitTime(queueName) {
    const queue = this.queues.get(queueName);
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    
    // Simple estimation: assume 30 seconds per job
    const avgProcessingTime = 30000;
    const queuePosition = waiting.length;
    const concurrency = this.workers.get(queueName)?.concurrency || 1;
    
    return Math.ceil((queuePosition / concurrency) * avgProcessingTime);
  }

  async getJobStatus(jobId) {
    // Search across all queues for the job
    for (const [queueName, queue] of this.queues) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          return {
            id: job.id,
            queue: queueName,
            state: await job.getState(),
            progress: job.progress(),
            data: job.data,
            createdAt: new Date(job.timestamp),
            processedOn: job.processedOn ? new Date(job.processedOn) : null,
            finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
            failedReason: job.failedReason,
            attempts: job.attemptsMade,
            maxAttempts: job.opts.attempts
          };
        }
      } catch (error) {
        // Continue searching in other queues
      }
    }
    
    return null;
  }

  async cancelJob(jobId) {
    for (const [queueName, queue] of this.queues) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          console.log(`Job ${jobId} cancelled from queue ${queueName}`);
          return true;
        }
      } catch (error) {
        // Continue searching in other queues
      }
    }
    
    return false;
  }

  async getQueueStats() {
    const stats = {};
    
    for (const [queueName, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      
      stats[queueName] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    }
    
    return stats;
  }

  async notifyJobCompletion(jobId, result) {
    // Implement notification logic (WebSocket, webhook, etc.)
    // This could integrate with your frontend for real-time updates
    console.log(`Notifying completion of job ${jobId}`);
  }

  async notifyJobFailure(jobId, error) {
    // Implement failure notification logic
    console.log(`Notifying failure of job ${jobId}:`, error.message);
  }

  async shutdown() {
    console.log('Shutting down queue manager...');
    
    // Gracefully close all queues
    for (const [queueName, queue] of this.queues) {
      await queue.close();
      console.log(`Queue ${queueName} closed`);
    }
    
    await this.redis.disconnect();
    console.log('Queue manager shutdown complete');
  }
}

module.exports = new QueueManager();
