/**
 * Extraction Configuration
 * 
 * Feature flags and configuration for extraction system
 */

module.exports = {
  // Feature flags
  USE_ENTERPRISE_EXTRACTOR: process.env.USE_ENTERPRISE_EXTRACTOR === 'true',
  RUN_SIDE_BY_SIDE_COMPARISON: process.env.RUN_EXTRACTION_COMPARISON === 'true',
  
  // Quality thresholds
  MIN_CONFIDENCE_FOR_AUTO_APPROVAL: parseFloat(process.env.MIN_CONFIDENCE || '0.7'),
  
  // Performance
  EXTRACTION_TIMEOUT_MS: parseInt(process.env.EXTRACTION_TIMEOUT || '60000'),
  
  // Logging
  LOG_EXTRACTION_METRICS: process.env.LOG_EXTRACTION_METRICS !== 'false',
  
  // Migration
  MIGRATION_PHASE: process.env.EXTRACTION_MIGRATION_PHASE || 'testing', // testing, rollout, complete
  
  getConfig() {
    return {
      useEnterpriseExtractor: this.USE_ENTERPRISE_EXTRACTOR,
      runComparison: this.RUN_SIDE_BY_SIDE_COMPARISON,
      minConfidence: this.MIN_CONFIDENCE_FOR_AUTO_APPROVAL,
      timeout: this.EXTRACTION_TIMEOUT_MS,
      logMetrics: this.LOG_EXTRACTION_METRICS,
      phase: this.MIGRATION_PHASE
    };
  }
};

