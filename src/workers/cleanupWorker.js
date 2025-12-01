const queueManager = require('../config/queue');
const queueService = require('../services/queue.service');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class CleanupWorker {
  constructor() {
    this.isRunning = false;
    this.workers = [];
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Cleanup worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting cleanup workers...');

    // Start cleanup queue worker
    const cleanupQueue = queueManager.getQueue('cleanup');
    const cleanupWorker = cleanupQueue.process('cleanup', 2, async (job) => {
      return await this.processCleanupJob(job);
    });

    // Handle job events
    this.setupJobEventHandlers(cleanupQueue);

    this.workers.push(cleanupWorker);
    logger.info('Cleanup workers started successfully');
  }

  async processCleanupJob(job) {
    const { fileId, filePath, retentionDays } = job.data;

    logger.info('Processing cleanup job', {
      jobId: job.id,
      fileId,
      filePath,
      retentionDays
    });

    try {
      // Clean up temporary file
      await queueService.cleanupTempFile(fileId);

      logger.info('Cleanup job completed', {
        jobId: job.id,
        fileId
      });

      return {
        success: true,
        fileId,
        cleanedAt: new Date()
      };

    } catch (error) {
      logger.error('Cleanup job failed', {
        jobId: job.id,
        fileId,
        error: error.message
      });

      throw error;
    }
  }

  setupJobEventHandlers(queue) {
    queue.on('completed', (job, result) => {
      logger.info('Cleanup job completed', {
        jobId: job.id,
        fileId: result.fileId
      });
    });

    queue.on('failed', (job, err) => {
      logger.error('Cleanup job failed', {
        jobId: job.id,
        fileId: job.data.fileId,
        error: err.message
      });
    });
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping cleanup workers...');

    // Close all workers (check if close method exists)
    await Promise.all(
      this.workers
        .filter(worker => worker && typeof worker.close === 'function')
        .map(worker => worker.close())
    );
    
    // Close the queue itself (Bull queues handle worker cleanup)
    const cleanupQueue = queueManager.getQueue('cleanup');
    
    if (cleanupQueue) {
      await cleanupQueue.close().catch(err => {
        logger.warn('Error closing cleanup queue', { error: err.message });
      });
    }
    
    this.workers = [];

    logger.info('Cleanup workers stopped');
  }
}

module.exports = new CleanupWorker();
