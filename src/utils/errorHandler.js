/**
 * Centralized Error Handler
 * Provides consistent error handling across all extraction routes
 */

class ExtractionError extends Error {
  constructor(message, code, statusCode = 500, metadata = {}) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error codes for different failure scenarios
 */
const ERROR_CODES = {
  // Validation errors (400)
  NO_FILE_UPLOADED: 'NO_FILE_UPLOADED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  
  // Processing errors (500)
  TEXT_EXTRACTION_FAILED: 'TEXT_EXTRACTION_FAILED',
  CONTACT_EXTRACTION_FAILED: 'CONTACT_EXTRACTION_FAILED',
  EXTRACTION_TIMEOUT: 'EXTRACTION_TIMEOUT',
  INSUFFICIENT_TEXT: 'INSUFFICIENT_TEXT',
  
  // Database errors (500)
  DATABASE_ERROR: 'DATABASE_ERROR',
  SAVE_CONTACTS_FAILED: 'SAVE_CONTACTS_FAILED',
  
  // Usage errors (403)
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  REQUIRES_UPGRADE: 'REQUIRES_UPGRADE',
  
  // Service errors (503)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  
  // Unknown (500)
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.NO_FILE_UPLOADED]: {
    title: 'No File Uploaded',
    description: 'Please select a file to upload.',
    userAction: 'Choose a file and try again.'
  },
  [ERROR_CODES.INVALID_FILE_TYPE]: {
    title: 'Invalid File Type',
    description: 'This file type is not supported.',
    userAction: 'Please upload a PDF, DOCX, XLSX, or image file.'
  },
  [ERROR_CODES.FILE_TOO_LARGE]: {
    title: 'File Too Large',
    description: 'The file you uploaded is too large.',
    userAction: 'Please upload a file smaller than 50MB for PDFs or 25MB for images.'
  },
  [ERROR_CODES.TEXT_EXTRACTION_FAILED]: {
    title: 'Unable to Read File',
    description: 'We couldn\'t extract text from this file.',
    userAction: 'Please ensure the file contains readable text and try again.'
  },
  [ERROR_CODES.CONTACT_EXTRACTION_FAILED]: {
    title: 'Extraction Failed',
    description: 'We couldn\'t find any contacts in this file.',
    userAction: 'Please ensure the file is a valid call sheet with contact information.'
  },
  [ERROR_CODES.EXTRACTION_TIMEOUT]: {
    title: 'Processing Timeout',
    description: 'The file is too large or complex to process.',
    userAction: 'Please try a smaller file or contact support for assistance.'
  },
  [ERROR_CODES.INSUFFICIENT_TEXT]: {
    title: 'Insufficient Text',
    description: 'The file doesn\'t contain enough readable text.',
    userAction: 'Please ensure the file is not blank or heavily encrypted.'
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    title: 'Database Error',
    description: 'We couldn\'t save your extraction results.',
    userAction: 'Please try again. If the problem persists, contact support.'
  },
  [ERROR_CODES.USAGE_LIMIT_EXCEEDED]: {
    title: 'Upload Limit Reached',
    description: 'You\'ve reached your monthly upload limit.',
    userAction: 'Upgrade your plan to continue uploading files.'
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    title: 'Service Temporarily Unavailable',
    description: 'Our extraction service is temporarily unavailable.',
    userAction: 'Please try again in a few minutes.'
  },
  [ERROR_CODES.AI_SERVICE_UNAVAILABLE]: {
    title: 'AI Enhancement Unavailable',
    description: 'AI enhancement is temporarily unavailable. Using pattern-based extraction.',
    userAction: 'Results may be less accurate. Try again later for AI-enhanced extraction.'
  },
  [ERROR_CODES.UNKNOWN_ERROR]: {
    title: 'Unknown Error',
    description: 'An unexpected error occurred.',
    userAction: 'Please try again. If the problem persists, contact support.'
  }
};

/**
 * Classify error and return appropriate error code
 */
function classifyError(error) {
  const message = error.message || '';
  
  // Timeout errors
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      code: ERROR_CODES.EXTRACTION_TIMEOUT,
      statusCode: 408
    };
  }
  
  // Text extraction errors
  if (message.includes('extract text') || message.includes('Unable to read')) {
    return {
      code: ERROR_CODES.TEXT_EXTRACTION_FAILED,
      statusCode: 422
    };
  }
  
  // Insufficient text
  if (message.includes('insufficient text') || message.includes('no text found')) {
    return {
      code: ERROR_CODES.INSUFFICIENT_TEXT,
      statusCode: 422
    };
  }
  
  // Contact extraction errors
  if (message.includes('no contacts') || message.includes('contact extraction')) {
    return {
      code: ERROR_CODES.CONTACT_EXTRACTION_FAILED,
      statusCode: 422
    };
  }
  
  // Usage errors
  if (message.includes('usage') || message.includes('limit exceeded')) {
    return {
      code: ERROR_CODES.USAGE_LIMIT_EXCEEDED,
      statusCode: 403
    };
  }
  
  // Database errors
  if (message.includes('database') || message.includes('prisma') || message.includes('query')) {
    return {
      code: ERROR_CODES.DATABASE_ERROR,
      statusCode: 500
    };
  }
  
  // Service unavailable
  if (message.includes('unavailable') || message.includes('connection refused')) {
    return {
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      statusCode: 503
    };
  }
  
  // AI service errors
  if (message.includes('AI') || message.includes('OpenAI') || message.includes('GPT')) {
    return {
      code: ERROR_CODES.AI_SERVICE_UNAVAILABLE,
      statusCode: 503
    };
  }
  
  // Default to unknown error
  return {
    code: ERROR_CODES.UNKNOWN_ERROR,
    statusCode: 500
  };
}

/**
 * Format error for API response
 */
function formatErrorResponse(error, includeStack = false) {
  let errorCode, statusCode, metadata = {};
  
  // If it's already an ExtractionError, use its properties
  if (error instanceof ExtractionError) {
    errorCode = error.code;
    statusCode = error.statusCode;
    metadata = error.metadata;
  } else {
    // Classify the error
    const classification = classifyError(error);
    errorCode = classification.code;
    statusCode = classification.statusCode;
  }
  
  // Get user-friendly message
  const friendlyError = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
  
  const response = {
    success: false,
    error: {
      code: errorCode,
      title: friendlyError.title,
      description: friendlyError.description,
      userAction: friendlyError.userAction,
      timestamp: new Date().toISOString()
    },
    metadata
  };
  
  // Add technical details in development
  if (includeStack && process.env.NODE_ENV !== 'production') {
    response.error.technicalDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  
  return { statusCode, response };
}

/**
 * Log error with appropriate severity
 */
function logError(error, context = {}) {
  const classification = classifyError(error);
  
  const logData = {
    timestamp: new Date().toISOString(),
    errorCode: classification.code,
    message: error.message,
    stack: error.stack,
    context
  };
  
  // Log based on severity
  if (classification.statusCode >= 500) {
    console.error('❌ CRITICAL ERROR:', JSON.stringify(logData, null, 2));
  } else if (classification.statusCode >= 400) {
    console.warn('⚠️ CLIENT ERROR:', JSON.stringify(logData, null, 2));
  } else {
    console.log('ℹ️ INFO:', JSON.stringify(logData, null, 2));
  }
}

/**
 * Express error handling middleware
 */
function errorMiddleware(err, req, res, next) {
  // Log the error
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    file: req.file?.originalname
  });
  
  // Format and send response
  const { statusCode, response } = formatErrorResponse(
    err,
    process.env.NODE_ENV !== 'production'
  );
  
  res.status(statusCode).json(response);
}

/**
 * Async route wrapper to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ExtractionError,
  ERROR_CODES,
  ERROR_MESSAGES,
  classifyError,
  formatErrorResponse,
  logError,
  errorMiddleware,
  asyncHandler
};

