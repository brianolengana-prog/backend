const Queue = require('bull');
const Redis = require('ioredis');
const env = require('../../../config/env');

/**
 * Queue Manager
 * Manages Redis-based job queues using Bull
 * 
 * Refactored from src/config/queue.js to shared infrastructure
 */
class QueueManager {
  constructor() {
    this.redis = null;
    this.queues = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize queues
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize Redis connection
    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      enableReadyCheck: false
    });

    // Add event handlers
    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.redis.on('ready', () => {
      console.log('✅ Redis ready');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    this.redis.on('close', () => {
      console.warn('⚠️ Redis connection closed');
    });

    // Initialize queues
    this.initializeQueues();
    this.isInitialized = true;
  }

  /**
   * Initialize all queues
   */
  initializeQueues() {
    const queueConfig = {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD
      }
    };

    // Extraction queue
    this.queues.set('extraction', new Queue('extraction', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    }));

    // Priority queue for enterprise customers
    this.queues.set('extraction-priority', new Queue('extraction-priority', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    }));

    // Cleanup queue for file management
    this.queues.set('cleanup', new Queue('cleanup', {
      ...queueConfig,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        delay: 24 * 60 * 60 * 1000 // 24 hours delay
      }
    }));
  }

  /**
   * Get queue by name
   * @param {string} name - Queue name
   * @returns {Queue|null}
   */
  getQueue(name) {
    if (!this.isInitialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    return this.queues.get(name);
  }

  /**
   * Test Redis connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!this.redis) {
        await this.initialize();
      }
      await this.redis.ping();
      console.log('✅ Redis ping successful');
      return true;
    } catch (error) {
      console.error('❌ Redis ping failed:', error.message);
      return false;
    }
  }

  /**
   * Close all queues and Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    await Promise.all([...this.queues.values()].map(queue => queue.close()));
    if (this.redis) {
      await this.redis.quit();
    }
    this.isInitialized = false;
  }

  /**
   * Get all queue names
   * @returns {Array<string>}
   */
  getQueueNames() {
    return Array.from(this.queues.keys());
  }
}

module.exports = new QueueManager();

