const express = require('express');
const { authenticateToken } = require('../middleware/auth');

// ============================================================
// NEW: Use refactored ContactService (Phase 3)
// ============================================================
const ContactServiceAdapter = require('../domains/contacts/services/ContactServiceAdapter');
const featureFlags = require('../shared/infrastructure/features/feature-flags.service');
const { logger: domainLogger } = require('../shared/infrastructure/logger/logger.service');

// Legacy service (fallback)
const legacyContactsService = require('../services/contacts.service');

// Create adapter instance
const contactServiceAdapter = new ContactServiceAdapter();

// Helper to choose service based on feature flag
const getContactsService = (userId) => {
  const useNewService = featureFlags.isEnabledForUser('USE_NEW_CONTACTS', userId);
  return useNewService ? contactServiceAdapter : legacyContactsService;
};

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/contacts/stats
 * Get contact statistics for the authenticated user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const jobId = req.query.jobId; // STRICT: Support job-scoped stats
    
    domainLogger.info(`Getting contact stats for user: ${userId}`, { jobId });
    
    const service = getContactsService(userId);
    
    // STRICT: If jobId provided, get job-scoped stats
    let stats;
    if (jobId && jobId !== 'all' && service.contactService) {
      // New service with job-scoped stats
      stats = await service.contactService.getStats(userId, jobId);
    } else {
      // Legacy service or no jobId
      stats = await service.getContactStats(userId);
    }
    
    res.json({ 
      success: true, 
      data: stats.toObject ? stats.toObject() : stats
    });
  } catch (error) {
    domainLogger.error('Error getting contact stats', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get contact statistics' 
    });
  }
});

/**
 * GET /api/contacts
 * Get contacts for the authenticated user with pagination and filtering
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25)
 * - search: Search term for name, email, phone, role
 * - role: Filter by role
 * - jobId: Filter by specific job/callsheet
 * - sortBy: Sort field (created_at, name, email)
 * - sortOrder: Sort order (asc, desc)
 * - requireContact: Only show contacts with email OR phone (default: 'true')
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = '',
      role = '',
      jobId = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
      requireContact = 'true'
    } = req.query;

    // Parse pagination params
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Validate pagination
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid page number'
      });
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit (must be between 1 and 100)'
      });
    }

    console.log(`📋 Getting paginated contacts for user: ${req.user.id}`, {
      page: pageNum,
      limit: limitNum,
      search,
      role,
      jobId
    });

    // Get paginated contacts
    const options = {
      page: pageNum,
      limit: limitNum,
      search,
      role,
      jobId,
      sortBy,
      sortOrder,
      requireContact
    };

    // STRICT: Enforce jobId scoping if provided in query
    const queryJobId = req.query.jobId;
    const service = getContactsService(req.user.id);
    
    // STRICT: If jobId in query, enforce strict scoping (don't allow 'all' override)
    const queryOptions = {
      ...options,
      jobId: queryJobId && queryJobId !== 'all' ? queryJobId : options.jobId
    };
    
    const result = await service.getContactsPaginated(req.user.id, queryOptions);
    
    res.json({ 
      success: true, 
      data: result
    });
  } catch (error) {
    console.error('❌ Error getting contacts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get contacts' 
    });
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Getting contact ${id} for user: ${req.user.id}`);
    const contact = await contactsService.getContactById(req.user.id, id);
    res.json({ 
      success: true, 
      data: contact 
    });
  } catch (error) {
    console.error('❌ Error getting contact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get contact' 
    });
  }
});

/**
 * GET /api/contacts/export
 * Export contacts in multiple formats (CSV, Excel, JSON, vCard)
 * 
 * Query parameters:
 * - ids: Comma-separated contact IDs (optional)
 * - jobId: Filter by job ID (optional)
 * - format: Export format: 'csv', 'excel', 'json', 'vcard' (default: 'csv')
 * - includeFields: Comma-separated fields to include (optional)
 * - delimiter: CSV delimiter: ',' or ';' (optional, CSV only)
 * - customFileName: Custom filename (optional)
 */
router.get('/export', async (req, res) => {
  try {
    const { ids, jobId, format = 'csv', includeFields, delimiter, customFileName } = req.query;
    
    // Validate jobId is a valid UUID if provided
    if (jobId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(jobId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid jobId format. Must be a valid UUID.'
        });
      }
    }

    // Validate format
    const validFormats = ['csv', 'excel', 'xlsx', 'json', 'vcard', 'vcf'];
    if (!validFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}`
      });
    }
    
    // Parse export options
    const exportOptions = {
      ...(includeFields && { includeFields: includeFields.split(',') }),
      ...(delimiter && { delimiter }),
      ...(customFileName && { customFileName })
    };
    
    const contactIds = ids ? ids.split(',') : undefined;
    const normalizedFormat = format.toLowerCase() === 'xlsx' ? 'excel' : format.toLowerCase();
    
    // STRICT: Use new export service with validation
    const service = getContactsService(req.user.id);
    
    const { data, filename, mimeType } = await service.exportContacts(
      req.user.id, 
      contactIds, 
      normalizedFormat, 
      jobId || null,
      exportOptions
    );
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send buffer for Excel, string for others
    if (format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx') {
      res.send(Buffer.from(data));
    } else {
      res.send(data);
    }
  } catch (error) {
    console.error('❌ Error exporting contacts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to export contacts' 
    });
  }
});

/**
 * DELETE /api/contacts/:id
 * Delete a specific contact by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting contact ${id} for user: ${req.user.id}`);
    await contactsService.deleteContact(req.user.id, id);
    res.json({ 
      success: true, 
      message: 'Contact deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting contact:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete contact' 
    });
  }
});

module.exports = router;
