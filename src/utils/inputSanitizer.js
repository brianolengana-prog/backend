const validator = require('validator');

/**
 * Input Sanitization Utility
 * 
 * Security Principles Applied:
 * - Input Validation: Never trust user input
 * - Defense in Depth: Multiple sanitization layers
 * - Whitelisting over Blacklisting: Only allow known safe patterns
 * 
 * OWASP Top 10 Protection:
 * - A03:2021 – Injection
 * - A07:2021 – Cross-Site Scripting (XSS)
 */

class InputSanitizer {
  /**
   * Sanitize text input (removes HTML, scripts, and dangerous characters)
   */
  static sanitizeText(input, maxLength = 5000) {
    if (!input || typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // 1. Trim whitespace
    sanitized = sanitized.trim();

    // 2. Limit length to prevent DoS
    sanitized = sanitized.substring(0, maxLength);

    // 3. Escape HTML entities to prevent XSS
    sanitized = validator.escape(sanitized);

    // 4. Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // 5. Normalize unicode characters
    sanitized = sanitized.normalize('NFKC');

    return sanitized;
  }

  /**
   * Sanitize email address
   */
  static sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
      return '';
    }

    // Normalize and validate
    const normalized = validator.normalizeEmail(email, {
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false
    });

    // Validate format
    if (!normalized || !validator.isEmail(normalized)) {
      throw new Error('Invalid email format');
    }

    // Additional security checks
    if (normalized.length > 254) { // RFC 5321
      throw new Error('Email address too long');
    }

    return normalized;
  }

  /**
   * Sanitize name (allows letters, spaces, hyphens, apostrophes)
   */
  static sanitizeName(name, maxLength = 100) {
    if (!name || typeof name !== 'string') {
      return '';
    }

    let sanitized = name.trim();

    // Limit length
    sanitized = sanitized.substring(0, maxLength);

    // Allow only safe characters for names
    // Letters (any language), spaces, hyphens, apostrophes, periods
    sanitized = sanitized.replace(/[^\p{L}\p{M}\s\-'.]/gu, '');

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Escape HTML entities
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  /**
   * Sanitize subject line
   */
  static sanitizeSubject(subject, maxLength = 200) {
    if (!subject || typeof subject !== 'string') {
      return '';
    }

    let sanitized = subject.trim();

    // Limit length
    sanitized = sanitized.substring(0, maxLength);

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Escape HTML
    sanitized = validator.escape(sanitized);

    return sanitized;
  }

  /**
   * Sanitize message content
   */
  static sanitizeMessage(message, maxLength = 5000) {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let sanitized = message.trim();

    // Limit length to prevent DoS
    sanitized = sanitized.substring(0, maxLength);

    // Remove null bytes and control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Escape HTML to prevent XSS
    sanitized = validator.escape(sanitized);

    // Limit consecutive newlines
    sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');

    return sanitized;
  }

  /**
   * Validate and sanitize category
   */
  static sanitizeCategory(category, allowedCategories) {
    if (!category || typeof category !== 'string') {
      return null;
    }

    const sanitized = category.trim();

    // Whitelist validation
    if (!allowedCategories.includes(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Comprehensive sanitization for support request
   */
  static sanitizeSupportRequest(data) {
    const allowedCategories = [
      'General Inquiry',
      'Technical Support',
      'Billing Question',
      'Feature Request',
      'Bug Report',
      'Account Issue'
    ];

    try {
      return {
        name: this.sanitizeName(data.name, 100),
        email: this.sanitizeEmail(data.email),
        subject: this.sanitizeSubject(data.subject, 200),
        message: this.sanitizeMessage(data.message, 5000),
        category: this.sanitizeCategory(data.category, allowedCategories) || 'General Inquiry'
      };
    } catch (error) {
      throw new Error(`Input sanitization failed: ${error.message}`);
    }
  }

  /**
   * Detect potential injection attempts
   */
  static detectInjectionAttempt(input) {
    if (!input || typeof input !== 'string') {
      return false;
    }

    // Common injection patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /<iframe/gi,
      /eval\(/gi,
      /expression\(/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /<embed/gi,
      /<object/gi,
      /<!--.*-->/g,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Rate limit by content hash (prevent duplicate spam)
   */
  static generateContentHash(data) {
    const crypto = require('crypto');
    const content = JSON.stringify({
      subject: data.subject,
      message: data.message
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = InputSanitizer;

