/**
 * Rate Limiter Middleware
 * 
 * Prevents abuse and ensures fair resource usage
 * Implements tiered rate limits based on user plan
 * 
 * @module RateLimiter
 * @follows Leaky Bucket Algorithm
 */

const rateLimit = require('express-rate-limit');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

/**
 * Create rate limiter with custom config
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60 * 1000,  // 1 minute window
    max = 10,               // 10 requests per window
    message = 'Too many requests',
    keyGenerator = (req) => req.user?.id || req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,  // Return rate limit info in headers
    legacyHeaders: false,   // Disable X-RateLimit-* headers
    
    // Custom key generator (per user or IP)
    keyGenerator,
    
    // Skip successful/failed requests if needed
    skip: (req, res) => {
      if (skipSuccessfulRequests && res.statusCode < 400) return true;
      if (skipFailedRequests && res.statusCode >= 400) return true;
      return false;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const userId = req.user?.id || 'anonymous';
      const endpoint = req.path;
      
      logger.warn('🚫 Rate limit exceeded', {
        userId,
        ip: req.ip,
        endpoint,
        limit: max,
        window: `${windowMs / 1000}s`
      });
      
      res.status(429).json({
        success: false,
        error: message,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000),  // Seconds
        limit: max,
        window: windowMs
      });
    },
    
    // Note: onLimitReached is deprecated in v7, removed for compatibility
  });
}

/**
 * Tiered rate limiters based on user plan
 */
const rateLimiters = {
  // ⭐ TIER 1 FIX #4: Request rate limiting
  
  /**
   * File upload rate limit
   * Prevents spam uploads
   */
  fileUpload: createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    max: 10,                   // 10 uploads per minute
    message: 'Too many file uploads. Please wait before uploading again.',
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  /**
   * Text extraction rate limit
   * More lenient for text-only requests
   */
  textExtraction: createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    max: 20,                   // 20 text extractions per minute
    message: 'Too many extraction requests. Please slow down.',
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  /**
   * General API rate limit
   * Applies to all API endpoints
   */
  api: createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    max: 100,                  // 100 requests per minute
    message: 'Too many API requests. Please slow down.',
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  /**
   * Strict rate limit for anonymous users
   * Very restrictive for unauthenticated requests
   */
  anonymous: createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    max: 5,                    // 5 requests per minute
    message: 'Too many requests from this IP. Please sign in for higher limits.',
    keyGenerator: (req) => req.ip,
    skipSuccessfulRequests: false
  }),
  
  /**
   * Premium user rate limit (higher limits)
   */
  premium: createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    max: 50,                   // 50 uploads per minute
    message: 'Rate limit exceeded. Please contact support for enterprise limits.',
    keyGenerator: (req) => req.user?.id
  })
};

/**
 * Smart rate limiter that adjusts based on user plan
 * 
 * Usage:
 *   router.post('/upload', smartRateLimit('extraction'), handler)
 */
function smartRateLimit(type = 'api') {
  return (req, res, next) => {
    const user = req.user;
    
    // Determine which limiter to use based on user plan
    let limiter;
    
    if (!user) {
      // Anonymous user - strictest limits
      limiter = rateLimiters.anonymous;
    } else {
      const plan = user.plan || 'free';
      
      switch (plan.toLowerCase()) {
        case 'pro':
        case 'enterprise':
          limiter = rateLimiters.premium;
          break;
          
        case 'starter':
        case 'free':
        default:
          limiter = rateLimiters[type] || rateLimiters.api;
          break;
      }
    }
    
    // Apply the selected limiter
    return limiter(req, res, next);
  };
}

/**
 * Get rate limit info for current user
 */
function getRateLimitInfo(req, type = 'api') {
  const user = req.user;
  const plan = user?.plan || 'free';
  
  const limits = {
    free: { fileUpload: 10, textExtraction: 20, api: 100 },
    starter: { fileUpload: 10, textExtraction: 20, api: 100 },
    pro: { fileUpload: 50, textExtraction: 100, api: 500 },
    enterprise: { fileUpload: 200, textExtraction: 500, api: 2000 }
  };
  
  return {
    plan,
    limit: limits[plan][type],
    window: '1 minute'
  };
}

module.exports = {
  rateLimiters,
  smartRateLimit,
  createRateLimiter,
  getRateLimitInfo
};

