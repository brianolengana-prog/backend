/**
 * Upgrade Workflow Routes
 * 
 * Handles upgrade-related API endpoints
 */

const express = require('express');
const upgradeWorkflowService = require('../services/upgradeWorkflow.service');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/upgrade/check
 * Check if user needs to upgrade
 */
router.get('/check', async (req, res) => {
  try {
    console.log(`🔍 Checking upgrade needs for user: ${req.user.id}`);
    const upgradeCheck = await upgradeWorkflowService.checkUpgradeNeeded(req.user.id);
    
    res.json({
      success: true,
      data: upgradeCheck
    });
  } catch (error) {
    console.error('❌ Error checking upgrade needs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check upgrade needs'
    });
  }
});

/**
 * GET /api/upgrade/prompt
 * Get upgrade prompt data
 */
router.get('/prompt', async (req, res) => {
  try {
    console.log(`📋 Getting upgrade prompt for user: ${req.user.id}`);
    const promptData = await upgradeWorkflowService.getUpgradePromptData(req.user.id);
    
    if (!promptData) {
      return res.json({
        success: true,
        data: null,
        message: 'No upgrade prompt needed'
      });
    }
    
    res.json({
      success: true,
      data: promptData
    });
  } catch (error) {
    console.error('❌ Error getting upgrade prompt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upgrade prompt'
    });
  }
});

/**
 * POST /api/upgrade/prompt-action
 * Handle upgrade prompt action
 */
router.post('/prompt-action', async (req, res) => {
  try {
    const { action, planId } = req.body;
    console.log(`🔄 Handling upgrade prompt action: ${action} for user: ${req.user.id}`);
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required'
      });
    }
    
    const result = await upgradeWorkflowService.handleUpgradePrompt(req.user.id, action, planId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Error handling upgrade prompt action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle upgrade prompt action'
    });
  }
});

/**
 * GET /api/upgrade/analytics
 * Get upgrade analytics for user
 */
router.get('/analytics', async (req, res) => {
  try {
    console.log(`📊 Getting upgrade analytics for user: ${req.user.id}`);
    const analytics = await upgradeWorkflowService.getUpgradeAnalytics(req.user.id);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('❌ Error getting upgrade analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get upgrade analytics'
    });
  }
});

/**
 * GET /api/upgrade/suggested-plans
 * Get suggested upgrade plans
 */
router.get('/suggested-plans', async (req, res) => {
  try {
    const { currentPlan } = req.query;
    console.log(`💡 Getting suggested plans for current plan: ${currentPlan}`);
    
    const suggestedPlans = upgradeWorkflowService.getSuggestedPlans(currentPlan || 'free');
    
    res.json({
      success: true,
      data: suggestedPlans
    });
  } catch (error) {
    console.error('❌ Error getting suggested plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggested plans'
    });
  }
});

module.exports = router;
