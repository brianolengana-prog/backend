const express = require('express');
const billingService = require('../services/billing.service');
const usageService = require('../services/usage.service');
const subscriptionService = require('../services/subscription.service');
const stripeService = require('../services/stripe.service');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const checkoutSchema = z.object({
  priceId: z.string().min(1)
});

const updateSubscriptionSchema = z.object({
  priceId: z.string().min(1)
});

// Create checkout session
router.post('/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { priceId } = checkoutSchema.parse(req.body);
    const session = await billingService.createCheckoutSession(req.user.userId, priceId);
    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Create customer portal session
router.post('/create-portal-session', authenticateToken, async (req, res) => {
  try {
    // Get customer info first to get the Stripe customer ID
    const customerInfo = await billingService.getCustomerByUserId(req.user.userId);
    if (!customerInfo.hasSubscription || !customerInfo.customer?.id) {
      return res.status(400).json({ success: false, error: 'No active subscription found' });
    }
    
    const session = await billingService.createCustomerPortalSession(customerInfo.customer.id);
    res.json({ success: true, url: session.url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get customer info by user ID (for frontend compatibility)
router.get('/customer', authenticateToken, async (req, res) => {
  try {
    const customer = await billingService.getCustomerByUserId(req.user.userId);
    res.json({ success: true, ...customer });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get customer info by customer ID
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const customer = await billingService.getCustomer(req.params.customerId);
    res.json({ success: true, customer });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ success: false, error: 'Subscription ID required' });
    const subscription = await billingService.cancelSubscription(subscriptionId);
    res.json({ success: true, subscription });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Update subscription
router.post('/update-subscription', authenticateToken, async (req, res) => {
  try {
    const { subscriptionId, priceId } = { ...req.body, ...updateSubscriptionSchema.parse(req.body) };
    if (!subscriptionId) return res.status(400).json({ success: false, error: 'Subscription ID required' });
    const subscription = await billingService.updateSubscription(subscriptionId, priceId);
    res.json({ success: true, subscription });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get billing history
router.get('/billing-history/:customerId', authenticateToken, async (req, res) => {
  try {
    const history = await billingService.getBillingHistory(req.params.customerId);
    res.json({ success: true, history });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get payment methods
router.get('/payment-methods/:customerId', authenticateToken, async (req, res) => {
  try {
    const methods = await billingService.getPaymentMethods(req.params.customerId);
    res.json({ success: true, methods });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get plans (PUBLIC - no auth required)
router.get('/plans', async (req, res) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ success: true, plans });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Apply authentication to all other routes (after /plans)
router.use(authenticateToken);

/**
 * GET /api/billing/summary
 * Get all billing data in one request (optimized endpoint)
 * Combines: usage, subscription, billing history, payment methods
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`📊 Getting billing summary for user: ${userId}`);

    // Get or create Stripe customer ID
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Try to get from subscription
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      if (subscription?.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      }
    }

    // Fetch all billing data in parallel
    const [usage, subscription, billingHistoryResult, customerInfoResult] = await Promise.allSettled([
      usageService.getCurrentUsage(userId),
      subscriptionService.getCurrentSubscription(userId),
      customerId ? stripeService.getBillingHistory(customerId) : Promise.resolve({ success: true, history: [] }),
      customerId ? stripeService.getCustomerInfo(customerId) : Promise.resolve({ success: true, paymentMethods: [] })
    ]);

    // Extract results (handle failures gracefully)
    const usageData = usage.status === 'fulfilled' ? usage.value : null;
    const subscriptionData = subscription.status === 'fulfilled' ? subscription.value : null;
    const billingHistory = billingHistoryResult.status === 'fulfilled' 
      ? (billingHistoryResult.value.history || billingHistoryResult.value.data?.history || [])
      : [];
    const paymentMethods = customerInfoResult.status === 'fulfilled'
      ? (customerInfoResult.value.paymentMethods || customerInfoResult.value.data?.paymentMethods || [])
      : [];

    // Transform subscription to match frontend format
    const transformedSubscription = subscriptionData ? {
      hasSubscription: true,
      plan: subscriptionData.planId || 'free',
      planName: subscriptionData.planName || 'Free Plan',
      status: subscriptionData.status || 'active',
      subscriptionId: subscriptionData.stripeSubscriptionId,
      currentPeriodStart: subscriptionData.currentPeriodStart 
        ? Math.floor(new Date(subscriptionData.currentPeriodStart).getTime() / 1000)
        : undefined,
      currentPeriodEnd: subscriptionData.currentPeriodEnd
        ? Math.floor(new Date(subscriptionData.currentPeriodEnd).getTime() / 1000)
        : undefined,
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
      price: subscriptionData.price,
      interval: subscriptionData.interval,
      nextBillingDate: subscriptionData.currentPeriodEnd
        ? Math.floor(new Date(subscriptionData.currentPeriodEnd).getTime() / 1000)
        : undefined
    } : null;

    // Transform usage to match frontend format
    const transformedUsage = usageData ? {
      uploadsUsed: usageData.uploadsUsed || 0,
      uploadsLimit: usageData.uploadsLimit || 0,
      uploadsThisMonth: usageData.uploadsThisMonth || 0,
      currentPlan: usageData.currentPlan || 'free',
      planName: usageData.planName || 'Free Plan',
      canUpload: usageData.canUpload !== false,
      reason: usageData.reason,
      totalContacts: usageData.totalContacts || 0,
      totalJobs: usageData.totalJobs || 0,
      contactsExtracted: usageData.contactsExtracted || 0,
      timeSaved: usageData.timeSaved || 0,
      daysRemaining: usageData.daysRemaining || 0,
      storageUsed: usageData.storageUsed,
      storageLimit: usageData.storageLimit,
      successRate: usageData.successRate,
      aiProcessingMinutes: usageData.aiProcessingMinutes,
      apiCallsUsed: usageData.apiCallsUsed,
      apiCallsLimit: usageData.apiCallsLimit
    } : null;

    res.json({
      success: true,
      data: {
        usage: transformedUsage,
        subscription: transformedSubscription,
        billingHistory,
        paymentMethods
      }
    });
  } catch (error) {
    console.error('❌ Error getting billing summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get billing summary'
    });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const result = await billingService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
