/**
 * Stripe Routes
 * Webhook endpoint with enterprise-grade idempotency and security
 * 
 * @module Routes
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { WebhookProcessorService } from '../modules/webhooks/services/webhook-processor.service';
import stripeService from '../services/stripe.service';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize webhook processor
const webhookProcessor = new WebhookProcessorService(prisma, stripeService);

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks with idempotency protection
 * 
 * Security Features:
 * - Signature verification
 * - Idempotency protection (prevents duplicate processing)
 * - Transaction-safe processing
 * - Audit logging
 * - Replay protection (events older than 5 minutes rejected)
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Validate signature presence
    if (!signature) {
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error('❌ Webhook processing error:', {
        error: errorMessage,
        ipAddress,
        userAgent,
      });

      // Signature verification failed - return 400 (don't retry)
      if (errorMessage.includes('signature') || errorMessage.includes('Signature')) {
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
  }
);

/**
 * GET /api/stripe/webhook/status/:eventId
 * Get processing status of a webhook event
 */
router.get('/webhook/status/:eventId', async (req: Request, res: Response) => {
  try {
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;

