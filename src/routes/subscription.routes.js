const express = require('express');
const subscriptionService = require('../services/subscription.service');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

/**
 * GET /api/subscription/plans
 * Get all available subscription plans (PUBLIC - no auth required)
 */
router.get('/plans', async (req, res) => {
  try {
    console.log('📋 Fetching subscription plans (public)');
    const plans = await subscriptionService.getPlans();
    res.json({ success: true, plans });
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// All other routes require authentication
router.use(authenticateToken);

/**
 * GET /api/subscription/current
 * Get current user's subscription
 */
router.get('/current', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching current subscription for user:', userId);
    
    const subscription = await subscriptionService.getCurrentSubscription(userId);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Error fetching current subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/subscription/create
 * Create a new subscription
 */
router.post('/create', async (req, res) => {
  try {
    const schema = z.object({
      planId: z.string().min(1),
      paymentMethodId: z.string().optional(),
      trialDays: z.number().optional()
    });
    
    const { planId, paymentMethodId, trialDays } = schema.parse(req.body);
    const userId = req.user.id;
    
    console.log('📋 Creating subscription for user:', userId, 'plan:', planId);
    
    const subscription = await subscriptionService.createSubscription(userId, planId, paymentMethodId, trialDays);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to create subscription' });
  }
});

/**
 * PUT /api/subscription/update
 * Update existing subscription
 */
router.put('/update', async (req, res) => {
  try {
    const schema = z.object({
      planId: z.string().min(1)
    });
    
    const { planId } = schema.parse(req.body);
    const userId = req.user.id;
    
    console.log('📋 Updating subscription for user:', userId, 'to plan:', planId);
    
    const subscription = await subscriptionService.updateSubscription(userId, planId);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancel subscription
 */
router.post('/cancel', async (req, res) => {
  try {
    const userId = req.user.id;
    const { immediately = false } = req.body;
    
    console.log('📋 Canceling subscription for user:', userId, 'immediately:', immediately);
    
    const subscription = await subscriptionService.cancelSubscription(userId, immediately);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscription/resume
 * Resume canceled subscription
 */
router.post('/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Resuming subscription for user:', userId);
    
    const subscription = await subscriptionService.resumeSubscription(userId);
    res.json({ success: true, subscription });
  } catch (error) {
    console.error('❌ Error resuming subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to resume subscription' });
  }
});

/**
 * GET /api/subscription/usage
 * Get current usage
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching usage for user:', userId);
    
    const usage = await subscriptionService.getUserUsage(userId);
    res.json({ success: true, usage });
  } catch (error) {
    console.error('❌ Error fetching usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage' });
  }
});

/**
 * POST /api/subscription/check-usage
 * Check if user can perform an action
 */
router.post('/check-usage', async (req, res) => {
  try {
    const schema = z.object({
      action: z.string().min(1)
    });
    
    const { action } = schema.parse(req.body);
    const userId = req.user.id;
    
    console.log('📋 Checking usage for user:', userId, 'action:', action);
    
    const result = await subscriptionService.checkUsage(userId, action);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error checking usage:', error);
    res.status(500).json({ success: false, error: 'Failed to check usage' });
  }
});

/**
 * GET /api/subscription/billing
 * Get billing information
 */
router.get('/billing', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching billing info for user:', userId);
    
    const billingInfo = await subscriptionService.getBillingInfo(userId);
    res.json({ success: true, billingInfo });
  } catch (error) {
    console.error('❌ Error fetching billing info:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch billing info' });
  }
});

/**
 * GET /api/subscription/invoices
 * Get billing history
 */
router.get('/invoices', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching invoices for user:', userId);
    
    const invoices = await subscriptionService.getInvoices(userId);
    res.json({ success: true, invoices });
  } catch (error) {
    console.error('❌ Error fetching invoices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

module.exports = router;
