/**
 * Concurrency Limiter Middleware
 * 
 * Prevents server overload by limiting concurrent operations
 * Implements both global and per-user limits
 * 
 * @module ConcurrencyLimiter
 * @follows Resource Throttling Pattern
 */

const pLimit = require('p-limit');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class ConcurrencyLimiter {
  constructor() {
    // Import p-limit (supports both ESM and CJS)
    const limit = pLimit.default || pLimit;
    
    // Global limit: Max concurrent extractions across all users
    this.globalLimit = limit(
      parseInt(process.env.MAX_CONCURRENT_EXTRACTIONS) || 10
    );
    
    // Per-user limits: Prevent single user from hogging resources
    this.userLimiters = new Map();
    this.perUserLimit = parseInt(process.env.MAX_CONCURRENT_PER_USER) || 2;
    this.limitConstructor = limit;
    
    // Cleanup stale limiters every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    
    logger.info('✅ Concurrency limiter initialized', {
      globalLimit: this.globalLimit.activeCount + this.globalLimit.pendingCount,
      perUserLimit: this.perUserLimit
    });
  }
  
  /**
   * Get or create per-user limiter
   * @param {string} userId - User ID
   * @returns {Function} p-limit instance for user
   */
  getUserLimiter(userId) {
    if (!this.userLimiters.has(userId)) {
      const limiter = this.limitConstructor(this.perUserLimit);
      limiter.lastUsed = Date.now();
      this.userLimiters.set(userId, limiter);
      
      logger.debug('Created limiter for user', { userId });
    }
    
    const limiter = this.userLimiters.get(userId);
    limiter.lastUsed = Date.now();
    return limiter;
  }
  
  /**
   * Execute operation with concurrency limits
   * 
   * Applies both global and per-user limits
   * 
   * @param {string} userId - User ID
   * @param {Function} operation - Async operation to execute
   * @param {Object} context - Operation context for logging
   * @returns {Promise} Operation result
   */
  async execute(userId, operation, context = {}) {
    const userLimiter = this.getUserLimiter(userId);
    
    const stats = {
      userId,
      globalActive: this.globalLimit.activeCount,
      globalPending: this.globalLimit.pendingCount,
      userActive: userLimiter.activeCount,
      userPending: userLimiter.pendingCount,
      ...context
    };
    
    // Log if queued
    if (this.globalLimit.pendingCount > 0 || userLimiter.pendingCount > 0) {
      logger.warn('⏳ Request queued due to concurrency limits', stats);
    }
    
    const startTime = Date.now();
    
    try {
      // Apply both global and per-user limits
      const result = await this.globalLimit(() =>
        userLimiter(async () => {
          logger.info('🚀 Extraction started', {
            ...stats,
            queueTime: Date.now() - startTime
          });
          
          return await operation();
        })
      );
      
      const duration = Date.now() - startTime;
      logger.info('✅ Extraction completed', {
        ...stats,
        duration: `${duration}ms`
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Extraction failed', {
        ...stats,
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Middleware wrapper for Express routes
   * 
   * Usage:
   *   router.post('/upload', 
   *     concurrencyLimiter.middleware('extraction'),
   *     async (req, res) => { ... }
   *   )
   */
  middleware(operationName = 'operation') {
    return async (req, res, next) => {
      const userId = req.user?.id || 'anonymous';
      const userLimiter = this.getUserLimiter(userId);
      
      // Check if user is at limit
      if (userLimiter.activeCount >= this.perUserLimit) {
        logger.warn('🚫 User concurrent limit reached', {
          userId,
          operationName,
          activeCount: userLimiter.activeCount,
          limit: this.perUserLimit
        });
        
        return res.status(429).json({
          success: false,
          error: 'Too many concurrent requests',
          errorCode: 'CONCURRENT_LIMIT_REACHED',
          retryAfter: 5,  // Suggest retry in 5 seconds
          activeRequests: userLimiter.activeCount
        });
      }
      
      // Check if global is saturated
      if (this.globalLimit.activeCount >= 10 && this.globalLimit.pendingCount > 20) {
        logger.warn('🚫 Global queue too deep', {
          userId,
          operationName,
          globalActive: this.globalLimit.activeCount,
          globalPending: this.globalLimit.pendingCount
        });
        
        return res.status(503).json({
          success: false,
          error: 'Service temporarily overloaded',
          errorCode: 'SERVICE_OVERLOADED',
          retryAfter: 30,  // Suggest retry in 30 seconds
          queueDepth: this.globalLimit.pendingCount
        });
      }
      
      // Attach limiter to request for route handler to use
      req.concurrencyLimiter = this;
      req.userId = userId;
      req.operationName = operationName;
      
      next();
    };
  }
  
  /**
   * Clean up stale user limiters
   * Removes limiters that haven't been used in 10 minutes
   * @private
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    let removed = 0;
    
    for (const [userId, limiter] of this.userLimiters.entries()) {
      if (now - limiter.lastUsed > staleThreshold && limiter.activeCount === 0) {
        this.userLimiters.delete(userId);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info('🧹 Cleaned up stale limiters', {
        removed,
        remaining: this.userLimiters.size
      });
    }
  }
  
  /**
   * Get current stats
   * @returns {Object} Limiter statistics
   */
  getStats() {
    const userStats = {};
    for (const [userId, limiter] of this.userLimiters.entries()) {
      userStats[userId] = {
        active: limiter.activeCount,
        pending: limiter.pendingCount
      };
    }
    
    return {
      global: {
        active: this.globalLimit.activeCount,
        pending: this.globalLimit.pendingCount,
        limit: 10
      },
      users: userStats,
      totalUsers: this.userLimiters.size
    };
  }
  
  /**
   * Cleanup on shutdown
   */
  shutdown() {
    clearInterval(this.cleanupInterval);
    this.userLimiters.clear();
    logger.info('🛑 Concurrency limiter shut down');
  }
}

// Export singleton instance
module.exports = new ConcurrencyLimiter();

