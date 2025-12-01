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
    console.log('🔧 Queue instance:', !!extractionQueue);
    
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
    
    console.log('🔧 Extraction worker created:', !!extractionWorker);

    // Start priority queue worker
    const priorityQueue = queueManager.getQueue('extraction-priority');
    console.log('🔧 Setting up priority worker for queue:', priorityQueue.name);
    console.log('🔧 Priority queue instance:', !!priorityQueue);
    
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
    
    console.log('🔧 Priority worker created:', !!priorityWorker);

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

    // Close all workers (check if close method exists)
    await Promise.all(
      this.workers
        .filter(worker => worker && typeof worker.close === 'function')
        .map(worker => worker.close())
    );
    
    // Close the queues themselves (Bull queues handle worker cleanup)
    const extractionQueue = queueManager.getQueue('extraction');
    const priorityQueue = queueManager.getQueue('extraction-priority');
    
    if (extractionQueue) {
      await extractionQueue.close().catch(err => {
        logger.warn('Error closing extraction queue', { error: err.message });
      });
    }
    
    if (priorityQueue) {
      await priorityQueue.close().catch(err => {
        logger.warn('Error closing priority queue', { error: err.message });
      });
    }
    
    this.workers = [];

    logger.info('Extraction workers stopped');
  }

  getStats() {
    return jobProcessor.getStats();
  }
}

module.exports = new ExtractionWorker();
