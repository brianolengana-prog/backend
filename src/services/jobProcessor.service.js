const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const simpleExtractionService = require('./simpleExtraction.service');
const optimizedHybridExtractionService = require('./optimizedHybridExtraction.service');
const hybridExtractionService = require('./hybridExtraction.service');
const aiExtractionService = require('./aiExtraction.service');
const optimizedAIExtractionService = require('./optimizedAIExtraction.service');
const awsTextractService = require('./awsTextract.service');
const extractionService = require('./extraction.service');
const usageService = require('./usage.service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configure structured logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/job-processor.log' })
  ]
});

class JobProcessorService {
  constructor() {
    this.processingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      averageProcessingTime: 0
    };
  }

  async processExtractionJob(job) {
    const startTime = Date.now();
    const { userId, fileId, fileName, fileType, fileSize, extractionMethod, options, metadata } = job.data;

    logger.info('Starting extraction job', {
      jobId: job.id,
      userId,
      fileId,
      fileName,
      extractionMethod,
      priority: job.opts.priority
    });

    try {
      // Update job status to processing
      await this.updateJobStatus(job.id, 'processing', { startedAt: new Date() });

      // Check usage limits before processing
      const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
      if (!canProcess.canPerform) {
        throw new Error(`Usage limit exceeded: ${canProcess.reason}`);
      }

      // Read file from temporary storage
      const filePath = path.join(__dirname, '../temp', fileId);
      const fileBuffer = await fs.readFile(filePath);

      // Process extraction using simple, reliable service
      logger.info('🔍 Using simple extraction service', {
        jobId,
        fileName,
        fileType,
        extractionMethod
      });

      const result = await simpleExtractionService.extractContacts(
        fileBuffer, 
        `application/${fileType}`, 
        fileName, 
        options
      );

      if (!result.success) {
        throw new Error(result.error || 'Extraction failed');
      }

      // Save results to database
      const jobRecord = await this.saveExtractionResults(userId, fileId, fileName, result, job.id);

      // Update usage tracking
      await usageService.incrementUsage(userId, 'upload', 1);
      if (result.contacts && result.contacts.length > 0) {
        await usageService.incrementUsage(userId, 'contact_extraction', result.contacts.length);
      }

      // Clean up temporary file
      await this.scheduleFileCleanup(fileId, filePath);

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      logger.info('Extraction job completed successfully', {
        jobId: job.id,
        userId,
        fileId,
        contactsExtracted: result.contacts?.length || 0,
        processingTime,
        extractionMethod
      });

      // Update job status to completed
      await this.updateJobStatus(job.id, 'completed', {
        completedAt: new Date(),
        processingTime,
        contactsExtracted: result.contacts?.length || 0,
        extractionMethod
      });

      return {
        success: true,
        jobId: jobRecord.id,
        contacts: result.contacts || [],
        metadata: {
          ...result.metadata,
          processingTime,
          extractionMethod,
          qualityScore: this.calculateQualityScore(result.contacts || [])
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime);

      logger.error('Extraction job failed', {
        jobId: job.id,
        userId,
        fileId,
        error: error.message,
        processingTime,
        extractionMethod
      });

      // Update job status to failed
      await this.updateJobStatus(job.id, 'failed', {
        failedAt: new Date(),
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  async processWithAI(fileBuffer, fileType, fileName, options) {
    try {
      // Try optimized AI first, fallback to regular AI
      if (optimizedAIExtractionService.getHealthStatus().available) {
        return await optimizedAIExtractionService.extractContacts(fileBuffer, `application/${fileType}`, fileName, options);
      } else if (aiExtractionService.getHealthStatus().available) {
        return await aiExtractionService.extractContacts(fileBuffer, `application/${fileType}`, fileName, options);
      } else {
        throw new Error('AI extraction services not available');
      }
    } catch (error) {
      logger.error('AI extraction failed', { error: error.message, fileName });
      throw error;
    }
  }

  async processWithPattern(fileBuffer, fileType, fileName, options) {
    try {
      return await extractionService.extractContacts(fileBuffer, `application/${fileType}`, fileName, options);
    } catch (error) {
      logger.error('Pattern extraction failed', { error: error.message, fileName });
      throw error;
    }
  }

  async processWithAWSTextract(fileBuffer, fileType, fileName, options) {
    try {
      // Step 1: Extract text with AWS Textract
      const textractResult = await awsTextractService.extractTextFromDocument(fileBuffer, `application/${fileType}`, fileName, options);
      
      if (!textractResult.success) {
        throw new Error(`AWS Textract failed: ${textractResult.error}`);
      }

      // Step 2: Extract contacts from text using AI
      let contacts = [];
      let extractionMethod = 'aws-textract-only';
      
      if (optimizedAIExtractionService.getHealthStatus().available) {
        const aiResult = await optimizedAIExtractionService.extractContactsFromText(textractResult.text, options);
        contacts = aiResult.contacts || [];
        extractionMethod = 'aws-textract-with-optimized-ai';
      } else if (aiExtractionService.getHealthStatus().available) {
        const aiResult = await aiExtractionService.extractContactsFromText(textractResult.text, options);
        contacts = aiResult.contacts || [];
        extractionMethod = 'aws-textract-with-ai';
      } else {
        // Fallback to pattern extraction
        const patternResult = await extractionService.extractContactsFromText(textractResult.text, options);
        contacts = patternResult.contacts || [];
        extractionMethod = 'aws-textract-with-pattern';
      }

      return {
        success: true,
        contacts,
        metadata: {
          extractionMethod,
          textractMetadata: textractResult.metadata,
          textLength: textractResult.text.length
        }
      };
    } catch (error) {
      logger.error('AWS Textract extraction failed', { error: error.message, fileName });
      throw error;
    }
  }

  async updateJobStatus(jobId, status, metadata = {}) {
    try {
      // Update in Redis queue
      const queue = require('../config/queue').getQueue('extraction');
      const job = await queue.getJob(jobId);
      if (job) {
        await job.updateProgress({ status, ...metadata });
      }

      // Update in database if job record exists
      await prisma.job.updateMany({
        where: { externalJobId: jobId },
        data: { status: status.toUpperCase(), ...metadata }
      });
    } catch (error) {
      logger.error('Failed to update job status', { jobId, status, error: error.message });
    }
  }

  async saveExtractionResults(userId, fileId, fileName, result, externalJobId) {
    try {
      // Create job record
      const job = await prisma.job.create({
        data: {
          userId,
          externalJobId,
          title: `Extraction - ${fileName}`,
          fileName,
          status: 'COMPLETED',
          metadata: {
            fileId,
            extractionMethod: result.metadata?.extractionMethod || 'hybrid',
            qualityScore: this.calculateQualityScore(result.contacts || [])
          }
        }
      });

      // Save contacts
      if (result.contacts && result.contacts.length > 0) {
        await this.saveContacts(result.contacts, userId, job.id);
      }

      return job;
    } catch (error) {
      logger.error('Failed to save extraction results', { userId, fileId, error: error.message });
      throw error;
    }
  }

  async saveContacts(contacts, userId, jobId) {
    const contactData = contacts.map(contact => ({
      userId,
      jobId,
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
      company: contact.company || '',
      department: contact.department || '',
      confidence: contact.confidence || 0.8,
      metadata: contact.metadata || {}
    }));

    await prisma.contact.createMany({
      data: contactData,
      skipDuplicates: true
    });
  }

  async scheduleFileCleanup(fileId, filePath) {
    try {
      const cleanupQueue = require('../config/queue').getQueue('cleanup');
      await cleanupQueue.add('cleanup', {
        fileId,
        filePath,
        retentionDays: 7
      });
    } catch (error) {
      logger.error('Failed to schedule file cleanup', { fileId, error: error.message });
    }
  }

  calculateQualityScore(contacts) {
    if (!contacts || contacts.length === 0) return 0;
    
    const scores = contacts.map(contact => {
      let score = 0;
      if (contact.name) score += 0.3;
      if (contact.email) score += 0.3;
      if (contact.phone) score += 0.2;
      if (contact.role) score += 0.1;
      if (contact.company) score += 0.1;
      return score;
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  updateStats(success, processingTime) {
    this.processingStats.totalProcessed++;
    if (success) {
      this.processingStats.successful++;
    } else {
      this.processingStats.failed++;
    }
    
    // Update average processing time
    const totalTime = this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - 1) + processingTime;
    this.processingStats.averageProcessingTime = totalTime / this.processingStats.totalProcessed;
  }

  getStats() {
    return {
      ...this.processingStats,
      successRate: this.processingStats.totalProcessed > 0 
        ? (this.processingStats.successful / this.processingStats.totalProcessed) * 100 
        : 0
    };
  }
}

module.exports = new JobProcessorService();
