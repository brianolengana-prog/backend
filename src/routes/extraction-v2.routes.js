/**
 * Extraction Routes V2 (New Architecture)
 * 
 * Test routes for new extraction domain architecture
 * Can be enabled alongside existing routes for testing
 * 
 * Best Practice: Gradual migration with parallel routes
 */

const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const ExtractionService = require('../domains/extraction/services/ExtractionService');
const ExtractionStrategyFactory = require('../domains/extraction/services/ExtractionStrategyFactory');
const ExtractionJobRepository = require('../domains/extraction/repositories/ExtractionJobRepository');
const ContactRepository = require('../domains/contacts/repositories/ContactRepository');
const featureFlags = require('../shared/infrastructure/features/feature-flags.service');
const { calculateFileHash } = require('../utils/fileHash');
const usageService = require('../services/usage.service');
const logger = require('../shared/infrastructure/logger/logger.service');
const { asyncHandler } = require('../utils/errorHandler');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Initialize services
const strategyFactory = new ExtractionStrategyFactory();
const extractionService = new ExtractionService({
  strategyFactory
});
const jobRepository = new ExtractionJobRepository();
const contactRepository = new ContactRepository();

/**
 * POST /api/extraction/v2/upload
 * Upload and extract using new architecture
 * 
 * Feature flag controlled - only works if USE_NEW_EXTRACTION is enabled
 */
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { options } = req.body;

  // Check feature flag
  const useNewArchitecture = featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId);
  if (!useNewArchitecture) {
    return res.status(403).json({
      success: false,
      error: 'New extraction architecture not enabled for this user',
      useLegacyEndpoint: '/api/extraction/upload'
    });
  }

  // Validate file
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  logger.info('Using new extraction architecture', {
    userId,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });

  try {
    // Check for duplicate file
    const fileHash = calculateFileHash(req.file.buffer);
    const recentJob = await jobRepository.findRecentByFileHash(userId, fileHash);

    if (recentJob && recentJob.isRecent()) {
      logger.info('Serving cached extraction', {
        userId,
        jobId: recentJob.id,
        cacheAge: recentJob.getAge()
      });

      const contacts = await contactRepository.findByJobId(recentJob.id);
      
      return res.json({
        success: true,
        jobId: recentJob.id,
        status: 'completed',
        result: {
          contacts: contacts.map(c => ({
            name: c.name,
            email: c.email,
            phone: c.phone,
            role: c.role,
            company: c.company
          })),
          metadata: {
            fromCache: true,
            cacheAge: recentJob.getAge(),
            strategy: 'cached'
          }
        },
        cached: true
      });
    }

    // Check usage limits
    const canProcess = await usageService.canPerformAction(userId, 'upload', 1);
    if (!canProcess.canPerform) {
      return res.status(403).json({
        success: false,
        error: canProcess.reason || 'Upload limit exceeded',
        requiresUpgrade: true
      });
    }

    // Extract contacts using new service
    const extractionResult = await extractionService.extractContacts(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      {
        ...(options ? (typeof options === 'string' ? JSON.parse(options) : options) : {}),
        extractionId: `v2_${Date.now()}`,
        userId
      }
    );

    if (!extractionResult.isSuccessful()) {
      return res.status(422).json({
        success: false,
        error: extractionResult.error || 'Extraction failed',
        metadata: extractionResult.metadata
      });
    }

    // Save to database
    let jobId = null;
    if (extractionResult.hasContacts()) {
      try {
        // Create job
        const job = await jobRepository.createAsEntity({
          userId,
          title: `Extraction - ${req.file.originalname}`,
          fileName: req.file.originalname,
          fileHash,
          fileSize: req.file.size,
          status: 'PROCESSING'
        });

        jobId = job.id;

        // Save contacts
        const contactsToSave = extractionResult.contacts.map(contact => ({
          jobId,
          userId,
          name: contact.name || '',
          email: contact.email || null,
          phone: contact.phone || null,
          role: contact.role || null,
          company: contact.company || null,
          isSelected: true
        }));

        await contactRepository.getModel().createMany({
          data: contactsToSave,
          skipDuplicates: true
        });

        // Mark job as completed
        await jobRepository.markCompleted(jobId, extractionResult.getContactCount());

        logger.info('Extraction saved successfully', {
          userId,
          jobId,
          contactCount: extractionResult.getContactCount()
        });
      } catch (dbError) {
        logger.error('Failed to save extraction', dbError, {
          userId,
          jobId
        });
        // Continue - return contacts even if save failed
      }
    }

    // Update usage
    await usageService.incrementUsage(userId, 'upload', 1);
    if (extractionResult.hasContacts()) {
      await usageService.incrementUsage(userId, 'contact_extraction', extractionResult.getContactCount());
    }

    // Return result
    return res.json({
      success: true,
      jobId,
      status: 'completed',
      result: {
        contacts: extractionResult.contacts,
        metadata: {
          ...extractionResult.metadata,
          architecture: 'v2',
          strategy: extractionResult.metadata.strategy
        }
      }
    });

  } catch (error) {
    logger.error('V2 extraction failed', error, {
      userId,
      fileName: req.file?.originalname
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Extraction failed',
      architecture: 'v2'
    });
  }
}));

/**
 * GET /api/extraction/v2/strategies
 * Get available extraction strategies
 */
router.get('/strategies', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const documentAnalysis = {
    type: 'call_sheet',
    complexity: 'medium'
  };

  const strategies = await strategyFactory.getAvailableStrategies(documentAnalysis);
  const recommendations = await strategyFactory.getRecommendations(documentAnalysis);

  res.json({
    success: true,
    strategies: strategies.map(s => ({
      name: s.name,
      confidence: s.confidence,
      available: s.available,
      cost: s.cost,
      speed: s.speed
    })),
    recommendations: {
      best: recommendations.best ? {
        name: recommendations.best.name,
        confidence: recommendations.best.confidence
      } : null,
      reasoning: recommendations.reasoning
    },
    featureFlag: {
      enabled: featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId),
      percentage: featureFlags.getAllFlags().USE_NEW_EXTRACTION_PERCENTAGE || 0
    }
  });
}));

/**
 * GET /api/extraction/v2/health
 * Health check for new architecture
 */
router.get('/health', (req, res) => {
  const healthStatus = extractionService.getHealthStatus();
  
  res.json({
    success: true,
    architecture: 'v2',
    health: healthStatus,
    featureFlag: {
      enabled: featureFlags.isEnabled('USE_NEW_EXTRACTION'),
      percentage: featureFlags.getAllFlags().USE_NEW_EXTRACTION_PERCENTAGE || 0
    }
  });
});

module.exports = router;

