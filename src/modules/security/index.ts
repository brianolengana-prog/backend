/**
 * Security Module
 * Enterprise-grade security features
 * 
 * @module Security
 */

// Middleware
export { createIPWhitelistMiddleware, stripeWebhookIPWhitelist, STRIPE_WEBHOOK_IPS } from './middleware/ip-whitelist.middleware';
export type { IPWhitelistConfig } from './middleware/ip-whitelist.middleware';

export { 
  createRateLimiter, 
  webhookRateLimiter, 
  strictRateLimiter, 
  authRateLimiter, 
  billingRateLimiter 
} from './middleware/rate-limiter.middleware';
export type { RateLimitConfig } from './middleware/rate-limiter.middleware';

export { sanitizeLogsMiddleware, setupSanitizedLogging } from './middleware/logging.middleware';

// Services
export { LogSanitizerService } from './services/log-sanitizer.service';
export type { SanitizeOptions } from './services/log-sanitizer.service';

export { RequestSigningService } from './services/request-signing.service';
export type { SigningConfig } from './services/request-signing.service';

