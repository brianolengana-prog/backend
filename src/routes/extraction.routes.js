/**
 * Extraction Routes
 * Handles call sheet contact extraction with clean, optimized architecture
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const extractionService = require('../services/extraction-refactored.service');
const aiExtractionService = require('../services/aiExtraction.service');
const optimizedAIExtractionService = require('../services/optimizedAIExtraction.service');
const awsTextractService = require('../services/awsTextract.service');
const hybridExtractionService = require('../services/hybridExtraction.service');
const adaptiveExtractionService = require('../services/adaptiveExtraction.service');
const usageService = require('../services/usage.service');
// Enterprise extraction integration
const ExtractionMigrationService = require('../services/enterprise/ExtractionMigrationService');
const enterpriseConfig = require('../config/enterprise.config');
// Queue removed: we process synchronously for reliability
// const queueService = require('../services/queue.service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
// ✅ MIGRATED: Now using refactored extraction service (2025-10-06T08:37:32.049Z)
// Original monolithic service backed up with timestamp suffix
// New modular architecture provides better maintainability and performance

const router = express.Router();

// Initialize enterprise migration service
const migrationService = new ExtractionMigrationService();

// All extraction routes require authentication
router.use(authenticateToken);

// Configure multer for file uploads (using memory storage for better performance)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'text/plain'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, CSV, images, and text files are allowed.'), false);
    }
  }
});

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = path.join(__dirname, '../uploads');
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

ensureUploadDir();

/**
 * POST /api/extraction/upload
 * Upload and extract contacts from call sheet file (Async Queue-based)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options, extractionMethod = 'hybrid', priority = 'normal' } = req.body;
    
    // Parse options if it's a string
    let parsedOptions = {};
    if (options) {
      try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
        console.log('📁 Parsed options:', parsedOptions);
      } catch (error) {
        console.warn('⚠️ Failed to parse options, using empty object:', error.message);
        parsedOptions = {};
      }
    } else {
      console.log('📁 No options provided, using empty object');
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('📁 File upload received:', req.file.originalname);
    console.log('📁 File type:', req.file.mimetype);
    console.log('📁 File size:', req.file.size);
    console.log('📁 Options received:', options, 'Type:', typeof options);

    // Check usage limits before processing
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({ 
        success: false, 
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    // Determine file type from mimetype
    const fileTypeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/csv': 'csv',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/tiff': 'image'
    };

    const fileType = fileTypeMap[req.file.mimetype] || 'pdf';
  // Always process synchronously for stability with timeout
  try {
    // Extract text using the refactored service
    let extractedText = '';
    
    console.log('📄 Extracting text from document...');
    
    if (req.file.mimetype === 'text/csv' || req.file.mimetype === 'text/plain') {
      // Handle text files directly
      extractedText = req.file.buffer.toString('utf-8');
    } else {
      // Use the refactored extraction service for all other file types
      try {
        // Wait a moment for service initialization if needed
        let retries = 3;
        while (retries > 0 && typeof extractionService.extractTextFromDocument !== 'function') {
          console.log('⏳ Waiting for extraction service initialization...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries--;
        }
        
        // Final check
        if (typeof extractionService.extractTextFromDocument !== 'function') {
          console.error('❌ extractTextFromDocument method not available after retries');
          throw new Error('Extraction service not properly initialized');
        }
        
        extractedText = await extractionService.extractTextFromDocument(req.file.buffer, req.file.mimetype);
      } catch (textError) {
        console.error('❌ Text extraction failed:', textError.message);
        
        // Fallback: try to use the legacy extraction service
        console.log('🔄 Attempting fallback to legacy extraction...');
        try {
          const legacyResult = await adaptiveExtractionService.extractContacts(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname,
            { userId, ...parsedOptions }
          );
          
          if (legacyResult && legacyResult.success && legacyResult.contacts) {
            console.log('✅ Legacy extraction successful, returning result directly');
            
            // Record usage and return result directly
            await usageService.incrementUsage(userId, 'upload', 1);
            
            return res.json({
              success: true,
              jobId: `legacy_${Date.now()}`,
              status: 'completed',
              result: {
                contacts: legacyResult.contacts,
                metadata: legacyResult.metadata || {}
              },
              contacts: legacyResult.contacts,
              usage: await usageService.getUsageInfo(userId),
              documentType: 'call-sheet',
              productionType: 'extraction',
              processedChunks: 1
            });
          }
        } catch (legacyError) {
          console.error('❌ Legacy extraction also failed:', legacyError.message);
        }
        
        throw new Error(`Failed to extract text from ${req.file.mimetype}: ${textError.message}`);
      }
    }
    
    console.log('✅ Text extracted successfully, length:', extractedText.length);

    // Use migration service to route to appropriate extraction system
    const extractionPromise = migrationService.extractContacts(extractedText, {
      userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      extractionId: `sync_${Date.now()}`,
      ...parsedOptions,
      maxContacts: 1000,
      maxProcessingTime: 15000
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout - file too large or complex')), 30000);
    });

    console.log('🚀 Starting extraction with timeout protection...');
    const result = await Promise.race([extractionPromise, timeoutPromise]);

    if (!result.success) {
      // Provide specific error messages based on failure type
      let errorMessage = 'Extraction failed';
      let errorCode = 'EXTRACTION_FAILED';
      
      if (result.error) {
        if (result.error.includes('timeout')) {
          errorMessage = 'File is too large or complex. Please try a smaller file or contact support.';
          errorCode = 'EXTRACTION_TIMEOUT';
        } else if (result.error.includes('insufficient text')) {
          errorMessage = 'Unable to read text from this file. Please ensure it\'s a valid document.';
          errorCode = 'INVALID_DOCUMENT';
        } else {
          errorMessage = result.error;
        }
      }

      return res.status(400).json({ 
        success: false, 
        error: errorMessage,
        errorCode: errorCode,
        requiresSupport: errorCode === 'EXTRACTION_TIMEOUT'
      });
    }

    console.log(`✅ Extraction completed: ${result.contacts?.length || 0} contacts found`);

    await usageService.incrementUsage(userId, 'upload', 1);
    if (result.contacts && result.contacts.length > 0) {
      await usageService.incrementUsage(userId, 'contact_extraction', result.contacts.length);
    }

    return res.json({
      success: true,
      jobId: `sync_${Date.now()}`,
      status: 'completed',
      result: {
        contacts: result.contacts || [],
        metadata: result.metadata || {},
        processingTime: result.metadata?.processingTime || 0
      }
    });
  } catch (syncImmediateError) {
    console.error('❌ Synchronous processing failed:', syncImmediateError.message);
    
    // Provide user-friendly error messages
    let errorMessage = 'Extraction failed';
    let errorCode = 'EXTRACTION_FAILED';
    
    if (syncImmediateError.message.includes('timeout')) {
      errorMessage = 'File is too large or complex. Please try a smaller file or contact support.';
      errorCode = 'EXTRACTION_TIMEOUT';
    } else if (syncImmediateError.message.includes('usage')) {
      errorMessage = 'You have reached your upload limit. Please upgrade your plan to continue.';
      errorCode = 'USAGE_LIMIT_EXCEEDED';
    }
    
    return res.status(500).json({ 
      success: false, 
      error: errorMessage,
      errorCode: errorCode,
      requiresUpgrade: errorCode === 'USAGE_LIMIT_EXCEEDED'
    });
  }

  } catch (error) {
    console.error('❌ File upload error:', error);
    
    res.status(500).json({
      success: false,
      error: 'File upload failed'
    });
  }
});

/**
 * POST /api/extraction/extract
 * Extract contacts from call sheet text
 */
router.post('/extract', async (req, res) => {
  try {
    const { text, rolePreferences, options } = req.body;
    const userId = req.user.id;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text content is required'
      });
    }

    console.log('🔍 Extraction request from user:', userId);
    console.log('📄 Text length:', text.length);

    // Check usage limits before processing
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    // Convert text to buffer for processing
    const textBuffer = Buffer.from(text, 'utf-8');
    const result = await extractionService.extractContacts(
      textBuffer, 
      'text/plain', 
      'extracted-text.txt', 
      options || {}
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Save extracted contacts to database
    if (result.contacts && result.contacts.length > 0) {
      try {
        // Create a job record for this extraction
        const job = await prisma.job.create({
          data: {
            userId,
            title: `Text Extraction - ${new Date().toLocaleDateString()}`,
            status: 'COMPLETED'
          }
        });

        // Save contacts to database
        await extractionService.saveContacts(result.contacts, userId, job.id);

        // Update usage tracking
        await usageService.incrementUsage(userId, 'upload', 1);

        console.log('✅ Contacts saved to database:', result.contacts.length);

      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
        // Don't fail the extraction if database save fails
      }
    }

    res.json({
      success: true,
      contacts: result.contacts,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ Extraction route error:', error);
    res.status(500).json({
      success: false,
      error: 'Extraction failed'
    });
  }
});

/**
 * GET /api/extraction/history
 * Get extraction history for the user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const jobs = await prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      include: {
        contacts: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            company: true
          }
        }
      }
    });

    const totalJobs = await prisma.job.count({
      where: { userId }
    });

    res.json({
      success: true,
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalJobs,
        pages: Math.ceil(totalJobs / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ History route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch extraction history'
    });
  }
});

/**
 * GET /api/extraction/contacts/:jobId
 * Get contacts for a specific job
 */
router.get('/contacts/:jobId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Verify job belongs to user
    const job = await prisma.job.findFirst({
      where: { 
        id: jobId,
        userId 
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    const contacts = await prisma.contact.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      contacts
    });

  } catch (error) {
    console.error('❌ Contacts route error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

/**
 * DELETE /api/extraction/job/:jobId
 * Delete a job and its contacts
 */
router.delete('/job/:jobId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId } = req.params;

    // Verify job belongs to user
    const job = await prisma.job.findFirst({
      where: { 
        id: jobId,
        userId 
      }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Delete job (contacts will be deleted via cascade)
    await prisma.job.delete({
      where: { id: jobId }
    });

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete job'
    });
  }
});

/**
 * POST /api/extraction/upload-ai
 * Upload and extract contacts using AI-only method
 */
router.post('/upload-ai', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check usage limits
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    const fileBuffer = req.file.buffer;
    const result = await optimizedAIExtractionService.extractContacts(
      fileBuffer, 
      req.file.mimetype, 
      req.file.originalname, 
      { ...options, method: 'ai' }
    );

    // Save contacts to database
    let jobId = null;
    if (result.success && result.contacts && result.contacts.length > 0) {
      try {
        const job = await prisma.job.create({
          data: {
            userId,
            title: `AI Extraction - ${req.file.originalname}`,
            fileName: req.file.originalname,
            status: 'COMPLETED'
          }
        });

        jobId = job.id;
        await extractionService.saveContacts(result.contacts, userId, jobId);
        await usageService.incrementUsage(userId, 'upload', 1);
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
      }
    }

    // No cleanup needed with memory storage

    res.json({
      success: result.success,
      contacts: result.contacts || [],
      jobId: jobId,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ AI extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'AI extraction failed'
    });
  }
});

/**
 * POST /api/extraction/upload-aws-textract
 * Upload and extract contacts using AWS Textract + AI
 */
router.post('/upload-aws-textract', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check usage limits
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    const fileBuffer = req.file.buffer;
    
    // Step 1: Extract text with AWS Textract
    const textractResult = await awsTextractService.extractTextFromDocument(
      fileBuffer, 
      req.file.mimetype, 
      req.file.originalname, 
      options || {}
    );

    if (!textractResult.success) {
      return res.status(500).json({
        success: false,
        error: `AWS Textract failed: ${textractResult.error}`
      });
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

    // Save contacts to database
    let jobId = null;
    if (contacts.length > 0) {
      try {
        const job = await prisma.job.create({
          data: {
            userId,
            title: `AWS Textract Extraction - ${req.file.originalname}`,
            fileName: req.file.originalname,
            status: 'COMPLETED'
          }
        });

        jobId = job.id;
        await extractionService.saveContacts(contacts, userId, jobId);
        await usageService.incrementUsage(userId, 'upload', 1);
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
      }
    }

    res.json({
      success: true,
      contacts: contacts,
      jobId: jobId,
      metadata: {
        extractionMethod,
        textractMetadata: textractResult.metadata,
        textLength: textractResult.text.length
      }
    });

  } catch (error) {
    console.error('❌ AWS Textract extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'AWS Textract extraction failed'
    });
  }
});

/**
 * POST /api/extraction/upload-adaptive
 * Upload and extract contacts using adaptive intelligence system
 */
router.post('/upload-adaptive', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check usage limits
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    const fileBuffer = req.file.buffer;
    const result = await adaptiveExtractionService.extractContacts(
      fileBuffer, 
      req.file.mimetype, 
      req.file.originalname, 
      { ...options, rolePreferences }
    );

    // Save contacts to database
    let jobId = null;
    if (result.success && result.contacts && result.contacts.length > 0) {
      try {
        const job = await prisma.job.create({
          data: {
            userId,
            title: `Adaptive Extraction - ${req.file.originalname}`,
            fileName: req.file.originalname,
            status: 'COMPLETED'
          }
        });

        jobId = job.id;
        await extractionService.saveContacts(result.contacts, userId, jobId);
        await usageService.incrementUsage(userId, 'upload', 1);
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
      }
    }

    res.json({
      success: result.success,
      contacts: result.contacts || [],
      jobId: jobId,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ Adaptive extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'Adaptive extraction failed'
    });
  }
});

/**
 * POST /api/extraction/upload-pattern
 * Upload and extract contacts using pattern-only method
 */
router.post('/upload-pattern', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { rolePreferences, options } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check usage limits
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    const fileBuffer = req.file.buffer;
    const result = await extractionService.extractContacts(
      fileBuffer, 
      req.file.mimetype, 
      req.file.originalname, 
      { ...options, method: 'pattern' }
    );

    // Save contacts to database
    let jobId = null;
    if (result.success && result.contacts && result.contacts.length > 0) {
      try {
        const job = await prisma.job.create({
          data: {
            userId,
            title: `Pattern Extraction - ${req.file.originalname}`,
            fileName: req.file.originalname,
            status: 'COMPLETED'
          }
        });

        jobId = job.id;
        await extractionService.saveContacts(result.contacts, userId, jobId);
        await usageService.incrementUsage(userId, 'upload', 1);
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
      }
    }

    // No cleanup needed with memory storage

    res.json({
      success: result.success,
      contacts: result.contacts || [],
      jobId: jobId,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('❌ Pattern extraction error:', error);
    res.status(500).json({
      success: false,
      error: 'Pattern extraction failed'
    });
  }
});

/**
 * GET /api/extraction/methods
 * Get available extraction methods and their capabilities
 */
router.get('/methods', (req, res) => {
  try {
    const hybridHealth = hybridExtractionService.getHealthStatus();
    const adaptiveHealth = adaptiveExtractionService.getHealthStatus();
    const aiHealth = optimizedAIExtractionService.getHealthStatus();
    const awsTextractHealth = awsTextractService.getHealthStatus();
    const patternHealth = extractionService.getHealthStatus();
    
    const methods = {
      adaptive: {
        name: 'Adaptive Intelligence Extraction',
        description: 'AI-powered system that automatically detects document type and selects optimal extraction strategy',
        available: adaptiveHealth.available,
        capabilities: ['Auto document detection', 'Smart strategy selection', 'Pattern + AI hybrid', 'Learning system'],
        bestFor: ['Any document type', 'Unknown formats', 'Maximum accuracy', 'Production use'],
        processingTime: '3-15 seconds',
        accuracy: '95-98%',
        cost: 'Variable based on complexity'
      },
      hybrid: {
        name: 'Hybrid Extraction',
        description: 'Intelligently combines AI and pattern extraction for optimal results',
        available: hybridHealth.hybrid,
        capabilities: ['Best accuracy', 'Automatic fallback', 'Cost optimization'],
        bestFor: ['Any document type', 'Production use', 'High accuracy needs'],
        processingTime: '5-30 seconds',
        accuracy: '90-95%',
        cost: 'Variable based on document'
      },
      ai: {
        name: 'AI Extraction (GPT-4o Mini)',
        description: 'Advanced AI-powered extraction with rate limiting and cost optimization',
        available: aiHealth.available,
        capabilities: ['Context understanding', 'High accuracy', 'Scanned PDF support', 'Rate limited'],
        bestFor: ['Complex documents', 'Scanned PDFs', 'High accuracy needs'],
        processingTime: '10-60 seconds',
        accuracy: '92-96%',
        cost: '$0.10-0.50 per document',
        limitations: {
          rateLimit: '3 requests per minute',
          tokenLimit: '60k tokens per minute',
          contextWindow: '128k tokens'
        }
      },
      awsTextract: {
        name: 'AWS Textract + AI',
        description: 'Enterprise OCR with AWS Textract followed by AI contact extraction',
        available: awsTextractHealth.available,
        capabilities: ['Superior OCR', 'Table detection', 'Form analysis', 'Scanned PDFs', 'High accuracy'],
        bestFor: ['Scanned PDFs', 'Complex documents', 'Tables', 'Forms', 'Production documents'],
        processingTime: '5-15 seconds',
        accuracy: '95-98%',
        cost: '$1.50 per 1,000 pages (1,000 pages free/month)',
        limitations: {
          requiresAWS: 'AWS credentials and S3 bucket required',
          fileTypes: 'PDF, JPG, PNG, TIFF only',
          maxFileSize: '10MB per page'
        }
      },
      pattern: {
        name: 'Pattern Extraction',
        description: 'Fast pattern-based extraction optimized for call sheets',
        available: patternHealth.initialized,
        capabilities: ['Fast processing', 'No API limits', 'Reliable', 'Cost-effective'],
        bestFor: ['Call sheets', 'Simple documents', 'High volume'],
        processingTime: '1-5 seconds',
        accuracy: '85-92%',
        cost: 'Free'
      }
    };

    res.json({
      success: true,
      methods: methods,
      health: {
        hybrid: hybridHealth,
        ai: aiHealth,
        pattern: patternHealth
      }
    });

  } catch (error) {
    console.error('❌ Methods endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get extraction methods'
    });
  }
});

/**
 * GET /api/extraction/health
 * Get extraction service health status
 */
router.get('/health', (req, res) => {
  try {
    const hybridHealth = hybridExtractionService.getHealthStatus();
    const aiHealth = optimizedAIExtractionService.getHealthStatus();
    const awsTextractHealth = awsTextractService.getHealthStatus();
    const patternHealth = extractionService.getHealthStatus();
    
    res.json({
      success: true,
      health: {
        hybrid: hybridHealth,
        ai: aiHealth,
        awsTextract: awsTextractHealth,
        pattern: patternHealth,
        overall: {
          status: hybridHealth.hybrid ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/extraction/job/:jobId
 * Get job status and results
 */
router.get('/job/:jobId', async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Queue-based job status is deprecated. Upload processing is now synchronous.',
  });
});

/**
 * DELETE /api/extraction/job/:jobId
 * Cancel a queued job
 */
router.delete('/job/:jobId', async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Queue-based job cancellation is deprecated. Upload processing is now synchronous.',
  });
});

/**
 * GET /api/extraction/queue/stats
 * Get queue statistics (admin only)
 */
router.get('/queue/stats', async (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Queue statistics endpoint is deprecated. Queue has been removed.'
  });
});

/**
 * GET /api/extraction/progress/:extractionId
 * Get extraction progress (for debugging)
 */
router.get('/progress/:extractionId', async (req, res) => {
  try {
    const { extractionId } = req.params;
    
    // This is a simple implementation - in production you'd want to store progress in Redis or DB
    res.json({
      success: true,
      extractionId,
      status: 'processing',
      message: 'Extraction in progress...',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get progress'
    });
  }
});

/**
 * GET /api/extraction/migration-status
 * Get enterprise migration status for current user
 */
router.get('/migration-status', async (req, res) => {
  try {
    const userId = req.user.id;
    const status = migrationService.getMigrationStatus(userId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status'
    });
  }
});

/**
 * POST /api/extraction/force-migration
 * Force migration to enterprise or legacy system (admin only)
 */
router.post('/force-migration', async (req, res) => {
  try {
    const userId = req.user.id;
    const { direction = 'enterprise' } = req.body;
    
    // In production, you'd want to check admin permissions here
    const status = await migrationService.forceMigration(userId, direction);
    
    res.json({
      success: true,
      message: `Migration forced to ${direction} system`,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to force migration'
    });
  }
});

module.exports = router;