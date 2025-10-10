const express = require('express');
const router = express.Router();
const emailService = require('../services/email.service');
const { body, validationResult } = require('express-validator');
const { supportSubmissionLimiter, supportGeneralLimiter } = require('../middleware/supportRateLimiter');
const InputSanitizer = require('../utils/inputSanitizer');

/**
 * Support Routes
 * Handles customer support email submissions
 * 
 * Security Principles Applied:
 * - Input Validation & Sanitization (OWASP A03:2021)
 * - Rate Limiting (OWASP A04:2021)
 * - Secure Error Handling
 * - Logging & Monitoring
 * - Defense in Depth
 */

// Simple in-memory cache for duplicate detection (use Redis in production)
const recentSubmissions = new Map();
const DUPLICATE_WINDOW = 5 * 60 * 1000; // 5 minutes

/**
 * Middleware to detect duplicate submissions
 */
const detectDuplicates = (req, res, next) => {
  try {
    const contentHash = InputSanitizer.generateContentHash({
      subject: req.body.subject,
      message: req.body.message
    });

    const key = `${req.ip}_${contentHash}`;
    const lastSubmission = recentSubmissions.get(key);

    if (lastSubmission && (Date.now() - lastSubmission) < DUPLICATE_WINDOW) {
      console.warn(`⚠️  Duplicate submission detected from IP: ${req.ip}`);
      return res.status(429).json({
        success: false,
        message: 'Duplicate submission detected. Please wait a few minutes before submitting again.',
        error: {
          code: 'DUPLICATE_SUBMISSION',
          retryAfter: '5 minutes'
        }
      });
    }

    // Store this submission
    recentSubmissions.set(key, Date.now());

    // Cleanup old entries (prevent memory leak)
    if (recentSubmissions.size > 1000) {
      const cutoff = Date.now() - DUPLICATE_WINDOW;
      for (const [k, v] of recentSubmissions.entries()) {
        if (v < cutoff) {
          recentSubmissions.delete(k);
        }
      }
    }

    next();
  } catch (error) {
    // Don't block request if duplicate detection fails
    console.error('Duplicate detection error:', error);
    next();
  }
};

/**
 * Middleware to detect injection attempts
 */
const detectInjection = (req, res, next) => {
  try {
    const fields = ['name', 'subject', 'message'];
    
    for (const field of fields) {
      if (req.body[field] && InputSanitizer.detectInjectionAttempt(req.body[field])) {
        console.warn(`⚠️  Injection attempt detected in field '${field}' from IP: ${req.ip}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid input detected. Please remove any HTML or script tags.',
          error: {
            code: 'INVALID_INPUT',
            field
          }
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Injection detection error:', error);
    next();
  }
};

/**
 * POST /api/support
 * Submit a support request
 * 
 * Security Layers:
 * 1. Rate Limiting (3 requests per 15 minutes)
 * 2. Input Validation (express-validator)
 * 3. Injection Detection
 * 4. Input Sanitization
 * 5. Duplicate Detection
 * 6. Secure Error Handling
 */
router.post(
  '/',
  supportSubmissionLimiter, // Layer 1: Rate limiting
  [
    // Layer 2: Input validation
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .matches(/^[\p{L}\p{M}\s\-'.]+$/u)
      .withMessage('Name contains invalid characters'),
    
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .isLength({ max: 254 })
      .withMessage('Email address too long')
      .normalizeEmail(),
    
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ min: 5, max: 200 })
      .withMessage('Subject must be between 5 and 200 characters')
      .custom((value) => {
        // Ensure no excessive special characters
        const specialCharCount = (value.match(/[^a-zA-Z0-9\s]/g) || []).length;
        if (specialCharCount > value.length * 0.3) {
          throw new Error('Subject contains too many special characters');
        }
        return true;
      }),
    
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Message must be between 10 and 5000 characters'),
    
    body('category')
      .optional()
      .trim()
      .isIn([
        'General Inquiry',
        'Technical Support',
        'Billing Question',
        'Feature Request',
        'Bug Report',
        'Account Issue'
      ])
      .withMessage('Invalid category'),
  ],
  detectInjection, // Layer 3: Injection detection
  detectDuplicates, // Layer 5: Duplicate detection
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn(`⚠️  Validation errors from IP ${req.ip}:`, errors.array());
        return res.status(400).json({
          success: false,
          message: 'Please check your input and try again.',
          errors: errors.array().map(err => ({
            field: err.path,
            message: err.msg
          }))
        });
      }

      // Layer 4: Sanitize all inputs
      let sanitizedData;
      try {
        sanitizedData = InputSanitizer.sanitizeSupportRequest(req.body);
      } catch (sanitizeError) {
        console.error('❌ Sanitization error:', sanitizeError);
        return res.status(400).json({
          success: false,
          message: 'Invalid input format. Please check your data and try again.',
          error: {
            code: 'SANITIZATION_FAILED'
          }
        });
      }

      // Validate sanitized data is not empty
      if (!sanitizedData.name || !sanitizedData.email || !sanitizedData.subject || !sanitizedData.message) {
        return res.status(400).json({
          success: false,
          message: 'Required fields cannot be empty after sanitization.'
        });
      }

      const userAgent = req.headers['user-agent'] || 'Not provided';
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Layer 6: Send emails with error handling
      let supportResult, confirmationResult;

      try {
        // Send email to support team
        supportResult = await emailService.sendSupportRequest({
          ...sanitizedData,
          userAgent,
          ipAddress // Include IP for security monitoring
        });
      } catch (emailError) {
        console.error('❌ Failed to send support email:', emailError);
        // Continue to send confirmation even if support email fails
      }

      try {
        // Send confirmation email to user
        confirmationResult = await emailService.sendSupportConfirmation(sanitizedData);
      } catch (emailError) {
        console.error('❌ Failed to send confirmation email:', emailError);
        // Don't fail the request if confirmation fails
      }

      // Log successful submission (sanitized)
      console.log(`📧 Support request received:`, {
        from: sanitizedData.email,
        subject: sanitizedData.subject,
        category: sanitizedData.category,
        ip: ipAddress,
        timestamp: new Date().toISOString()
      });

      // Layer 7: Secure response (don't leak sensitive info)
      res.status(200).json({
        success: true,
        message: 'Your support request has been submitted successfully. We\'ll get back to you within 24 hours.',
        data: {
          submittedAt: new Date().toISOString(),
          category: sanitizedData.category,
          // Don't expose email service details in production
          ...(process.env.NODE_ENV === 'development' && {
            emailStatus: {
              support: supportResult?.success,
              confirmation: confirmationResult?.success
            }
          })
        }
      });

    } catch (error) {
      // Secure error handling - don't leak implementation details
      console.error('❌ Support request error:', {
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({
        success: false,
        message: 'We encountered an error processing your request. Please try again or contact us directly at support@callsheets.com',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          // Only show details in development
          ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }
      });
    }
  }
);

/**
 * GET /api/support/test
 * Test endpoint to verify email service is working
 */
router.get('/test', async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode'
      });
    }

    const testEmail = req.query.email || 'test@example.com';
    
    const result = await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email from Call Sheet Converter',
      text: 'This is a test email to verify the email service is working correctly.',
      html: '<p>This is a <strong>test email</strong> to verify the email service is working correctly.</p>'
    });

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

module.exports = router;

