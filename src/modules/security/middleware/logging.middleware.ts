/**
 * Security Logging Middleware
 * Sanitizes logs before output
 * 
 * @module Security
 */

import { Request, Response, NextFunction } from 'express';
import { LogSanitizerService } from '../services/log-sanitizer.service';

const sanitizer = new LogSanitizerService();

/**
 * Middleware to sanitize request/response logs
 */
export function sanitizeLogsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Store original methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Override res.json to sanitize response
  res.json = function (body: any) {
    const sanitized = sanitizer.sanitizeObject(body || {}, {
      removeSensitiveFields: false,
      maskSensitiveFields: true,
    });
    return originalJson(sanitized);
  };

  // Override res.send to sanitize response
  res.send = function (body: any) {
    if (typeof body === 'string') {
      const sanitized = sanitizer.sanitizeString(body);
      return originalSend(sanitized);
    }
    if (typeof body === 'object') {
      const sanitized = sanitizer.sanitizeObject(body, {
        removeSensitiveFields: false,
        maskSensitiveFields: true,
      });
      return originalSend(sanitized);
    }
    return originalSend(body);
  };

  // Sanitize request body in logs
  if (req.body && Object.keys(req.body).length > 0) {
    req.body = sanitizer.sanitizeObject(req.body, {
      removeSensitiveFields: false,
      maskSensitiveFields: true,
    });
  }

  next();
}

/**
 * Middleware to sanitize console logs
 */
export function setupSanitizedLogging() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function (...args: any[]) {
    const sanitized = args.map((arg) => {
      if (typeof arg === 'string') {
        return sanitizer.sanitizeString(arg);
      }
      if (typeof arg === 'object' && arg !== null) {
        return sanitizer.sanitizeObject(arg as Record<string, unknown>);
      }
      return arg;
    });
    return originalLog.apply(console, sanitized);
  };

  console.error = function (...args: any[]) {
    const sanitized = args.map((arg) => {
      if (typeof arg instanceof Error) {
        return sanitizer.sanitizeError(arg);
      }
      if (typeof arg === 'string') {
        return sanitizer.sanitizeString(arg);
      }
      if (typeof arg === 'object' && arg !== null) {
        return sanitizer.sanitizeObject(arg as Record<string, unknown>);
      }
      return arg;
    });
    return originalError.apply(console, sanitized);
  };

  console.warn = function (...args: any[]) {
    const sanitized = args.map((arg) => {
      if (typeof arg === 'string') {
        return sanitizer.sanitizeString(arg);
      }
      if (typeof arg === 'object' && arg !== null) {
        return sanitizer.sanitizeObject(arg as Record<string, unknown>);
      }
      return arg;
    });
    return originalWarn.apply(console, sanitized);
  };
}

