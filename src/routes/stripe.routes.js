const express = require('express');
const stripeService = require('../services/stripe.service');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/stripe/plans
 * Get all available pricing plans
 */
router.get('/plans', async (req, res) => {
  try {
    console.log('📋 Fetching Stripe plans');
    const result = await stripeService.getPlans();
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

/**
 * POST /api/stripe/checkout
 * Create a checkout session for subscription signup
 */
router.post('/checkout', async (req, res) => {
  try {
    const schema = z.object({
      priceId: z.string().min(1),
      successUrl: z.string().url().optional(),
      cancelUrl: z.string().url().optional(),
      customerEmail: z.string().email().optional(),
      metadata: z.record(z.string()).optional()
    });

    const { priceId, successUrl, cancelUrl, customerEmail, metadata } = schema.parse(req.body);
    
    // Add user info to metadata
    const enrichedMetadata = {
      ...metadata,
      userId: req.user.id,
      userEmail: req.user.email
    };

    const result = await stripeService.createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl,
      customerEmail: customerEmail || req.user.email,
      metadata: enrichedMetadata
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create checkout session' 
    });
  }
});

/**
 * POST /api/stripe/portal
 * Create a customer portal session for managing subscriptions
 */
router.post('/portal', async (req, res) => {
  try {
    const schema = z.object({
      returnUrl: z.string().url().optional()
    });

    const { returnUrl } = schema.parse(req.body);

    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Create customer if doesn't exist
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;
      
      // In a real implementation, you would save this to your database
      console.log(`✅ Created Stripe customer: ${customerId} for user: ${req.user.id}`);
    }

    const result = await stripeService.createCustomerPortalSession(customerId, returnUrl);
    res.json(result);
  } catch (error) {
    console.error('❌ Error creating portal session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create portal session' 
    });
  }
});

/**
 * GET /api/stripe/customer
 * Get customer information and subscription details
 */
router.get('/customer', async (req, res) => {
  try {
    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Create customer if doesn't exist
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;
      
      // In a real implementation, you would save this to your database
      console.log(`✅ Created Stripe customer: ${customerId} for user: ${req.user.id}`);
    }

    const result = await stripeService.getCustomerInfo(customerId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting customer info:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get customer info' 
    });
  }
});

/**
 * DELETE /api/stripe/subscription
 * Cancel a subscription
 */
router.delete('/subscription', async (req, res) => {
  try {
    const schema = z.object({
      subscriptionId: z.string().min(1)
    });

    const { subscriptionId } = schema.parse(req.body);

    const result = await stripeService.cancelSubscription(subscriptionId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel subscription' 
    });
  }
});

/**
 * PUT /api/stripe/subscription
 * Update subscription (change plan)
 */
router.put('/subscription', async (req, res) => {
  try {
    const schema = z.object({
      subscriptionId: z.string().min(1),
      newPriceId: z.string().min(1)
    });

    const { subscriptionId, newPriceId } = schema.parse(req.body);

    const result = await stripeService.updateSubscription(subscriptionId, newPriceId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update subscription' 
    });
  }
});

/**
 * GET /api/stripe/billing-history
 * Get billing history
 */
router.get('/billing-history', async (req, res) => {
  try {
    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Create customer if doesn't exist
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;
      
      // In a real implementation, you would save this to your database
      console.log(`✅ Created Stripe customer: ${customerId} for user: ${req.user.id}`);
    }

    const result = await stripeService.getBillingHistory(customerId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting billing history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get billing history' 
    });
  }
});

/**
 * GET /api/stripe/failed-payments
 * Get failed payments
 */
router.get('/failed-payments', async (req, res) => {
  try {
    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Create customer if doesn't exist
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;
      
      // In a real implementation, you would save this to your database
      console.log(`✅ Created Stripe customer: ${customerId} for user: ${req.user.id}`);
    }

    const result = await stripeService.getFailedPayments(customerId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting failed payments:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get failed payments' 
    });
  }
});

/**
 * POST /api/stripe/retry-payment
 * Retry a failed payment
 */
router.post('/retry-payment', async (req, res) => {
  try {
    const schema = z.object({
      invoiceId: z.string().min(1)
    });

    const { invoiceId } = schema.parse(req.body);

    const result = await stripeService.retryPayment(invoiceId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error retrying payment:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to retry payment' 
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = require('stripe')(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
        req.body,
        sig,
        endpointSecret
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const result = await stripeService.handleWebhook(event);
    res.json(result);
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to handle webhook' 
    });
  }
});

module.exports = router;