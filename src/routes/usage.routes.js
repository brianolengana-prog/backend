const express = require('express');
const usageService = require('../services/usage.service');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get current usage
router.get('/current', authenticate, async (req, res) => {
  try {
    const usage = await usageService.getCurrentUsage(req.user.userId);
    res.json({ 
      success: true, 
      data: usage 
    });
  } catch (error) {
    console.error('Error getting current usage:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage information' 
    });
  }
});

// Record an upload
router.post('/record-upload', authenticate, async (req, res) => {
  try {
    const { contactsCount = 0 } = req.body;
    const usage = await usageService.recordUpload(req.user.userId, contactsCount);
    res.json({ 
      success: true, 
      data: usage 
    });
  } catch (error) {
    console.error('Error recording upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record upload' 
    });
  }
});

// Check if user can upload
router.get('/can-upload', authenticate, async (req, res) => {
  try {
    const canUpload = await usageService.canUserUpload(req.user.userId);
    res.json({ 
      success: true, 
      canUpload 
    });
  } catch (error) {
    console.error('Error checking upload permission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check upload permission' 
    });
  }
});

// Get usage statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start date and end date are required' 
      });
    }

    const stats = await usageService.getUsageStats(
      req.user.userId, 
      new Date(startDate), 
      new Date(endDate)
    );
    
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage statistics' 
    });
  }
});

module.exports = router;

