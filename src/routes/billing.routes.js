const express = require('express');
const billingService = require('../services/billing.service');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const checkoutSchema = z.object({
  priceId: z.string().min(1)
});

const updateSubscriptionSchema = z.object({
  priceId: z.string().min(1)
});

// Create checkout session
router.post('/create-checkout-session', authenticate, async (req, res) => {
  try {
    const { priceId } = checkoutSchema.parse(req.body);
    const session = await billingService.createCheckoutSession(req.user.userId, priceId);
    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Create customer portal session
router.post('/create-portal-session', authenticate, async (req, res) => {
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
router.get('/customer', authenticate, async (req, res) => {
  try {
    const customer = await billingService.getCustomerByUserId(req.user.userId);
    res.json({ success: true, ...customer });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get customer info by customer ID
router.get('/customer/:customerId', authenticate, async (req, res) => {
  try {
    const customer = await billingService.getCustomer(req.params.customerId);
    res.json({ success: true, customer });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticate, async (req, res) => {
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
router.post('/update-subscription', authenticate, async (req, res) => {
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
router.get('/billing-history/:customerId', authenticate, async (req, res) => {
  try {
    const history = await billingService.getBillingHistory(req.params.customerId);
    res.json({ success: true, history });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get payment methods
router.get('/payment-methods/:customerId', authenticate, async (req, res) => {
  try {
    const methods = await billingService.getPaymentMethods(req.params.customerId);
    res.json({ success: true, methods });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Get plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ success: true, plans });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
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
