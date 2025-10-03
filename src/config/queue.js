const Queue = require('bull');
const Redis = require('ioredis');
const env = require('./env');

class QueueManager {
  constructor() {
    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnClusterDown: 300,
      enableReadyCheck: false,
      maxRetriesPerRequest: null
    });

    // Add Redis connection event handlers
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

    this.queues = new Map();
    this.initializeQueues();
  }

  initializeQueues() {
    // Main extraction queue
    this.queues.set('extraction', new Queue('extraction', {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD
      },
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
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD
      },
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
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 2,
        delay: 24 * 60 * 60 * 1000 // 24 hours delay
      }
    }));
  }

  getQueue(name) {
    return this.queues.get(name);
  }

  async testConnection() {
    try {
      await this.redis.ping();
      console.log('✅ Redis ping successful');
      return true;
    } catch (error) {
      console.error('❌ Redis ping failed:', error.message);
      return false;
    }
  }

  async close() {
    await Promise.all([...this.queues.values()].map(queue => queue.close()));
    await this.redis.quit();
  }
}

module.exports = new QueueManager();
