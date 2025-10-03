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
      lazyConnect: true
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

  async close() {
    await Promise.all([...this.queues.values()].map(queue => queue.close()));
    await this.redis.quit();
  }
}

module.exports = new QueueManager();
