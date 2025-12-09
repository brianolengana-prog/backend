/**
 * Log Sanitizer Service
 * Filters sensitive data from logs
 * 
 * @module Security
 */

export interface SanitizeOptions {
  removeSensitiveFields?: boolean;
  maskSensitiveFields?: boolean;
  sensitivePatterns?: RegExp[];
}

export class LogSanitizerService {
  private readonly defaultSensitiveFields = [
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'apiKey',
    'api_key',
    'secret',
    'secretKey',
    'secret_key',
    'stripeSecretKey',
    'stripe_secret_key',
    'webhookSecret',
    'webhook_secret',
    'authorization',
    'authorizationHeader',
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'ssn',
    'socialSecurityNumber',
    'email', // Can be sensitive in some contexts
  ];

  private readonly defaultSensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /authorization/i,
    /credit.*card/i,
    /card.*number/i,
    /cvv/i,
    /ssn/i,
    /social.*security/i,
    /bearer\s+[\w-]+/i, // Bearer tokens
    /sk_live_[\w]+/i, // Stripe secret keys
    /sk_test_[\w]+/i, // Stripe test keys
    /pk_live_[\w]+/i, // Stripe publishable keys
    /pk_test_[\w]+/i, // Stripe test publishable keys
    /whsec_[\w]+/i, // Stripe webhook secrets
  ];

  /**
   * Sanitize object by removing or masking sensitive fields
   */
  sanitizeObject(
    obj: Record<string, unknown>,
    options: SanitizeOptions = {}
  ): Record<string, unknown> {
    const {
      removeSensitiveFields = false,
      maskSensitiveFields = true,
      sensitivePatterns = this.defaultSensitivePatterns,
    } = options;

    const sanitized: Record<string, unknown> = {};
    const sensitiveFields = this.defaultSensitiveFields;

    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = this.isSensitiveField(key, sensitiveFields, sensitivePatterns);

      if (isSensitive) {
        if (removeSensitiveFields) {
          // Skip this field
          continue;
        } else if (maskSensitiveFields) {
          // Mask the value
          sanitized[key] = this.maskValue(value);
        } else {
          // Keep but mark as sensitive
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>, options);
      } else if (Array.isArray(value)) {
        // Sanitize array items
        sanitized[key] = value.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return this.sanitizeObject(item as Record<string, unknown>, options);
          }
          return this.isSensitiveField(key, sensitiveFields, sensitivePatterns)
            ? this.maskValue(item)
            : item;
        });
      } else {
        // Check if value itself contains sensitive data
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value, sensitivePatterns);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitize string by masking sensitive patterns
   */
  sanitizeString(str: string, patterns: RegExp[] = this.defaultSensitivePatterns): string {
    let sanitized = str;

    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, (match) => {
        // Mask the matched pattern
        if (match.length <= 4) {
          return '***';
        }
        return match.substring(0, 4) + '***' + match.substring(match.length - 4);
      });
    }

    return sanitized;
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(
    fieldName: string,
    sensitiveFields: string[],
    patterns: RegExp[]
  ): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    // Check exact match
    if (sensitiveFields.some((field) => lowerFieldName.includes(field.toLowerCase()))) {
      return true;
    }

    // Check pattern match
    return patterns.some((pattern) => pattern.test(fieldName));
  }

  /**
   * Mask sensitive value
   */
  private maskValue(value: unknown): string {
    if (typeof value === 'string') {
      if (value.length <= 4) {
        return '***';
      }
      // Show first 2 and last 2 characters
      return value.substring(0, 2) + '***' + value.substring(value.length - 2);
    }

    if (typeof value === 'number') {
      return '***';
    }

    return '[REDACTED]';
  }

  /**
   * Sanitize log message
   */
  sanitizeLogMessage(message: string): string {
    return this.sanitizeString(message);
  }

  /**
   * Sanitize error object
   */
  sanitizeError(error: Error | unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: this.sanitizeString(error.message),
        stack: this.sanitizeString(error.stack || ''),
      };
    }

    return {
      error: '[UNKNOWN_ERROR]',
    };
  }
}

