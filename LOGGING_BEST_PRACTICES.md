# Logging Best Practices Guide

## ❌ Why NOT to use `console.log` in Production

### Problems with `console.log`:
1. **No log levels** - Can't filter by severity
2. **No structured data** - Hard to parse and analyze
3. **No file persistence** - Logs lost on server restart
4. **Performance impact** - Synchronous I/O blocks event loop
5. **No log rotation** - Files grow indefinitely
6. **No request tracking** - Can't trace requests across services
7. **No error context** - Missing stack traces and metadata

## ✅ Best Practices (Implemented)

### 1. Centralized Logger (`src/utils/logger.js`)
- ✅ Winston-based structured logging
- ✅ JSON format for production (parseable)
- ✅ Human-readable format for development
- ✅ File logging with rotation
- ✅ Error/exception handling
- ✅ Request context tracking

### 2. Log Levels
```javascript
logger.error()  // Errors that need immediate attention
logger.warn()   // Warnings (potential issues)
logger.info()   // Informational (normal operations)
logger.debug()  // Debug info (development only)
```

### 3. Structured Logging
```javascript
// ❌ Bad
console.log('User logged in');

// ✅ Good
logger.info('User logged in', {
  userId: user.id,
  email: user.email,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

### 4. Request Context
```javascript
// Create request-scoped logger
const requestLogger = logger.withContext({
  requestId: req.id,
  userId: req.user?.id,
  path: req.path
});

requestLogger.info('Processing extraction');
```

### 5. Error Logging
```javascript
// ❌ Bad
console.error('Error:', error);

// ✅ Good
logger.error('Extraction failed', {
  error: error.message,
  stack: error.stack,
  userId: req.user.id,
  fileName: req.file.originalname,
  context: { extractionId, fileSize }
});
```

## 📋 Migration Strategy

### Phase 1: Critical Errors (Immediate)
Replace all `console.error()` with `logger.error()`

### Phase 2: Important Info (High Priority)
Replace important `console.log()` with `logger.info()`

### Phase 3: Debug Logs (Low Priority)
Replace `console.log()` with `logger.debug()` for verbose logging

### Phase 4: Remove All Console (Final)
Remove remaining `console.*` calls

## 🔧 Usage Examples

### Basic Usage
```javascript
const logger = require('../utils/logger');

logger.info('Operation started', { userId, operationId });
logger.error('Operation failed', { error: error.message, stack: error.stack });
logger.warn('Rate limit approaching', { userId, requests: count });
logger.debug('Debug information', { data });
```

### With Request Context
```javascript
const logger = require('../utils/logger');

// In route handler
const requestLogger = logger.withContext({
  requestId: req.id,
  userId: req.user?.id,
  method: req.method,
  path: req.path
});

requestLogger.info('File uploaded', { fileName: req.file.originalname });
```

### Performance Logging
```javascript
logger.performance('extraction', 1234, {
  contactsFound: 20,
  fileSize: 315379,
  userId
});
```

### Request Logging
```javascript
// In middleware
logger.request(req, res, duration);
```

## 📊 Log Files Structure

```
logs/
  ├── error.log      # Errors only (level: error)
  ├── combined.log   # All logs (all levels)
  ├── exceptions.log # Uncaught exceptions
  └── rejections.log # Unhandled promise rejections
```

## 🎯 Environment Configuration

```bash
# Development
LOG_LEVEL=debug
NODE_ENV=development

# Production
LOG_LEVEL=info
NODE_ENV=production
```

## 📈 Benefits

1. **Searchable** - JSON format enables log aggregation tools
2. **Traceable** - Request IDs track operations across services
3. **Persistent** - Logs saved to files, not lost on restart
4. **Rotated** - Automatic log rotation prevents disk fill
5. **Structured** - Easy to parse and analyze
6. **Contextual** - Rich metadata for debugging
7. **Performant** - Async logging doesn't block event loop

## 🚀 Next Steps

1. ✅ Centralized logger created
2. ⏳ Migrate critical routes (extraction, auth, contacts)
3. ⏳ Add request ID middleware
4. ⏳ Set up log aggregation (optional: ELK, Datadog, etc.)
5. ⏳ Configure log retention policies

