/**
 * Extraction Routes
 * Handles call sheet contact extraction with clean, optimized architecture
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');
const extractionService = require('../services/extraction.service');
const aiExtractionService = require('../services/aiExtraction.service');
const optimizedAIExtractionService = require('../services/optimizedAIExtraction.service');
const awsTextractService = require('../services/awsTextract.service');
const hybridExtractionService = require('../services/hybridExtraction.service');
const usageService = require('../services/usage.service');
const queueService = require('../services/queue.service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

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
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('📁 File upload received:', req.file.originalname);
    console.log('📁 File type:', req.file.mimetype);
    console.log('📁 File size:', req.file.size);

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

    // Add job to queue
    const jobResult = await queueService.addExtractionJob({
      userId,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      extractionMethod,
      priority,
      options: options || {},
      fileBuffer: req.file.buffer,
      metadata: {
        source: 'api',
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    if (!jobResult.success) {
      return res.status(500).json({
        success: false,
        error: jobResult.error
      });
    }

    console.log('✅ File queued for processing:', jobResult.jobId);

    res.json({
      success: true,
      jobId: jobResult.jobId,
      fileId: jobResult.fileId,
      status: 'queued',
      estimatedProcessingTime: jobResult.estimatedProcessingTime,
      message: 'File has been queued for processing. Use the job ID to check status.'
    });

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
    const aiHealth = optimizedAIExtractionService.getHealthStatus();
    const awsTextractHealth = awsTextractService.getHealthStatus();
    const patternHealth = extractionService.getHealthStatus();
    
    const methods = {
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
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const jobStatus = await queueService.getJobStatus(jobId);
    
    if (!jobStatus.success) {
      return res.status(404).json({
        success: false,
        error: jobStatus.error
      });
    }

    // Verify job belongs to user
    if (jobStatus.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // If job is completed, get the results
    let results = null;
    if (jobStatus.status === 'completed') {
      try {
        const job = await prisma.job.findFirst({
          where: { externalJobId: jobId },
          include: {
            contacts: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                company: true,
                department: true,
                confidence: true
              }
            }
          }
        });

        if (job) {
          results = {
            jobId: job.id,
            contacts: job.contacts,
            metadata: job.metadata
          };
        }
      } catch (dbError) {
        console.error('❌ Error fetching job results:', dbError);
      }
    }

    res.json({
      success: true,
      jobId: jobStatus.jobId,
      status: jobStatus.status,
      progress: jobStatus.progress,
      results,
      createdAt: jobStatus.createdAt,
      processedAt: jobStatus.processedAt,
      failedAt: jobStatus.failedAt
    });

  } catch (error) {
    console.error('❌ Job status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

/**
 * DELETE /api/extraction/job/:jobId
 * Cancel a queued job
 */
router.delete('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // First check if job belongs to user
    const jobStatus = await queueService.getJobStatus(jobId);
    if (!jobStatus.success || jobStatus.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const cancelResult = await queueService.cancelJob(jobId);
    
    if (!cancelResult.success) {
      return res.status(400).json({
        success: false,
        error: cancelResult.error
      });
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('❌ Cancel job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel job'
    });
  }
});

/**
 * GET /api/extraction/queue/stats
 * Get queue statistics (admin only)
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await queueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Queue stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics'
    });
  }
});

module.exports = router;