/**
 * Centralized Logging Utility
 * 
 * Best Practices:
 * - Structured logging with JSON format
 * - Different log levels (error, warn, info, debug)
 * - File logging for production
 * - Console logging for development
 * - Request ID tracking
 * - Error stack traces
 * - Log rotation support
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
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

// Determine log level from environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger instance
const logger = winston.createLogger({
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

/**
 * Create a child logger with additional context
 * Useful for request-scoped logging with request IDs
 */
logger.child = (metadata) => {
  return logger.child(metadata);
};

/**
 * Helper method to log with request context
 */
logger.withContext = (context) => {
  return {
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
  };
};

/**
 * Log performance metrics
 */
logger.performance = (operation, duration, metadata = {}) => {
  logger.info('Performance metric', {
    type: 'performance',
    operation,
    duration,
    ...metadata
  });
};

/**
 * Log API requests
 */
logger.request = (req, res, duration) => {
  logger.info('API request', {
    type: 'request',
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    userId: req.user?.id,
    ip: req.ip
  });
};

/**
 * Log API errors
 */
logger.requestError = (req, error, statusCode = 500) => {
  logger.error('API request error', {
    type: 'request_error',
    method: req.method,
    path: req.path,
    statusCode,
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    ip: req.ip
  });
};

module.exports = logger;

