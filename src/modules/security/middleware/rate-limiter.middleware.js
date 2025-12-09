/**
 * Enhanced Rate Limiter Middleware (JavaScript version for Express)
 * Enterprise-grade rate limiting with multiple strategies
 * 
 * @module Security
 */

const rateLimit = require('express-rate-limit');

/**
 * Webhook-specific rate limiter
 * More lenient for webhooks (Stripe sends multiple events)
 */
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  message: 'Too many webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP only for webhooks
    return `webhook:${req.ip}`;
  },
  handler: (req, res) => {
    console.warn('🚫 Webhook rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      success: false,
      error: 'Too many webhook requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 */
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: 'Too many requests to this endpoint',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('🚫 Strict rate limit exceeded:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900, // 15 minutes
    });
  },
});

/**
 * Authentication rate limiter
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    // Rate limit by IP + email if provided
    const email = req.body?.email;
    return email ? `auth:${req.ip}:${email}` : `auth:${req.ip}`;
  },
  handler: (req, res) => {
    console.warn('🚫 Auth rate limit exceeded:', {
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900, // 15 minutes
    });
  },
});

/**
 * Billing rate limiter
 */
const billingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes
  message: 'Too many billing requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    const userId = req.user?.id;
    return userId ? `billing:user:${userId}` : `billing:ip:${req.ip}`;
  },
  handler: (req, res) => {
    console.warn('🚫 Billing rate limit exceeded:', {
      ip: req.ip,
      userId: req.user?.id,
    });

    res.status(429).json({
      success: false,
      error: 'Too many billing requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 900, // 15 minutes
    });
  },
});

module.exports = {
  webhookRateLimiter,
  strictRateLimiter,
  authRateLimiter,
  billingRateLimiter,
};

