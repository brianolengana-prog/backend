/**
 * Webhook Error Classifier Service
 * Classifies errors as retryable or non-retryable
 * 
 * @module Webhooks
 */

export enum ErrorCategory {
  RETRYABLE = 'retryable',
  NON_RETRYABLE = 'non_retryable',
  RATE_LIMIT = 'rate_limit',
  VALIDATION = 'validation',
}

export interface ClassifiedError {
  category: ErrorCategory;
  retryable: boolean;
  maxRetries?: number;
  retryDelay?: number;
  reason: string;
}

export class WebhookErrorClassifierService {
  /**
   * Classify error as retryable or non-retryable
   */
  classifyError(error: Error | unknown): ClassifiedError {
    // Handle different error types
    if (error instanceof Error) {
      return this.classifyErrorByMessage(error);
    }

    if (typeof error === 'string') {
      return this.classifyErrorByMessage(new Error(error));
    }

    // Unknown error type - default to non-retryable
    return {
      category: ErrorCategory.NON_RETRYABLE,
      retryable: false,
      reason: 'Unknown error type',
    };
  }

  /**
   * Classify error based on error message and properties
   */
  private classifyErrorByMessage(error: Error): ClassifiedError {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors - retryable
    if (
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      name.includes('network') ||
      name.includes('timeout')
    ) {
      return {
        category: ErrorCategory.RETRYABLE,
        retryable: true,
        maxRetries: 5,
        retryDelay: 2000, // 2 seconds base delay
        reason: 'Network error - retryable',
      };
    }

    // Rate limit errors - retryable with longer delay
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('quota') ||
      message.includes('throttle')
    ) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        retryable: true,
        maxRetries: 3,
        retryDelay: 60000, // 60 seconds for rate limits
        reason: 'Rate limit error - retryable with backoff',
      };
    }

    // 5xx server errors - retryable
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('bad gateway') ||
      message.includes('service unavailable') ||
      message.includes('gateway timeout')
    ) {
      return {
        category: ErrorCategory.RETRYABLE,
        retryable: true,
        maxRetries: 5,
        retryDelay: 5000, // 5 seconds base delay
        reason: 'Server error - retryable',
      };
    }

    // 4xx client errors - generally non-retryable
    if (
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('bad request') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found')
    ) {
      return {
        category: ErrorCategory.VALIDATION,
        retryable: false,
        reason: 'Client error - non-retryable',
      };
    }

    // Signature verification errors - non-retryable
    if (
      message.includes('signature') ||
      message.includes('verification') ||
      message.includes('invalid signature') ||
      message.includes('webhook signature')
    ) {
      return {
        category: ErrorCategory.VALIDATION,
        retryable: false,
        reason: 'Signature verification failed - non-retryable',
      };
    }

    // Database errors - retryable (transient)
    if (
      message.includes('database') ||
      message.includes('connection pool') ||
      message.includes('deadlock') ||
      message.includes('transaction') ||
      message.includes('prisma') ||
      message.includes('query')
    ) {
      return {
        category: ErrorCategory.RETRYABLE,
        retryable: true,
        maxRetries: 3,
        retryDelay: 3000, // 3 seconds base delay
        reason: 'Database error - retryable',
      };
    }

    // Validation errors - non-retryable
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('malformed') ||
      message.includes('parse error')
    ) {
      return {
        category: ErrorCategory.VALIDATION,
        retryable: false,
        reason: 'Validation error - non-retryable',
      };
    }

    // Default: non-retryable for unknown errors
    return {
      category: ErrorCategory.NON_RETRYABLE,
      retryable: false,
      reason: 'Unknown error - non-retryable',
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: Error | unknown): boolean {
    return this.classifyError(error).retryable;
  }

  /**
   * Get retry configuration for error
   */
  getRetryConfig(error: Error | unknown): {
    maxRetries: number;
    baseDelay: number;
  } {
    const classified = this.classifyError(error);

    if (!classified.retryable) {
      return { maxRetries: 0, baseDelay: 0 };
    }

    return {
      maxRetries: classified.maxRetries || 3,
      baseDelay: classified.retryDelay || 2000,
    };
  }
}

