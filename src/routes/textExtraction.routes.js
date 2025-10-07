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
const winston = require('winston');

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

/**
 * POST /api/extraction/process-text
 * Process extracted text for contact extraction
 */
router.post('/process-text', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user?.id;
    const { 
      text, 
      fileName, 
      fileType, 
      extractionMethod = 'hybrid',
      rolePreferences = [],
      options = {},
      priority = 'normal'
    } = req.body;

    logger.info('📝 Text processing request received', {
      userId,
      fileName,
      fileType,
      textLength: text?.length || 0,
      extractionMethod,
      hasRolePreferences: Array.isArray(rolePreferences) && rolePreferences.length > 0
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
      ...parsedOptions
    };

    logger.info('🔄 Starting text-based contact extraction', {
      extractionId: extractionOptions.extractionId,
      documentType,
      textLength: text.length,
      rolePreferences: parsedRolePreferences.length
    });

    // Perform contact extraction using migration service
    const extractionPromise = migrationService.extractContacts(text, extractionOptions);
    
    // Set timeout for extraction
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Extraction timeout - processing took too long'));
      }, extractionOptions.maxProcessingTime);
    });

    // Wait for extraction with timeout
    const result = await Promise.race([extractionPromise, timeoutPromise]);
    
    const processingTime = Date.now() - startTime;
    
    logger.info('✅ Text-based extraction completed', {
      extractionId: extractionOptions.extractionId,
      contactsFound: result.contacts?.length || 0,
      processingTime: `${processingTime}ms`,
      strategy: result.metadata?.strategy || 'unknown'
    });

    // Record usage
    await usageService.incrementUsage(userId, 'upload', 1);
    if (result.contacts?.length > 0) {
      await usageService.incrementUsage(userId, 'contact_extraction', result.contacts.length);
    }

    // Transform result to match expected format
    const response = {
      success: result.success !== false,
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

    res.json(response);

  } catch (error) {
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

module.exports = router;
