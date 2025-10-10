/**
 * Performance Monitor Utility
 * 
 * Tracks and logs performance metrics for all operations
 * Enables identification of bottlenecks and optimization opportunities
 * 
 * @module PerformanceMonitor
 * @follows Observer Pattern
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/performance.log',
      level: 'info'
    })
  ]
});

class PerformanceMonitor {
  constructor() {
    this.timers = new Map();
    this.metrics = new Map();
    
    // Aggregate stats
    this.aggregates = {
      extraction: { count: 0, totalTime: 0, avgTime: 0, min: Infinity, max: 0 },
      database: { count: 0, totalTime: 0, avgTime: 0, min: Infinity, max: 0 },
      ai: { count: 0, totalTime: 0, avgTime: 0, min: Infinity, max: 0 },
      pattern: { count: 0, totalTime: 0, avgTime: 0, min: Infinity, max: 0 }
    };
  }
  
  /**
   * Start timing an operation
   * 
   * @param {string} operationId - Unique operation identifier
   * @param {Object} context - Operation context metadata
   * @returns {Function} - Stop function to end timing
   */
  start(operationId, context = {}) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    this.timers.set(operationId, {
      startTime,
      startMemory,
      context
    });
    
    logger.debug('⏱️ Performance tracking started', {
      operationId,
      ...context
    });
    
    // Return stop function (convenience)
    return () => this.stop(operationId);
  }
  
  /**
   * Stop timing an operation
   * 
   * @param {string} operationId - Operation identifier
   * @param {Object} additionalContext - Additional metadata to log
   * @returns {Object} - Performance metrics
   */
  stop(operationId, additionalContext = {}) {
    const timer = this.timers.get(operationId);
    
    if (!timer) {
      logger.warn('⚠️ No timer found for operation', { operationId });
      return null;
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    const duration = endTime - timer.startTime;
    const memoryDelta = {
      heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - timer.startMemory.heapTotal,
      external: endMemory.external - timer.startMemory.external
    };
    
    const metrics = {
      operationId,
      duration,
      durationMs: duration,
      durationSec: (duration / 1000).toFixed(2),
      startTime: timer.startTime,
      endTime,
      memoryDelta,
      memoryDeltaMB: {
        heapUsed: (memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memoryDelta.heapTotal / 1024 / 1024).toFixed(2),
        external: (memoryDelta.external / 1024 / 1024).toFixed(2)
      },
      ...timer.context,
      ...additionalContext
    };
    
    // Store metrics
    this.metrics.set(operationId, metrics);
    
    // Update aggregates
    this.updateAggregates(metrics);
    
    // Log performance
    const level = duration > 10000 ? 'warn' : 'info';  // Warn if > 10s
    logger.log(level, '⏱️ Performance metrics', metrics);
    
    // Cleanup
    this.timers.delete(operationId);
    
    return metrics;
  }
  
  /**
   * Update aggregate statistics
   * @private
   */
  updateAggregates(metrics) {
    const operation = metrics.operationType || 'extraction';
    
    if (!this.aggregates[operation]) {
      this.aggregates[operation] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        min: Infinity,
        max: 0
      };
    }
    
    const agg = this.aggregates[operation];
    agg.count++;
    agg.totalTime += metrics.duration;
    agg.avgTime = agg.totalTime / agg.count;
    agg.min = Math.min(agg.min, metrics.duration);
    agg.max = Math.max(agg.max, metrics.duration);
  }
  
  /**
   * Track a specific stage within an operation
   * 
   * @param {string} operationId - Parent operation ID
   * @param {string} stage - Stage name
   * @param {Function} fn - Async function to execute
   * @returns {Promise} - Function result
   */
  async trackStage(operationId, stage, fn) {
    const stageId = `${operationId}:${stage}`;
    const startTime = Date.now();
    
    logger.debug(`🔍 Stage started: ${stage}`, { operationId });
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      logger.info(`✅ Stage completed: ${stage}`, {
        operationId,
        stage,
        duration: `${duration}ms`
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`❌ Stage failed: ${stage}`, {
        operationId,
        stage,
        duration: `${duration}ms`,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Log performance breakdown for an extraction
   * 
   * @param {string} operationId - Operation identifier
   * @param {Object} breakdown - Stage timings
   */
  logBreakdown(operationId, breakdown) {
    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    const percentages = {};
    for (const [stage, time] of Object.entries(breakdown)) {
      percentages[stage] = {
        time: `${time}ms`,
        percentage: `${((time / total) * 100).toFixed(1)}%`
      };
    }
    
    logger.info('📊 Performance breakdown', {
      operationId,
      total: `${total}ms`,
      stages: percentages
    });
  }
  
  /**
   * Get aggregated statistics
   * 
   * @returns {Object} - Aggregate stats for all operations
   */
  getStats() {
    const stats = {};
    
    for (const [operation, agg] of Object.entries(this.aggregates)) {
      stats[operation] = {
        count: agg.count,
        totalTime: `${agg.totalTime}ms`,
        avgTime: `${agg.avgTime.toFixed(2)}ms`,
        minTime: `${agg.min}ms`,
        maxTime: `${agg.max}ms`
      };
    }
    
    return stats;
  }
  
  /**
   * Log current stats
   */
  logStats() {
    logger.info('📈 Performance statistics', this.getStats());
  }
  
  /**
   * Express middleware for automatic request timing
   * 
   * Usage:
   *   app.use(performanceMonitor.middleware())
   */
  middleware() {
    return (req, res, next) => {
      const operationId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const startTime = Date.now();
      
      // Track request
      req.performanceId = operationId;
      req.performanceMonitor = this;
      
      // Override res.json to capture response time
      const originalJson = res.json.bind(res);
      res.json = (data) => {
        const duration = Date.now() - startTime;
        
        logger.info('🌐 Request completed', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          userId: req.user?.id,
          operationId
        });
        
        return originalJson(data);
      };
      
      next();
    };
  }
  
  /**
   * Reset all stats (useful for testing)
   */
  reset() {
    this.timers.clear();
    this.metrics.clear();
    
    for (const operation in this.aggregates) {
      this.aggregates[operation] = {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        min: Infinity,
        max: 0
      };
    }
    
    logger.info('🔄 Performance monitor reset');
  }
}

// Export singleton instance
module.exports = new PerformanceMonitor();

