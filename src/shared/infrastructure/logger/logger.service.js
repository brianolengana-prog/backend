/**
 * Logger Service
 * Centralized logging utility using Winston
 * 
 * Refactored from src/utils/logger.js to shared infrastructure
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      // Remove internal winston properties
      const { [Symbol.for('level')]: _, [Symbol.for('message')]: __, ...meta } = metadata;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
    }
    
    return msg;
  })
);

// JSON format for file logging (structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

class LoggerService {
  constructor() {
    const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    
    this.logger = winston.createLogger({
      level: logLevel,
      format: fileFormat,
      defaultMeta: {
        service: 'callsheets-backend',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Console transport (always enabled)
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'production' 
            ? fileFormat // JSON in production
            : consoleFormat // Human-readable in development
        }),
        
        // Error log file (errors only)
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: fileFormat
        }),
        
        // Combined log file (all levels)
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          format: fileFormat
        })
      ],
      
      // Handle exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: fileFormat
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: fileFormat
        })
      ]
    });
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|object} error - Error object or metadata
   * @param {object} meta - Additional metadata
   */
  error(message, error = null, meta = {}) {
    const errorMeta = error
      ? { ...meta, error: error.message, stack: error.stack }
      : meta;
    this.logger.error(message, errorMeta);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  /**
   * Get Winston logger instance (for advanced usage)
   * @returns {winston.Logger}
   */
  getLogger() {
    return this.logger;
  }

  /**
   * Create child logger with context
   * @param {object} context - Context metadata
   * @returns {object} Logger with context methods
   */
  withContext(context) {
    return {
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      error: (message, error = null, meta = {}) => this.error(message, error, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta }),
    };
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {object} metadata - Additional metadata
   */
  performance(operation, duration, metadata = {}) {
    this.info('Performance metric', {
      type: 'performance',
      operation,
      duration,
      ...metadata
    });
  }
}

module.exports = new LoggerService();

