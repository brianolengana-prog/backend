const queueManager = require('../config/queue');
const jobProcessor = require('../services/jobProcessor.service');
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

class ExtractionWorker {
  constructor() {
    this.isRunning = false;
    this.workers = [];
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Worker is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting extraction workers...');

    // Start main extraction queue worker
    const extractionQueue = queueManager.getQueue('extraction');
    console.log('🔧 Setting up extraction worker for queue:', extractionQueue.name);
    
    const extractionWorker = extractionQueue.process('extraction', 5, async (job) => {
      console.log('🔄 Processing extraction job:', job.id, job.data.fileName);
      try {
        const result = await jobProcessor.processExtractionJob(job);
        console.log('✅ Job completed successfully:', job.id);
        return result;
      } catch (error) {
        console.error('❌ Job failed:', job.id, error.message);
        throw error;
      }
    });

    // Start priority queue worker
    const priorityQueue = queueManager.getQueue('extraction-priority');
    console.log('🔧 Setting up priority worker for queue:', priorityQueue.name);
    
    const priorityWorker = priorityQueue.process('extraction', 10, async (job) => {
      console.log('🔄 Processing priority extraction job:', job.id, job.data.fileName);
      try {
        const result = await jobProcessor.processExtractionJob(job);
        console.log('✅ Priority job completed successfully:', job.id);
        return result;
      } catch (error) {
        console.error('❌ Priority job failed:', job.id, error.message);
        throw error;
      }
    });

    // Handle job events
    this.setupJobEventHandlers(extractionQueue);
    this.setupJobEventHandlers(priorityQueue);

    this.workers.push(extractionWorker, priorityWorker);
    logger.info('Extraction workers started successfully');
  }

  setupJobEventHandlers(queue) {
    queue.on('completed', (job, result) => {
      logger.info('Job completed', {
        jobId: job.id,
        userId: job.data.userId,
        processingTime: result.processingTime
      });
    });

    queue.on('failed', (job, err) => {
      logger.error('Job failed', {
        jobId: job.id,
        userId: job.data.userId,
        error: err.message
      });
    });

    queue.on('stalled', (job) => {
      logger.warn('Job stalled', {
        jobId: job.id,
        userId: job.data.userId
      });
    });
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping extraction workers...');

    // Close all workers
    await Promise.all(this.workers.map(worker => worker.close()));
    this.workers = [];

    logger.info('Extraction workers stopped');
  }

  getStats() {
    return jobProcessor.getStats();
  }
}

module.exports = new ExtractionWorker();
