/**
 * Text Extraction Routes
 * 
 * Handles text-based extraction requests (no file upload)
 * Client-side text extraction sends extracted text directly to this endpoint
 */

const express = require('express');
const router = express.Router();
const migrationService = require('../services/enterprise/ExtractionMigrationService');
const usageService = require('../services/usage.service');
const extractionPersistence = require('../services/database/ExtractionPersistence.service');
const concurrencyLimiter = require('../middleware/ConcurrencyLimiter');
const { smartRateLimit } = require('../middleware/RateLimiter');
const performanceMonitor = require('../utils/PerformanceMonitor');
const winston = require('winston');
const { PrismaClient } = require('@prisma/client');
const extractionService = require('../services/extraction-refactored.service');

const prisma = new PrismaClient();

// Configure logger
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

// Ensure a Profile row exists for a given userId (Job.userId references Profile.userId)
const ensureProfileForUser = async (userId) => {
  try {
    await prisma.profile.upsert({
      where: { userId },
      update: {},
      create: { userId }
    });
  } catch (e) {
    logger.error('❌ Failed to ensure profile for user:', { userId, error: e.message });
    throw e;
  }
};

/**
 * POST /api/extraction/process-text
 * Process extracted text for contact extraction
 */
// ⭐ TIER 1 FIX #4: Rate limiting prevents abuse
router.post('/process-text', smartRateLimit('textExtraction'), async (req, res) => {
  // ⭐ TIER 1 FIX #5: Performance timing and logging
  const operationId = `text_extraction_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const perfStop = performanceMonitor.start(operationId, {
    userId: req.user?.id,
    operationType: 'text_extraction'
  });
  
  const startTime = Date.now();
  
  try {
    const userId = req.user?.id;
    const { 
      text, 
      fileName, 
      fileType, 
      extractionMethod = 'hybrid',
      rolePreferences = [],
      clientSideContacts = [], // ✅ RECEIVE CLIENT-SIDE CONTACTS
      options = {},
      priority = 'normal'
    } = req.body;

    logger.info('📝 Text processing request received', {
      userId,
      fileName,
      fileType,
      textLength: text?.length || 0,
      extractionMethod,
      hasRolePreferences: Array.isArray(rolePreferences) && rolePreferences.length > 0,
      clientSideContactsReceived: Array.isArray(clientSideContacts) ? clientSideContacts.length : 0 // ✅ LOG CLIENT CONTACTS
    });

    // Validate required fields
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text content is required and must be a string'
      });
    }

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'File name is required'
      });
    }

    // Validate text length (max 1MB of text)
    const maxTextLength = 1024 * 1024; // 1MB
    if (text.length > maxTextLength) {
      return res.status(400).json({
        success: false,
        error: `Text too long. Maximum length is ${maxTextLength} characters`
      });
    }

    // Check usage limits before processing
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({ 
        success: false, 
        error: canProcess.reason,
        requiresUpgrade: true
      });
    }

    // Parse options if it's a string
    let parsedOptions = {};
    if (options) {
      try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
        logger.info('📁 Parsed options:', parsedOptions);
      } catch (error) {
        logger.warn('⚠️ Failed to parse options, using empty object:', error.message);
        parsedOptions = {};
      }
    }

    // Parse role preferences if it's a string
    let parsedRolePreferences = [];
    if (rolePreferences) {
      try {
        parsedRolePreferences = typeof rolePreferences === 'string' 
          ? JSON.parse(rolePreferences) 
          : rolePreferences;
        
        if (!Array.isArray(parsedRolePreferences)) {
          parsedRolePreferences = [];
        }
        
        logger.info('📁 Parsed role preferences:', parsedRolePreferences);
      } catch (error) {
        logger.warn('⚠️ Failed to parse role preferences, using empty array:', error.message);
        parsedRolePreferences = [];
      }
    }

    // Determine document type from file type and content
    const documentType = determineDocumentType(fileType, text);
    
    // Prepare extraction options
    const extractionOptions = {
      userId,
      fileName,
      mimeType: fileType,
      fileSize: text.length, // Use text length as file size proxy
      extractionId: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rolePreferences: parsedRolePreferences,
      documentType,
      maxContacts: 1000,
      maxProcessingTime: 60000, // 60 seconds timeout for AI processing
      clientSideContacts: Array.isArray(clientSideContacts) ? clientSideContacts : [], // ✅ PASS CLIENT CONTACTS TO EXTRACTION
      forceAI: parsedOptions.forceAI || false, // ✅ Pass forceAI flag to extraction service
      ...parsedOptions
    };

    logger.info('🔄 Starting text-based contact extraction', {
      extractionId: extractionOptions.extractionId,
      documentType,
      textLength: text.length,
      rolePreferences: parsedRolePreferences.length
    });

    // ⭐ TIER 1 FIX #3: Concurrency limits
    // Prevents server overload from too many simultaneous extractions
    const result = await concurrencyLimiter.execute(
      userId,
      async () => {
        // Perform contact extraction using migration service
        const extractionPromise = migrationService.extractContacts(text, extractionOptions);
        
        // Set timeout for extraction
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Extraction timeout - processing took too long'));
          }, extractionOptions.maxProcessingTime);
        });

        // Wait for extraction with timeout
        return await Promise.race([extractionPromise, timeoutPromise]);
      },
      {
        fileName,
        textLength: text.length,
        operation: 'text_extraction'
      }
    );
    
    const processingTime = Date.now() - startTime;
    
    logger.info('✅ Text-based extraction completed', {
      extractionId: extractionOptions.extractionId,
      contactsFound: result.contacts?.length || 0,
      processingTime: `${processingTime}ms`,
      strategy: result.metadata?.strategy || 'unknown'
    });

    // ✅ FAIL-SAFE: If server-side extraction returned 0 contacts but we have client-side contacts,
    // fall back to client-side contacts so the user still gets persisted data.
    if ((!result.contacts || result.contacts.length === 0) && extractionOptions.clientSideContacts.length > 0) {
      logger.warn('⚠️ No contacts from server extraction, falling back to client-side contacts', {
        extractionId: extractionOptions.extractionId,
        clientSideContacts: extractionOptions.clientSideContacts.length
      });

      result.contacts = extractionOptions.clientSideContacts;
    }

    // Record usage
    await usageService.incrementUsage(userId, 'upload', 1);
    if (result.contacts?.length > 0) {
      await usageService.incrementUsage(userId, 'contact_extraction', result.contacts.length);
    }

    // ✅ CHECK: Skip saving if skipSave option is set (for editing workflow)
    const skipSave = parsedOptions.skipSave === true;
    
    // ⭐ TIER 1 FIX #1: Atomic database transaction
    // Prevents data corruption from partial failures
    let jobId = null;
    let savedContacts = [];
    
    if (!skipSave && result.contacts && result.contacts.length > 0) {
      try {
        logger.info('💾 Saving contacts atomically', {
          userId,
          contactCount: result.contacts.length,
          fileName,
          extractionId: extractionOptions.extractionId
        });

        const saveResult = await extractionPersistence.saveExtractionWithTransaction({
          userId,
          fileData: {
            originalname: fileName,
            mimetype: 'text/plain',
            size: text.length
          },
          extractionResult: result,
          options: {
            title: `Text Extraction - ${fileName}`,
            startedAt: new Date()
          }
        });
        
        jobId = saveResult.job.id;
        savedContacts = saveResult.contacts;
        
        logger.info('✅ Extraction saved atomically', {
          userId,
          jobId,
          contactsSaved: savedContacts.length
        });
        
      } catch (dbError) {
        logger.error('❌ Atomic save failed - transaction rolled back', {
          userId,
          fileName,
          error: dbError.message
        });
        // Don't fail the request, just log the error
        // Contacts are still returned in response for immediate use
      }
    } else if (skipSave) {
      logger.info('⏭️ Skipping save (skipSave=true) - contacts will be saved after user review', {
        userId,
        fileName,
        contactCount: result.contacts?.length || 0
      });
    } else {
      logger.warn('⚠️ No contacts to save', {
        userId,
        fileName,
        contactCount: result.contacts?.length || 0
      });
    }

    // Transform result to match expected format
    const response = {
      success: result.success !== false,
      jobId: jobId,  // ⭐ ADD jobId to response
      contacts: result.contacts || [],
      metadata: {
        ...result.metadata,
        extractionMethod: 'text-processing',
        processingTime,
        textLength: text.length,
        fileName,
        fileType,
        documentType
      },
      usage: {
        uploadsUsed: 1,
        uploadsLimit: canProcess.limit || 1,
        contactsExtracted: result.contacts?.length || 0
      },
      documentType,
      productionType: 'text-extraction'
    };
    
    // Stop performance monitoring and log results
    perfStop({
      success: true,
      contactCount: result.contacts?.length || 0,
      jobId,
      processingTime
    });

    res.json(response);

  } catch (error) {
    // Log performance even on error
    perfStop({
      success: false,
      error: error.message
    });
    const processingTime = Date.now() - startTime;
    
    logger.error('❌ Text processing error', {
      userId: req.user?.id,
      error: error.message,
      processingTime: `${processingTime}ms`,
      stack: error.stack
    });

    // Handle specific error types
    if (error.message.includes('timeout')) {
      return res.status(408).json({
        success: false,
        error: 'Processing timeout - the document is too complex or large. Please try with a smaller document or contact support.',
        code: 'PROCESSING_TIMEOUT'
      });
    }

    if (error.message.includes('usage limit')) {
      return res.status(403).json({
        success: false,
        error: error.message,
        requiresUpgrade: true,
        code: 'USAGE_LIMIT_EXCEEDED'
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      error: 'Text processing failed. Please try again or contact support if the issue persists.',
      code: 'PROCESSING_ERROR'
    });
  }
});

/**
 * POST /api/extraction/validate-text
 * Validate text content before processing
 */
router.post('/validate-text', async (req, res) => {
  try {
    const { text, fileName, fileType } = req.body;

    // Basic validation
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {}
    };

    // Check text content
    if (!text || typeof text !== 'string') {
      validation.isValid = false;
      validation.errors.push('Text content is required and must be a string');
    } else {
      // Check text length
      if (text.length === 0) {
        validation.isValid = false;
        validation.errors.push('Text content cannot be empty');
      } else if (text.length > 1024 * 1024) { // 1MB
        validation.isValid = false;
        validation.errors.push('Text content is too long (maximum 1MB)');
      } else {
        validation.metadata.textLength = text.length;
        validation.metadata.estimatedContacts = estimateContactCount(text);
      }
    }

    // Check file name
    if (!fileName || typeof fileName !== 'string') {
      validation.isValid = false;
      validation.errors.push('File name is required');
    }

    // Check file type
    if (!fileType || typeof fileType !== 'string') {
      validation.warnings.push('File type not specified');
    } else {
      validation.metadata.fileType = fileType;
      validation.metadata.documentType = determineDocumentType(fileType, text);
    }

    // Add warnings for potential issues
    if (text && text.length < 100) {
      validation.warnings.push('Text content is very short - extraction results may be limited');
    }

    if (text && text.length > 100000) {
      validation.warnings.push('Text content is very long - processing may take longer');
    }

    res.json({
      success: true,
      validation
    });

  } catch (error) {
    logger.error('❌ Text validation error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Text validation failed'
    });
  }
});

/**
 * GET /api/extraction/text-capabilities
 * Get text processing capabilities and limits
 */
router.get('/text-capabilities', async (req, res) => {
  try {
    const capabilities = {
      maxTextLength: 1024 * 1024, // 1MB
      maxProcessingTime: 15000, // 15 seconds
      supportedFileTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/tiff',
        'image/webp'
      ],
      extractionMethods: [
        'hybrid',
        'pattern-only',
        'ai-enhanced'
      ],
      features: [
        'client-side-text-extraction',
        'pattern-based-extraction',
        'ai-enhanced-extraction',
        'role-preference-filtering',
        'confidence-scoring'
      ]
    };

    res.json({
      success: true,
      capabilities
    });

  } catch (error) {
    logger.error('❌ Capabilities request error', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get capabilities'
    });
  }
});

/**
 * Determine document type from file type and content
 */
function determineDocumentType(fileType, text) {
  // Check file type first
  if (fileType === 'application/pdf') {
    return 'pdf-document';
  } else if (fileType && fileType.startsWith('image/')) {
    return 'image-document';
  }

  // Analyze text content for document type
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('call sheet') || lowerText.includes('call sheet')) {
    return 'call-sheet';
  } else if (lowerText.includes('crew list') || lowerText.includes('crewlist')) {
    return 'crew-list';
  } else if (lowerText.includes('contact list') || lowerText.includes('contactlist')) {
    return 'contact-list';
  } else if (lowerText.includes('production') && lowerText.includes('schedule')) {
    return 'production-schedule';
  } else if (lowerText.includes('talent') && lowerText.includes('list')) {
    return 'talent-list';
  } else if (lowerText.includes('vendor') || lowerText.includes('supplier')) {
    return 'vendor-list';
  }

  return 'general-document';
}

/**
 * Estimate contact count from text content
 */
function estimateContactCount(text) {
  const lowerText = text.toLowerCase();
  
  // Count potential email addresses
  const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
  const emailCount = emailMatches ? emailMatches.length : 0;
  
  // Count potential phone numbers
  const phoneMatches = text.match(/[\+]?[1-9][\d]{0,15}/g);
  const phoneCount = phoneMatches ? phoneMatches.length : 0;
  
  // Count potential names (simple heuristic)
  const nameMatches = lowerText.match(/\b[a-z]+ [a-z]+\b/g);
  const nameCount = nameMatches ? nameMatches.length : 0;
  
  // Estimate based on the minimum of these counts
  return Math.min(emailCount, phoneCount, nameCount) || 0;
}

/**
 * POST /api/extraction/save-contacts
 * Save contacts after user review and editing
 * This endpoint is called after the user has reviewed and edited contacts
 */
router.post('/save-contacts', smartRateLimit('textExtraction'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user?.id;
    const { contacts, fileName, jobId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Contacts array is required and must not be empty'
      });
    }

    logger.info('💾 Saving contacts after user review', {
      userId,
      contactCount: contacts.length,
      fileName,
      existingJobId: jobId
    });

    // Ensure profile exists
    await ensureProfileForUser(userId);

    let finalJobId = jobId;

    // If no jobId provided, create a new job
    if (!finalJobId) {
      const job = await prisma.job.create({
        data: {
          userId,
          title: fileName ? `Extraction - ${fileName}` : `Extraction - ${new Date().toLocaleDateString()}`,
          fileName: fileName || 'extracted-contacts',
          status: 'COMPLETED'
        }
      });
      finalJobId = job.id;
      logger.info('✅ Created new job for saved contacts', { jobId: finalJobId });
    } else {
      // Update existing job if needed
      await prisma.job.update({
        where: { id: finalJobId },
        data: {
          status: 'COMPLETED',
          fileName: fileName || undefined
        }
      }).catch(err => {
        logger.warn('⚠️ Failed to update existing job', { jobId: finalJobId, error: err.message });
      });
    }

    // Prepare contacts data
    const contactsData = contacts.map(contact => ({
      jobId: finalJobId,
      userId,
      name: contact.name || '',
      email: contact.email && contact.email.trim() !== '' ? contact.email : null,
      phone: contact.phone && contact.phone.trim() !== '' ? contact.phone : null,
      role: contact.role || null,
      company: contact.company || null,
      isSelected: true
    }));

    // Delete existing contacts for this job (if updating)
    if (jobId) {
      await prisma.contact.deleteMany({
        where: { jobId: finalJobId }
      });
      logger.info('🗑️ Deleted existing contacts for job', { jobId: finalJobId });
    }

    // Save contacts
    await prisma.contact.createMany({
      data: contactsData,
      skipDuplicates: true
    });

    logger.info('✅ Contacts saved successfully', {
      userId,
      jobId: finalJobId,
      contactCount: contactsData.length,
      processingTime: `${Date.now() - startTime}ms`
    });

    return res.json({
      success: true,
      jobId: finalJobId,
      contactsSaved: contactsData.length
    });

  } catch (error) {
    logger.error('❌ Failed to save contacts', {
      error: error.message,
      stack: error.stack,
      processingTime: `${Date.now() - startTime}ms`
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save contacts'
    });
  }
});

module.exports = router;
