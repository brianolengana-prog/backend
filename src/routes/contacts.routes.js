const express = require('express');
const contactsService = require('../services/contacts.service');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/contacts/stats
 * Get contact statistics for the authenticated user
 */
router.get('/stats', async (req, res) => {
  try {
    console.log(`📊 Getting contact stats for user: ${req.user.id}`);
    const stats = await contactsService.getContactStats(req.user.id);
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('❌ Error getting contact stats:', error);
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

    const result = await contactsService.getContactsPaginated(req.user.id, options);
    
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
 * Export contacts to CSV format
 */
router.get('/export', async (req, res) => {
  try {
    const { ids, format = 'csv' } = req.query;
    console.log(`📥 Exporting contacts for user: ${req.user.id}`, { format, ids });
    
    const contactIds = ids ? ids.split(',') : undefined;
    const { data, filename, mimeType } = await contactsService.exportContacts(req.user.id, contactIds, format);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    console.error('❌ Error exporting contacts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export contacts' 
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
