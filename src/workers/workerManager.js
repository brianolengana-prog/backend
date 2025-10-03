const extractionWorker = require('./extractionWorker');
const cleanupWorker = require('./cleanupWorker');
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

class WorkerManager {
  constructor() {
    this.workers = [];
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Worker manager is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting worker manager...');

    try {
      // Start extraction workers
      await extractionWorker.start();
      this.workers.push(extractionWorker);

      // Start cleanup workers
      await cleanupWorker.start();
      this.workers.push(cleanupWorker);

      logger.info('All workers started successfully');
    } catch (error) {
      logger.error('Failed to start workers', { error: error.message });
      await this.stop();
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    logger.info('Stopping worker manager...');

    try {
      // Stop all workers
      await Promise.all(this.workers.map(worker => worker.stop()));
      this.workers = [];

      logger.info('All workers stopped successfully');
    } catch (error) {
      logger.error('Error stopping workers', { error: error.message });
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      workers: this.workers.length,
      extractionStats: extractionWorker.getStats(),
      cleanupStats: cleanupWorker.getStats()
    };
  }

  async healthCheck() {
    try {
      const stats = this.getStats();
      return {
        healthy: this.isRunning && this.workers.length > 0,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new WorkerManager();
