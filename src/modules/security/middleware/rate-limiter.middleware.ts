/**
 * Enhanced Rate Limiter Middleware
 * Enterprise-grade rate limiting with multiple strategies
 * 
 * @module Security
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Create rate limiter with custom configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    keyGenerator: config.keyGenerator || ((req: Request) => {
      // Rate limit by IP + user ID (if authenticated)
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    }),
    handler: (req: Request, res: Response) => {
      console.warn('🚫 Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id,
      });

      res.status(429).json({
        success: false,
        error: config.message || 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
  });
}

/**
 * Webhook-specific rate limiter
 * More lenient for webhooks (Stripe sends multiple events)
 */
export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  message: 'Too many webhook requests',
  keyGenerator: (req: Request) => {
    // Rate limit by IP only for webhooks
    return `webhook:${req.ip}`;
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: 'Too many requests to this endpoint',
});

/**
 * Authentication rate limiter
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Billing rate limiter
 */
export const billingRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  message: 'Too many billing requests',
});

