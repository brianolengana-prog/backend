/**
 * Enterprise Extraction Configuration
 * 
 * Centralized configuration for enterprise-grade extraction features
 */

module.exports = {
  // Extraction engine settings
  extraction: {
    // Enable/disable enterprise features
    enableEnterpriseExtraction: process.env.ENABLE_ENTERPRISE_EXTRACTION !== 'false',
    enableAIEnhancement: process.env.ENABLE_AI_ENHANCEMENT !== 'false',
    enableAdvancedPatterns: process.env.ENABLE_ADVANCED_PATTERNS !== 'false',
    
    // Performance thresholds
    maxProcessingTime: parseInt(process.env.MAX_PROCESSING_TIME) || 30000, // 30 seconds
    maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH) || 100000, // 100KB
    maxContactsPerDocument: parseInt(process.env.MAX_CONTACTS_PER_DOCUMENT) || 500,
    
    // Quality thresholds
    minConfidenceThreshold: parseFloat(process.env.MIN_CONFIDENCE_THRESHOLD) || 0.3,
    defaultConfidenceThreshold: parseFloat(process.env.DEFAULT_CONFIDENCE_THRESHOLD) || 0.6,
    highConfidenceThreshold: parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD) || 0.8,
    
    // AI configuration
    ai: {
      enabled: !!process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
      timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
      
      // AI usage policies
      enableForFallback: process.env.AI_ENABLE_FALLBACK !== 'false',
      enableForEnhancement: process.env.AI_ENABLE_ENHANCEMENT !== 'false',
      enableForValidation: process.env.AI_ENABLE_VALIDATION !== 'false',
      enableForDiscovery: process.env.AI_ENABLE_DISCOVERY !== 'false',
      
      // Cost control
      maxRequestsPerHour: parseInt(process.env.AI_MAX_REQUESTS_PER_HOUR) || 100,
      maxTokensPerHour: parseInt(process.env.AI_MAX_TOKENS_PER_HOUR) || 50000
    },
    
    // Pattern matching configuration
    patterns: {
      enableStructured: process.env.PATTERNS_ENABLE_STRUCTURED !== 'false',
      enableSemiStructured: process.env.PATTERNS_ENABLE_SEMI_STRUCTURED !== 'false',
      enableCallSheet: process.env.PATTERNS_ENABLE_CALL_SHEET !== 'false',
      enableFallback: process.env.PATTERNS_ENABLE_FALLBACK !== 'false',
      
      // Pattern weights for confidence calculation
      weights: {
        structured: parseFloat(process.env.PATTERN_WEIGHT_STRUCTURED) || 0.9,
        semiStructured: parseFloat(process.env.PATTERN_WEIGHT_SEMI_STRUCTURED) || 0.7,
        callSheet: parseFloat(process.env.PATTERN_WEIGHT_CALL_SHEET) || 0.8,
        fallback: parseFloat(process.env.PATTERN_WEIGHT_FALLBACK) || 0.4
      }
    },
    
    // Data validation settings
    validation: {
      enableNameValidation: process.env.VALIDATION_ENABLE_NAME !== 'false',
      enableEmailValidation: process.env.VALIDATION_ENABLE_EMAIL !== 'false',
      enablePhoneValidation: process.env.VALIDATION_ENABLE_PHONE !== 'false',
      enableRoleValidation: process.env.VALIDATION_ENABLE_ROLE !== 'false',
      
      // Validation strictness (strict, normal, lenient)
      strictness: process.env.VALIDATION_STRICTNESS || 'normal',
      
      // Custom validation rules
      customRules: {
        minNameLength: parseInt(process.env.VALIDATION_MIN_NAME_LENGTH) || 2,
        maxNameLength: parseInt(process.env.VALIDATION_MAX_NAME_LENGTH) || 50,
        minPhoneDigits: parseInt(process.env.VALIDATION_MIN_PHONE_DIGITS) || 7,
        maxPhoneDigits: parseInt(process.env.VALIDATION_MAX_PHONE_DIGITS) || 15
      }
    },
    
    // Deduplication settings
    deduplication: {
      enabled: process.env.DEDUPLICATION_ENABLED !== 'false',
      algorithm: process.env.DEDUPLICATION_ALGORITHM || 'fuzzy', // exact, fuzzy, ai
      threshold: parseFloat(process.env.DEDUPLICATION_THRESHOLD) || 0.8,
      
      // Merge strategies
      mergeStrategy: process.env.MERGE_STRATEGY || 'highest_confidence', // highest_confidence, most_complete, ai_enhanced
      preserveOriginal: process.env.PRESERVE_ORIGINAL !== 'false'
    }
  },
  
  // Document type configuration
  documentTypes: {
    callSheet: {
      enabled: process.env.DOCTYPE_CALL_SHEET_ENABLED !== 'false',
      confidence: parseFloat(process.env.DOCTYPE_CALL_SHEET_CONFIDENCE) || 0.9,
      strategy: process.env.DOCTYPE_CALL_SHEET_STRATEGY || 'structured_extraction'
    },
    contactDirectory: {
      enabled: process.env.DOCTYPE_CONTACT_DIRECTORY_ENABLED !== 'false',
      confidence: parseFloat(process.env.DOCTYPE_CONTACT_DIRECTORY_CONFIDENCE) || 0.85,
      strategy: process.env.DOCTYPE_CONTACT_DIRECTORY_STRATEGY || 'tabular_extraction'
    },
    productionSchedule: {
      enabled: process.env.DOCTYPE_PRODUCTION_SCHEDULE_ENABLED !== 'false',
      confidence: parseFloat(process.env.DOCTYPE_PRODUCTION_SCHEDULE_CONFIDENCE) || 0.8,
      strategy: process.env.DOCTYPE_PRODUCTION_SCHEDULE_STRATEGY || 'temporal_extraction'
    },
    crewList: {
      enabled: process.env.DOCTYPE_CREW_LIST_ENABLED !== 'false',
      confidence: parseFloat(process.env.DOCTYPE_CREW_LIST_CONFIDENCE) || 0.85,
      strategy: process.env.DOCTYPE_CREW_LIST_STRATEGY || 'hierarchical_extraction'
    },
    talentSheet: {
      enabled: process.env.DOCTYPE_TALENT_SHEET_ENABLED !== 'false',
      confidence: parseFloat(process.env.DOCTYPE_TALENT_SHEET_CONFIDENCE) || 0.9,
      strategy: process.env.DOCTYPE_TALENT_SHEET_STRATEGY || 'talent_extraction'
    }
  },
  
  // Monitoring and analytics
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    logLevel: process.env.LOG_LEVEL || 'info',
    enablePerformanceMetrics: process.env.ENABLE_PERFORMANCE_METRICS !== 'false',
    enableQualityMetrics: process.env.ENABLE_QUALITY_METRICS !== 'false',
    enableUsageAnalytics: process.env.ENABLE_USAGE_ANALYTICS !== 'false',
    
    // Alerting thresholds
    alerts: {
      processingTimeThreshold: parseInt(process.env.ALERT_PROCESSING_TIME_THRESHOLD) || 25000,
      lowConfidenceThreshold: parseFloat(process.env.ALERT_LOW_CONFIDENCE_THRESHOLD) || 0.3,
      errorRateThreshold: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.1
    }
  },
  
  // Caching configuration
  caching: {
    enabled: process.env.CACHING_ENABLED !== 'false',
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    
    // Cache strategies
    cachePatternResults: process.env.CACHE_PATTERN_RESULTS !== 'false',
    cacheAIResults: process.env.CACHE_AI_RESULTS !== 'false',
    cacheDocumentAnalysis: process.env.CACHE_DOCUMENT_ANALYSIS !== 'false'
  },
  
  // Security settings
  security: {
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
    maxRequestsPerHour: parseInt(process.env.MAX_REQUESTS_PER_HOUR) || 1000,
    
    // Data privacy
    enableDataSanitization: process.env.ENABLE_DATA_SANITIZATION !== 'false',
    enablePIIDetection: process.env.ENABLE_PII_DETECTION !== 'false',
    logSensitiveData: process.env.LOG_SENSITIVE_DATA === 'true'
  },
  
  // Feature flags for gradual rollout
  featureFlags: {
    enableEnterpriseExtractor: process.env.FF_ENTERPRISE_EXTRACTOR !== 'false',
    enableEnhancedAdaptive: process.env.FF_ENHANCED_ADAPTIVE !== 'false',
    enableAIEnhancement: process.env.FF_AI_ENHANCEMENT !== 'false',
    enableAdvancedValidation: process.env.FF_ADVANCED_VALIDATION !== 'false',
    enableQualityMetrics: process.env.FF_QUALITY_METRICS !== 'false'
  },
  
  // Development and testing
  development: {
    enableDebugLogging: process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_LOGGING === 'true',
    enableTestMode: process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_MODE === 'true',
    mockAIResponses: process.env.MOCK_AI_RESPONSES === 'true',
    enablePerformanceProfiling: process.env.ENABLE_PERFORMANCE_PROFILING === 'true'
  }
};
