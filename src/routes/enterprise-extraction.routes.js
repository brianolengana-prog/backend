/**
 * Enterprise Extraction Routes
 * 
 * Advanced extraction endpoints with:
 * - Enterprise-grade contact extraction
 * - Intelligent document analysis
 * - Performance monitoring
 * - Quality metrics
 * - Comprehensive error handling
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const EnhancedAdaptiveExtractionService = require('../services/enterprise/EnhancedAdaptiveExtraction.service');
const usageService = require('../services/usage.service');
const enterpriseConfig = require('../config/enterprise.config');
const winston = require('winston');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Initialize enterprise extraction service
const enterpriseExtractor = new EnhancedAdaptiveExtractionService();

// Configure logging
const logger = winston.createLogger({
  level: enterpriseConfig.monitoring.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Rate limiting for enterprise endpoints
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting if enabled
if (enterpriseConfig.security.enableRateLimiting) {
  router.use(createRateLimit(
    60 * 1000, // 1 minute
    enterpriseConfig.security.maxRequestsPerMinute,
    'Too many extraction requests, please try again later'
  ));
}

// All extraction routes require authentication
router.use(authenticateToken);

// Configure multer for enterprise file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv',
      'application/rtf',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});

/**
 * Enterprise Contact Extraction Endpoint
 * POST /api/extraction/enterprise/upload
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  const extractionId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Validate request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
        extractionId
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const userId = req.user.id;

    logger.info('🚀 Enterprise extraction started', {
      extractionId,
      userId,
      fileName: originalname,
      mimeType: mimetype,
      fileSize: size
    });

    // Check usage limits
    const canUpload = await usageService.canPerformUpload(userId, 1);
    if (!canUpload.allowed) {
      return res.status(429).json({
        success: false,
        error: canUpload.reason,
        extractionId,
        usage: canUpload.usage
      });
    }

    // Parse extraction options
    const options = {
      extractionId,
      userId,
      fileName: originalname,
      mimeType: mimetype,
      fileSize: size,
      
      // Strategy options
      strategy: req.body.strategy || 'auto',
      useAI: req.body.useAI !== 'false' && enterpriseConfig.extraction.enableAIEnhancement,
      confidenceThreshold: parseFloat(req.body.confidenceThreshold) || enterpriseConfig.extraction.defaultConfidenceThreshold,
      
      // Processing options
      maxContacts: parseInt(req.body.maxContacts) || enterpriseConfig.extraction.maxContactsPerDocument,
      enableValidation: req.body.enableValidation !== 'false',
      enableDeduplication: req.body.enableDeduplication !== 'false',
      
      // Role preferences
      rolePreferences: req.body.rolePreferences ? JSON.parse(req.body.rolePreferences) : [],
      
      // Advanced options
      enableAdvancedPatterns: enterpriseConfig.extraction.enableAdvancedPatterns,
      enableQualityMetrics: enterpriseConfig.monitoring.enableQualityMetrics
    };

    // Extract text from document
    const extractionService = require('../services/extraction-refactored.service');
    let extractedText = '';

    try {
      if (mimetype === 'application/pdf') {
        extractedText = await extractionService.extractTextFromPDF(buffer);
      } else if (mimetype.includes('wordprocessingml') || mimetype === 'application/msword') {
        extractedText = await extractionService.extractTextFromDOCX(buffer);
      } else if (mimetype.includes('spreadsheetml') || mimetype === 'application/vnd.ms-excel') {
        extractedText = await extractionService.extractTextFromXLSX(buffer);
      } else if (mimetype === 'text/csv') {
        extractedText = buffer.toString('utf-8');
      } else if (mimetype === 'text/plain') {
        extractedText = buffer.toString('utf-8');
      } else if (mimetype.startsWith('image/')) {
        // For images, we'll need OCR - fallback to basic extraction for now
        extractedText = await extractionService.extractTextFromImage(buffer);
      } else {
        throw new Error(`Unsupported file type: ${mimetype}`);
      }
    } catch (textExtractionError) {
      logger.error('❌ Text extraction failed', {
        extractionId,
        error: textExtractionError.message,
        mimeType: mimetype
      });
      
      return res.status(400).json({
        success: false,
        error: 'Failed to extract text from document',
        details: textExtractionError.message,
        extractionId
      });
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'No readable text found in document',
        extractionId
      });
    }

    logger.info('📄 Text extracted successfully', {
      extractionId,
      textLength: extractedText.length
    });

    // Perform enterprise extraction
    const extractionResult = await enterpriseExtractor.extractContacts(extractedText, options);

    // Record usage
    await usageService.incrementUsage(userId, 'upload', 1);
    await usageService.incrementUsage(userId, 'contact_extraction', extractionResult.contacts.length);

    // Save extraction job to database
    const jobRecord = await prisma.extractionJob.create({
      data: {
        id: extractionId,
        userId,
        title: originalname,
        status: 'completed',
        fileInfo: {
          name: originalname,
          size,
          type: mimetype
        },
        extractedContactsCount: extractionResult.contacts.length,
        metadata: extractionResult.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      }
    });

    // Save contacts to database
    if (extractionResult.contacts.length > 0) {
      const contactsData = extractionResult.contacts.map(contact => ({
        id: contact.id,
        jobId: extractionId,
        userId,
        name: contact.name,
        role: contact.role || null,
        email: contact.email || null,
        phone: contact.phone || null,
        company: contact.company || null,
        department: contact.department || null,
        notes: contact.notes || null,
        confidence: contact.confidence,
        source: contact.source || 'enterprise',
        metadata: {
          patternName: contact.patternName,
          patternCategory: contact.patternCategory,
          validationScore: contact.validationScore,
          section: contact.section
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await prisma.contact.createMany({
        data: contactsData,
        skipDuplicates: true
      });
    }

    const processingTime = Date.now() - startTime;

    logger.info('✅ Enterprise extraction completed', {
      extractionId,
      contactsFound: extractionResult.contacts.length,
      processingTime,
      strategy: extractionResult.metadata.strategy
    });

    // Return enterprise response format
    res.json({
      success: true,
      jobId: extractionId,
      status: 'completed',
      result: {
        contacts: extractionResult.contacts,
        metadata: {
          ...extractionResult.metadata,
          processingTime,
          textLength: extractedText.length,
          fileInfo: {
            name: originalname,
            size,
            type: mimetype
          }
        }
      },
      // Legacy compatibility fields
      contacts: extractionResult.contacts,
      usage: await usageService.getUsageInfo(userId),
      documentType: extractionResult.metadata.documentType,
      productionType: 'extraction',
      processedChunks: 1
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Enterprise extraction failed', {
      extractionId,
      error: error.message,
      stack: error.stack,
      processingTime
    });

    // Try to save failed job record
    try {
      await prisma.extractionJob.create({
        data: {
          id: extractionId,
          userId: req.user?.id || 'unknown',
          title: req.file?.originalname || 'unknown',
          status: 'failed',
          error: error.message,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (dbError) {
      logger.error('Failed to save error record', { extractionId, dbError: dbError.message });
    }

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      details: enterpriseConfig.development.enableDebugLogging ? error.message : 'Internal server error',
      extractionId,
      processingTime
    });
  }
});

/**
 * Get Extraction Job Status
 * GET /api/extraction/enterprise/job/:jobId
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await prisma.extractionJob.findFirst({
      where: {
        id: jobId,
        userId
      },
      include: {
        contacts: true
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        title: job.title,
        contactsCount: job.extractedContactsCount,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
        metadata: job.metadata
      },
      contacts: job.contacts
    });

  } catch (error) {
    logger.error('Failed to get job status', {
      jobId: req.params.jobId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

/**
 * Get Service Health and Capabilities
 * GET /api/extraction/enterprise/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = enterpriseExtractor.getHealthStatus();
    const config = {
      features: {
        aiEnabled: enterpriseConfig.extraction.ai.enabled,
        advancedPatternsEnabled: enterpriseConfig.extraction.enableAdvancedPatterns,
        validationEnabled: enterpriseConfig.extraction.validation.enableNameValidation,
        deduplicationEnabled: enterpriseConfig.extraction.deduplication.enabled,
        monitoringEnabled: enterpriseConfig.monitoring.enabled
      },
      limits: {
        maxProcessingTime: enterpriseConfig.extraction.maxProcessingTime,
        maxTextLength: enterpriseConfig.extraction.maxTextLength,
        maxContactsPerDocument: enterpriseConfig.extraction.maxContactsPerDocument
      },
      thresholds: {
        minConfidence: enterpriseConfig.extraction.minConfidenceThreshold,
        defaultConfidence: enterpriseConfig.extraction.defaultConfidenceThreshold,
        highConfidence: enterpriseConfig.extraction.highConfidenceThreshold
      }
    };

    res.json({
      success: true,
      health,
      config,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * Get Extraction Analytics
 * GET /api/extraction/enterprise/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeframe = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    const timeframes = {
      '1d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    };
    const startDate = timeframes[timeframe] || timeframes['7d'];

    // Get extraction statistics
    const jobs = await prisma.extractionJob.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate
        }
      },
      include: {
        _count: {
          select: {
            contacts: true
          }
        }
      }
    });

    const analytics = {
      totalJobs: jobs.length,
      successfulJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      totalContacts: jobs.reduce((sum, job) => sum + (job.extractedContactsCount || 0), 0),
      averageContactsPerJob: jobs.length > 0 ? jobs.reduce((sum, job) => sum + (job.extractedContactsCount || 0), 0) / jobs.length : 0,
      successRate: jobs.length > 0 ? jobs.filter(j => j.status === 'completed').length / jobs.length : 0,
      
      // Processing time analytics
      averageProcessingTime: jobs.length > 0 ? 
        jobs.reduce((sum, job) => {
          const processingTime = job.metadata?.processingTime || 0;
          return sum + processingTime;
        }, 0) / jobs.length : 0,
      
      // Document type distribution
      documentTypes: jobs.reduce((acc, job) => {
        const docType = job.metadata?.documentType || 'unknown';
        acc[docType] = (acc[docType] || 0) + 1;
        return acc;
      }, {}),
      
      // Strategy usage
      strategies: jobs.reduce((acc, job) => {
        const strategy = job.metadata?.strategy || 'unknown';
        acc[strategy] = (acc[strategy] || 0) + 1;
        return acc;
      }, {}),
      
      timeframe,
      startDate,
      endDate: now
    };

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Analytics request failed', {
      userId: req.user.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

module.exports = router;
