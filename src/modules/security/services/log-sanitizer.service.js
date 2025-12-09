/**
 * Log Sanitizer Service (JavaScript version)
 * Filters sensitive data from logs
 * 
 * @module Security
 */

class LogSanitizerService {
  constructor() {
    this.defaultSensitiveFields = [
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
      'email',
    ];

    this.defaultSensitivePatterns = [
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
      /bearer\s+[\w-]+/i,
      /sk_live_[\w]+/i,
      /sk_test_[\w]+/i,
      /pk_live_[\w]+/i,
      /pk_test_[\w]+/i,
      /whsec_[\w]+/i,
    ];
  }

  sanitizeObject(obj, options = {}) {
    const {
      removeSensitiveFields = false,
      maskSensitiveFields = true,
      sensitivePatterns = this.defaultSensitivePatterns,
    } = options;

    const sanitized = {};
    const sensitiveFields = this.defaultSensitiveFields;

    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = this.isSensitiveField(key, sensitiveFields, sensitivePatterns);

      if (isSensitive) {
        if (removeSensitiveFields) {
          continue;
        } else if (maskSensitiveFields) {
          sanitized[key] = this.maskValue(value);
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeObject(value, options);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => {
          if (typeof item === 'object' && item !== null) {
            return this.sanitizeObject(item, options);
          }
          return this.isSensitiveField(key, sensitiveFields, sensitivePatterns)
            ? this.maskValue(item)
            : item;
        });
      } else {
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value, sensitivePatterns);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  sanitizeString(str, patterns = this.defaultSensitivePatterns) {
    let sanitized = str;

    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.length <= 4) {
          return '***';
        }
        return match.substring(0, 4) + '***' + match.substring(match.length - 4);
      });
    }

    return sanitized;
  }

  isSensitiveField(fieldName, sensitiveFields, patterns) {
    const lowerFieldName = fieldName.toLowerCase();

    if (sensitiveFields.some((field) => lowerFieldName.includes(field.toLowerCase()))) {
      return true;
    }

    return patterns.some((pattern) => pattern.test(fieldName));
  }

  maskValue(value) {
    if (typeof value === 'string') {
      if (value.length <= 4) {
        return '***';
      }
      return value.substring(0, 2) + '***' + value.substring(value.length - 2);
    }

    if (typeof value === 'number') {
      return '***';
    }

    return '[REDACTED]';
  }

  sanitizeLogMessage(message) {
    return this.sanitizeString(message);
  }

  sanitizeError(error) {
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

module.exports = { LogSanitizerService };

