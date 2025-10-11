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
 * Get all contacts for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    console.log(`📋 Getting contacts for user: ${req.user.id}`);
    const contacts = await contactsService.getContacts(req.user.id);
    res.json({ 
      success: true, 
      data: contacts 
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
