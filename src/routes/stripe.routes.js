const express = require('express');
const stripeService = require('../services/stripe.service');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');

// ✅ SECURITY: Import security middleware
let webhookRateLimiter, stripeWebhookIPWhitelist;
try {
  const rateLimitModule = require('../modules/security/middleware/rate-limiter.middleware');
  const ipWhitelistModule = require('../modules/security/middleware/ip-whitelist.middleware');
  webhookRateLimiter = rateLimitModule.webhookRateLimiter;
  stripeWebhookIPWhitelist = ipWhitelistModule.stripeWebhookIPWhitelist;
} catch (e) {
  console.warn('⚠️ Security middleware not available, using fallback');
  webhookRateLimiter = (req, res, next) => next();
  stripeWebhookIPWhitelist = (req, res, next) => next();
}

const router = express.Router();

/**
 * GET /api/stripe/plans
 * Get all available pricing plans (PUBLIC - no auth required)
 */
router.get('/plans', async (req, res) => {
  try {
    console.log('📋 Fetching Stripe plans (public)');
    const result = await stripeService.getPlans();
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

// All other routes require authentication
router.use(authenticateToken);

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
      console.log('⚠️ No Stripe customer ID found, creating new customer...');
      
      // Create customer if doesn't exist
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      try {
        const userRepository = require('../repositories/user.repository');
        await userRepository.update(req.user.id, { stripeCustomerId: customerId });
        console.log(`✅ Created and saved Stripe customer: ${customerId} for user: ${req.user.id}`);
      } catch (dbError) {
        console.error('❌ Error saving Stripe customer ID to database:', dbError);
        // Continue anyway, the customer was created in Stripe
      }
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
 * Handle Stripe webhooks with enterprise-grade security and idempotency protection
 * 
 * Security Features:
 * - IP whitelisting (Stripe IPs only)
 * - Rate limiting (100 requests/minute)
 * - Signature verification
 * - Idempotency protection (prevents duplicate processing)
 * - Transaction-safe processing
 * - Audit logging
 * - Replay protection (events older than 5 minutes rejected)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookIPWhitelist, // ✅ SECURITY: IP whitelisting (Stripe IPs only)
  webhookRateLimiter, // ✅ SECURITY: Rate limiting (100/min)
  async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const { WebhookProcessorService } = require('../modules/webhooks/services/webhook-processor.service');
    const { AuditLogService, AuditAction, AuditSeverity } = require('../modules/audit/services/audit-log.service');
    const env = require('../config/env');
    
    const prisma = new PrismaClient();
    const auditService = new AuditLogService(prisma);
    const webhookProcessor = new WebhookProcessorService(prisma, stripeService, {
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
    });
    
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const clientIP = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;
    
    const signature = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const userAgent = req.headers['user-agent'];

    // ✅ SECURITY: Validate signature presence
    if (!signature) {
      await auditService.logSecurity(
        AuditAction.SECURITY_VIOLATION,
        AuditSeverity.HIGH,
        undefined,
        clientIP,
        userAgent,
        { reason: 'Missing Stripe signature header', endpoint: '/api/stripe/webhook' }
      );
      
      console.error('❌ Webhook signature missing');
      return res.status(400).json({
        success: false,
        error: 'Missing stripe-signature header',
      });
    }

    // Validate webhook secret
    if (!endpointSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        error: 'Webhook secret not configured',
      });
    }

    try {
      // Verify webhook signature
      const event = await webhookProcessor.verifySignature(
        req.body,
        signature,
        endpointSecret
      );

      // Process webhook with idempotency protection
      const result = await webhookProcessor.processWebhook({
        event,
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        userAgent,
      });

      // Return appropriate response
      if (result.duplicate) {
        // Event already processed - return 200 to acknowledge receipt
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'Event already processed',
          eventId: result.eventId,
        });
      }

      if (result.success) {
        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
          eventId: result.eventId,
          processingTimeMs: result.processingTimeMs,
        });
      } else {
        // Processing failed - return 500 so Stripe retries
        return res.status(500).json({
          success: false,
          error: result.error || 'Webhook processing failed',
          eventId: result.eventId,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Webhook processing error:', {
        error: errorMessage,
        ipAddress,
        userAgent,
      });

      // ✅ SECURITY: Signature verification failed - log and return 400 (don't retry)
      if (errorMessage.includes('signature') || errorMessage.includes('Signature')) {
        await auditService.logSecurity(
          AuditAction.SECURITY_VIOLATION,
          AuditSeverity.CRITICAL,
          undefined,
          clientIP,
          userAgent,
          { reason: 'Invalid Stripe webhook signature', endpoint: '/api/stripe/webhook' }
        );
        
        return res.status(400).json({
          success: false,
          error: 'Invalid webhook signature',
        });
      }

      // Other errors - return 500 (Stripe will retry)
      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('❌ Error handling webhook:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to handle webhook' 
    });
  }
});

/**
 * GET /api/stripe/webhook/status/:eventId
 * Get processing status of a webhook event
 */
router.get('/webhook/status/:eventId', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const { WebhookProcessorService } = require('../modules/webhooks/services/webhook-processor.service');
    
    const prisma = new PrismaClient();
    const webhookProcessor = new WebhookProcessorService(prisma, stripeService);
    const { eventId } = req.params;
    
    const status = await webhookProcessor.getEventStatus(eventId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }

    return res.status(200).json({
      success: true,
      event: {
        id: status.id,
        eventId: status.eventId,
        eventType: status.eventType,
        status: status.status,
        processed: status.processed,
        processedAt: status.processedAt,
        retryCount: status.retryCount,
        errorMessage: status.errorMessage,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

module.exports = router;