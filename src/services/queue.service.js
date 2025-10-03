const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const queueManager = require('../config/queue');
const { JobTypes, JobSchemas } = require('../types/jobTypes');
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

class QueueService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message });
    }
  }

  async addExtractionJob(jobData) {
    try {
      // Generate fileId first
      const fileId = uuidv4();
      
      // Extract fileBuffer before validation (it's not part of the job schema)
      const { fileBuffer, ...jobDataWithoutBuffer } = jobData;
      
      // Add fileId to job data for validation
      const jobDataWithFileId = {
        ...jobDataWithoutBuffer,
        fileId
      };

      // Validate job data (without fileBuffer)
      const { error, value } = JobSchemas[JobTypes.EXTRACTION].validate(jobDataWithFileId);
      if (error) {
        throw new Error(`Invalid job data: ${error.details[0].message}`);
      }

      const validatedData = value;
      
      // Save file to temporary storage
      const filePath = path.join(this.tempDir, fileId);
      await fs.writeFile(filePath, fileBuffer);

      // Determine queue based on priority
      const queueName = validatedData.priority === 'urgent' || validatedData.priority === 'high' 
        ? 'extraction-priority' 
        : 'extraction';

      const queue = queueManager.getQueue(queueName);

      // Add job to queue
      console.log('🔄 Adding job to queue:', queueName);
      const job = await queue.add(JobTypes.EXTRACTION, {
        ...validatedData,
        fileId,
        filePath
      }, {
        priority: this.getPriorityValue(validatedData.priority),
        delay: 0
      });

      console.log('✅ Job added to queue successfully:', job.id);
      console.log('📊 Queue stats:', {
        waiting: await queue.getWaiting(),
        active: await queue.getActive(),
        completed: await queue.getCompleted(),
        failed: await queue.getFailed()
      });
      logger.info('Extraction job added to queue', {
        jobId: job.id,
        userId: validatedData.userId,
        fileName: validatedData.fileName,
        priority: validatedData.priority,
        queue: queueName
      });

      return {
        success: true,
        jobId: job.id,
        fileId,
        status: 'queued',
        estimatedProcessingTime: this.getEstimatedProcessingTime(validatedData.extractionMethod, validatedData.fileSize)
      };

    } catch (error) {
      logger.error('Failed to add extraction job', { error: error.message, userId: jobData.userId });
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      // Check both queues for the job
      const extractionQueue = queueManager.getQueue('extraction');
      const priorityQueue = queueManager.getQueue('extraction-priority');

      let job = await extractionQueue.getJob(jobId);
      let queueName = 'extraction';

      if (!job) {
        job = await priorityQueue.getJob(jobId);
        queueName = 'extraction-priority';
      }

      if (!job) {
        return {
          success: false,
          error: 'Job not found'
        };
      }

      const state = await job.getState();
      const progress = job.progress || {};

      return {
        success: true,
        jobId: job.id,
        status: state,
        progress,
        data: job.data,
        queue: queueName,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        failedAt: job.failedReason ? new Date(job.finishedOn) : null
      };

    } catch (error) {
      logger.error('Failed to get job status', { jobId, error: error.message });
      throw error;
    }
  }

  async cancelJob(jobId) {
    try {
      // Check both queues for the job
      const extractionQueue = queueManager.getQueue('extraction');
      const priorityQueue = queueManager.getQueue('extraction-priority');

      let job = await extractionQueue.getJob(jobId);
      let queueName = 'extraction';

      if (!job) {
        job = await priorityQueue.getJob(jobId);
        queueName = 'extraction-priority';
      }

      if (!job) {
        return {
          success: false,
          error: 'Job not found'
        };
      }

      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        return {
          success: false,
          error: 'Job cannot be cancelled - already finished'
        };
      }

      await job.remove();

      logger.info('Job cancelled', { jobId, queue: queueName });

      return {
        success: true,
        jobId,
        status: 'cancelled'
      };

    } catch (error) {
      logger.error('Failed to cancel job', { jobId, error: error.message });
      throw error;
    }
  }

  async getQueueStats() {
    try {
      const extractionQueue = queueManager.getQueue('extraction');
      const priorityQueue = queueManager.getQueue('extraction-priority');

      const [extractionStats, priorityStats] = await Promise.all([
        this.getQueueStatistics(extractionQueue),
        this.getQueueStatistics(priorityQueue)
      ]);

      return {
        success: true,
        queues: {
          extraction: extractionStats,
          priority: priorityStats
        },
        total: {
          waiting: extractionStats.waiting + priorityStats.waiting,
          active: extractionStats.active + priorityStats.active,
          completed: extractionStats.completed + priorityStats.completed,
          failed: extractionStats.failed + priorityStats.failed
        }
      };

    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      throw error;
    }
  }

  async getQueueStatistics(queue) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  getPriorityValue(priority) {
    const priorityMap = {
      'urgent': 1,
      'high': 2,
      'normal': 3,
      'low': 4
    };
    return priorityMap[priority] || 3;
  }

  getEstimatedProcessingTime(extractionMethod, fileSize) {
    const baseTime = {
      'pattern': 5000,      // 5 seconds
      'ai': 30000,          // 30 seconds
      'hybrid': 20000,      // 20 seconds
      'aws-textract': 15000 // 15 seconds
    };

    const base = baseTime[extractionMethod] || 20000;
    const sizeMultiplier = Math.max(1, fileSize / (1024 * 1024)); // 1MB base
    return Math.round(base * sizeMultiplier);
  }

  async cleanupTempFile(fileId) {
    try {
      const filePath = path.join(this.tempDir, fileId);
      await fs.unlink(filePath);
      logger.info('Temporary file cleaned up', { fileId });
    } catch (error) {
      logger.error('Failed to cleanup temporary file', { fileId, error: error.message });
    }
  }
}

module.exports = new QueueService();
