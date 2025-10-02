const express = require('express');
const usageService = require('../services/usage.service');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get current usage
router.get('/current', authenticateToken, async (req, res) => {
  try {
    console.log(`📊 Getting current usage for user: ${req.user.id}`);
    const usage = await usageService.getCurrentUsage(req.user.id);
    res.json({ 
      success: true, 
      data: usage 
    });
  } catch (error) {
    console.error('❌ Error getting current usage:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage information' 
    });
  }
});

// Record an upload
router.post('/record-upload', authenticateToken, async (req, res) => {
  try {
    const { contactsCount = 0 } = req.body;
    console.log(`📊 Recording upload for user: ${req.user.id}, contacts: ${contactsCount}`);
    const usage = await usageService.recordUpload(req.user.id, contactsCount);
    res.json({ 
      success: true, 
      data: usage 
    });
  } catch (error) {
    console.error('❌ Error recording upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record upload' 
    });
  }
});

// Check if user can upload
router.get('/can-upload', authenticateToken, async (req, res) => {
  try {
    const canUpload = await usageService.canUserUpload(req.user.id);
    res.json({ 
      success: true, 
      canUpload 
    });
  } catch (error) {
    console.error('❌ Error checking upload permission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check upload permission' 
    });
  }
});

// Get usage statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'Start date and end date are required' 
      });
    }

    const stats = await usageService.getUsageStats(
      req.user.id, 
      new Date(startDate), 
      new Date(endDate)
    );
    
    res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('❌ Error getting usage stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage statistics' 
    });
  }
});

// Get usage summary for dashboard
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    console.log(`📊 Getting usage summary for user: ${req.user.id}`);
    const summary = await usageService.getUsageSummary(req.user.id);
    res.json({ 
      success: true, 
      data: summary 
    });
  } catch (error) {
    console.error('❌ Error getting usage summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage summary' 
    });
  }
});

// Check usage limits and warnings
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    console.log(`📊 Checking usage limits for user: ${req.user.id}`);
    const limits = await usageService.checkUsageLimits(req.user.id);
    res.json({ 
      success: true, 
      data: limits 
    });
  } catch (error) {
    console.error('❌ Error checking usage limits:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check usage limits' 
    });
  }
});

// Reset usage (for testing or plan changes)
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Resetting usage for user: ${req.user.id}`);
    await usageService.resetUsage(req.user.id);
    res.json({ 
      success: true, 
      message: 'Usage reset successfully' 
    });
  } catch (error) {
    console.error('❌ Error resetting usage:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset usage' 
    });
  }
});

module.exports = router;

