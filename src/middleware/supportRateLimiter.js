const rateLimit = require('express-rate-limit');

/**
 * Rate Limiter for Support Endpoint
 * Prevents spam and abuse by limiting requests per IP
 * 
 * Security Principles Applied:
 * - Defense in Depth: Multiple layers of protection
 * - Least Privilege: Restrictive by default
 * - Fail Secure: Blocks on error
 */

/**
 * Strict rate limiter for support submissions
 * Allows 3 requests per 15 minutes per IP
 */
const supportSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    success: false,
    message: 'Too many support requests from this IP. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Skip successful requests to allow legitimate users
  skipSuccessfulRequests: false,
  
  // Custom key generator (can be enhanced with user ID if authenticated)
  keyGenerator: (req) => {
    // Use IP address as key
    return req.ip || req.connection.remoteAddress;
  },
  
  // Handler for when limit is exceeded
  handler: (req, res) => {
    console.warn(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many support requests. Please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: '15 minutes'
      }
    });
  }
});

/**
 * Moderate rate limiter for general support endpoints
 * Allows 10 requests per hour per IP
 */
const supportGeneralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  supportSubmissionLimiter,
  supportGeneralLimiter
};

