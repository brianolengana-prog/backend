const express = require('express');
const dashboardService = require('../services/dashboard.service');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/dashboard/data
 * Get comprehensive dashboard data
 */
router.get('/data', async (req, res) => {
  try {
    console.log(`📊 Getting dashboard data for user: ${req.user.id}`);
    const data = await dashboardService.getDashboardData(req.user.id);
    res.json({ 
      success: true, 
      data 
    });
  } catch (error) {
    console.error('❌ Error getting dashboard data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get dashboard data' 
    });
  }
});

/**
 * GET /api/dashboard/warnings
 * Get usage warnings and recommendations
 */
router.get('/warnings', async (req, res) => {
  try {
    console.log(`⚠️ Getting usage warnings for user: ${req.user.id}`);
    const warnings = await dashboardService.getUsageWarnings(req.user.id);
    res.json({ 
      success: true, 
      data: warnings 
    });
  } catch (error) {
    console.error('❌ Error getting usage warnings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get usage warnings' 
    });
  }
});

/**
 * GET /api/dashboard/activity
 * Get recent activity
 */
router.get('/activity', async (req, res) => {
  try {
    console.log(`📈 Getting recent activity for user: ${req.user.id}`);
    const activity = await dashboardService.getRecentActivity(req.user.id);
    res.json({ 
      success: true, 
      data: activity 
    });
  } catch (error) {
    console.error('❌ Error getting recent activity:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recent activity' 
    });
  }
});

/**
 * GET /api/dashboard/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    console.log(`📊 Getting performance metrics for user: ${req.user.id}`);
    const metrics = await dashboardService.getPerformanceMetrics(req.user.id);
    res.json({ 
      success: true, 
      data: metrics 
    });
  } catch (error) {
    console.error('❌ Error getting performance metrics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get performance metrics' 
    });
  }
});

/**
 * GET /api/dashboard/summary
 * Get quick dashboard summary
 */
router.get('/summary', async (req, res) => {
  try {
    console.log(`📋 Getting dashboard summary for user: ${req.user.id}`);
    const data = await dashboardService.getDashboardData(req.user.id);
    
    // Return only essential data for quick loading
    const summary = {
      usage: data.usage,
      metrics: data.metrics,
      actions: data.actions
    };
    
    res.json({ 
      success: true, 
      data: summary 
    });
  } catch (error) {
    console.error('❌ Error getting dashboard summary:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get dashboard summary' 
    });
  }
});

module.exports = router;
