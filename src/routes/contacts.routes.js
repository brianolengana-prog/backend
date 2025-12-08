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

    const service = getContactsService(req.user.id);
    
    // STRICT: If jobId in query, enforce strict scoping (don't allow 'all' override)
    const queryOptions = {
      ...options,
      jobId: jobId && jobId !== 'all' ? jobId : options.jobId
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
 * GET /api/contacts/export
 * Export contacts in multiple formats (CSV, Excel, JSON, vCard)
 * 
 * ⚠️ IMPORTANT: This route MUST be defined BEFORE /:id to avoid route conflicts
 * 
 * Query parameters:
 * - ids: Comma-separated contact IDs (optional)
 * - jobId: Filter by job ID (optional)
 * - format: Export format: 'csv', 'excel', 'json', 'vcard' (default: 'csv')
 * - includeFields: Comma-separated fields to include (optional)
 * - delimiter: CSV delimiter: ',' or ';' (optional, CSV only)
 * - customFileName: Custom filename (optional)
 * 
 * ⚠️ IMPORTANT: This route MUST be defined BEFORE /:id to avoid route conflicts
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
    
    console.log('📤 Starting export', {
      userId: req.user.id,
      format: normalizedFormat,
      jobId,
      contactIds: contactIds?.length || 0,
      options: Object.keys(exportOptions)
    });
    
    const result = await service.exportContacts(
      req.user.id, 
      contactIds, 
      normalizedFormat, 
      jobId || null,
      exportOptions
    );
    
    console.log('✅ Export result:', {
      hasData: !!result?.data,
      hasFilename: !!result?.filename,
      hasMimeType: !!result?.mimeType,
      dataType: typeof result?.data,
      dataLength: result?.data?.length || 'N/A'
    });
    
    if (!result || !result.data || !result.filename || !result.mimeType) {
      throw new Error(`Invalid export result: ${JSON.stringify(result)}`);
    }
    
    const { data, filename, mimeType } = result;
    
    // Send buffer for Excel, string for others (CSV, JSON, vCard)
    if (format.toLowerCase() === 'excel' || format.toLowerCase() === 'xlsx') {
      // Ensure data is a Buffer and set Content-Length correctly
      let buffer;
      if (Buffer.isBuffer(data)) {
        buffer = data;
      } else if (data instanceof Uint8Array) {
        buffer = Buffer.from(data);
      } else {
        // Fallback: try to convert to buffer
        domainLogger.error('Excel export data is not a Buffer', { 
          dataType: typeof data, 
          isBuffer: Buffer.isBuffer(data),
          isUint8Array: data instanceof Uint8Array,
          dataLength: data?.length,
          filename,
          userId: req.user.id
        });
        buffer = Buffer.from(data);
      }
      
      domainLogger.info('Sending Excel buffer', { 
        bufferLength: buffer.length, 
        filename,
        userId: req.user.id,
        bufferType: Buffer.isBuffer(buffer) ? 'Buffer' : typeof buffer
      });
      
      // Set headers and send binary data
      // Use res.writeHead() to ensure headers are set before data
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length
      });
      
      // Send buffer as binary
      res.end(buffer);
    } else {
      // CSV, JSON, vCard are strings - validate and send
      if (typeof data !== 'string') {
        domainLogger.error('Export data is not a string for text format', {
          format,
          dataType: typeof data,
          isBuffer: Buffer.isBuffer(data),
          filename,
          userId: req.user.id
        });
        return res.status(500).json({
          success: false,
          error: `Export failed: Invalid data type for ${format} format`
        });
      }

      if (!data || data.length === 0) {
        domainLogger.error('Export data is empty for text format', {
          format,
          filename,
          userId: req.user.id
        });
        return res.status(500).json({
          success: false,
          error: `Export failed: Empty data for ${format} format`
        });
      }

      domainLogger.info(`Sending ${format} export`, {
        format,
        contentLength: data.length,
        filename,
        userId: req.user.id
      });

      res.send(data);
    }
  } catch (error) {
    console.error('❌ Error exporting contacts:', {
      message: error?.message,
      stack: error?.stack,
      error: error,
      errorType: typeof error,
      errorKeys: error ? Object.keys(error) : []
    });
    
    const errorMessage = error?.message || error?.toString() || 'Failed to export contacts';
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact by ID
 * 
 * ⚠️ IMPORTANT: This route MUST be defined AFTER /export to avoid route conflicts
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Getting contact ${id} for user: ${req.user.id}`);
    const service = getContactsService(req.user.id);
    const contact = await service.getContactById(req.user.id, id);
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
 * DELETE /api/contacts/:id
 * Delete a specific contact by ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting contact ${id} for user: ${req.user.id}`);
    const service = getContactsService(req.user.id);
    await service.deleteContact(req.user.id, id);
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
