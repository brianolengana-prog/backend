/**
 * Enterprise Extraction Orchestrator
 * Coordinates all enterprise-grade extraction components for maximum scalability
 */

const QueueManager = require('./QueueManager');
const DocumentClassifier = require('./DocumentClassifier');
const MonitoringService = require('./MonitoringService');
const CircuitBreaker = require('./CircuitBreaker');

// Define CacheManager before using it
class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  async get(key) {
    return this.cache.get(key);
  }

  async set(key, value, options = {}) {
    this.cache.set(key, value);
    
    if (options.ttl) {
      setTimeout(() => {
        this.cache.delete(key);
      }, options.ttl * 1000);
    }
  }

  async getStats() {
    return { size: this.cache.size };
  }

  clear() {
    this.cache.clear();
  }

  async shutdown() {
    this.cache.clear();
  }
}

class EnterpriseExtractionOrchestrator {
  constructor() {
    this.queueManager = QueueManager;
    this.documentClassifier = DocumentClassifier;
    this.monitoring = MonitoringService;
    this.circuitBreaker = new CircuitBreaker();
    this.cache = new CacheManager();
    
    this.strategies = new Map();
    this.loadBalancer = new LoadBalancer();
    this.retryManager = new RetryManager();
    
    this.initializeStrategies();
    this.setupEventHandlers();
  }

  initializeStrategies() {
    // Load all available extraction strategies (with error handling)
    try {
      this.strategies.set('adaptive_extraction', require('../extraction/ExtractionOrchestrator'));
    } catch (error) {
      console.warn('⚠️ Could not load adaptive_extraction strategy:', error.message);
    }
    
    // Only load strategies that actually exist
    // Other strategies can be added later when their files are created
    console.log('🎯 Extraction strategies initialized:', Array.from(this.strategies.keys()));
  }

  setupEventHandlers() {
    // Monitor extraction events
    this.monitoring.on('alert', (alert) => {
      this.handleAlert(alert);
    });

    // Handle circuit breaker events
    this.circuitBreaker.on('open', (service) => {
      console.log(`⚡ Circuit breaker opened for ${service}`);
      this.monitoring.recordEvent('circuit_breaker_open', { service });
    });

    this.circuitBreaker.on('close', (service) => {
      console.log(`✅ Circuit breaker closed for ${service}`);
      this.monitoring.recordEvent('circuit_breaker_close', { service });
    });
  }

  /**
   * Main enterprise extraction method
   * Handles routing, load balancing, caching, monitoring, and error recovery
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = this.generateExtractionId();
    
    try {
      console.log(`🚀 Starting enterprise extraction [${extractionId}]`);
      
      // Record extraction request
      this.monitoring.recordExtractionRequest(
        options.documentType || 'unknown',
        'started',
        options.userId,
        { extractionId, fileName, fileSize: fileBuffer.length }
      );

      // Step 1: Check cache first
      const cacheKey = this.generateCacheKey(fileBuffer, options);
      const cachedResult = await this.cache.get(cacheKey);
      
      if (cachedResult && !options.bypassCache) {
        console.log(`💾 Cache hit for extraction [${extractionId}]`);
        this.monitoring.recordExtractionRequest('unknown', 'cache_hit', options.userId);
        return this.formatCachedResult(cachedResult, extractionId);
      }

      // Step 2: Determine processing mode (sync vs async)
      const processingMode = this.determineProcessingMode(fileBuffer, options);
      
      if (processingMode === 'async') {
        return await this.processAsync(fileBuffer, mimeType, fileName, options, extractionId);
      } else {
        return await this.processSync(fileBuffer, mimeType, fileName, options, extractionId);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`❌ Enterprise extraction failed [${extractionId}]:`, error.message);
      
      this.monitoring.recordExtractionRequest(
        options.documentType || 'unknown',
        'failed',
        options.userId,
        { extractionId, error: error.message, processingTime }
      );

      return {
        success: false,
        extractionId,
        error: error.message,
        processingTime,
        retryable: this.isRetryableError(error)
      };
    }
  }

  async processSync(fileBuffer, mimeType, fileName, options, extractionId) {
    const startTime = Date.now();
    
    try {
      // Step 1: Document classification
      const classification = await this.documentClassifier.classifyDocument(
        fileBuffer.toString('utf-8').substring(0, 5000), // First 5KB for classification
        fileName,
        options
      );

      console.log(`🎯 Document classified [${extractionId}]:`, {
        type: classification.documentType.type,
        layout: classification.layoutType.type,
        strategy: classification.extractionStrategy,
        confidence: classification.confidence
      });

      // Step 2: Select and execute extraction strategy
      const strategy = this.selectOptimalStrategy(classification, options);
      const result = await this.executeStrategy(
        strategy,
        fileBuffer,
        mimeType,
        fileName,
        { ...options, classification, extractionId }
      );

      // Step 3: Post-process and validate results
      const processedResult = await this.postProcessResults(result, classification, options);

      // Step 4: Cache successful results
      if (processedResult.success && processedResult.contacts.length > 0) {
        const cacheKey = this.generateCacheKey(fileBuffer, options);
        await this.cache.set(cacheKey, processedResult, { ttl: 3600 }); // 1 hour TTL
      }

      const processingTime = Date.now() - startTime;

      // Step 5: Record metrics
      this.monitoring.recordExtractionDuration(
        classification.documentType.type,
        strategy,
        processingTime,
        { extractionId, contactsFound: processedResult.contacts.length }
      );

      this.monitoring.recordExtractionAccuracy(
        classification.documentType.type,
        strategy,
        processedResult.confidence || 0.5,
        { extractionId }
      );

      this.monitoring.recordContactsExtracted(
        classification.documentType.type,
        strategy,
        processedResult.contacts.length,
        { extractionId }
      );

      this.monitoring.recordExtractionRequest(
        classification.documentType.type,
        'completed',
        options.userId,
        { extractionId, processingTime, contactsFound: processedResult.contacts.length }
      );

      return {
        ...processedResult,
        extractionId,
        processingMode: 'sync',
        classification,
        strategy,
        processingTime
      };

    } catch (error) {
      // Log the error details for debugging
      console.error('❌ Synchronous processing error:', {
        message: error.message,
        stack: error.stack,
        extractionId
      });
      throw new Error(`Synchronous processing failed: ${error.message}`);
    }
  }

  async processAsync(fileBuffer, mimeType, fileName, options, extractionId) {
    try {
      // Add job to appropriate queue based on priority and file size
      const queueName = this.selectQueue(fileBuffer, options);
      
      const jobResult = await this.queueManager.addJob(
        queueName,
        'document-extraction',
        {
          fileBuffer,
          mimeType,
          fileName,
          options: { ...options, extractionId }
        },
        {
          userId: options.userId,
          priority: options.priority || 'standard',
          metadata: { extractionId, fileName, fileSize: fileBuffer.length }
        }
      );

      console.log(`📋 Queued extraction job [${extractionId}] in ${queueName}`);

      return {
        success: true,
        extractionId,
        processingMode: 'async',
        jobId: jobResult.jobId,
        queueName: jobResult.queueName,
        estimatedWaitTime: jobResult.estimatedWaitTime,
        status: 'queued'
      };

    } catch (error) {
      throw new Error(`Asynchronous processing failed: ${error.message}`);
    }
  }

  async executeStrategy(strategyName, fileBuffer, mimeType, fileName, options) {
    const strategy = this.strategies.get(strategyName);
    
    if (!strategy) {
      console.warn(`⚠️ Strategy ${strategyName} not found, falling back to adaptive`);
      return await this.strategies.get('adaptive_extraction').extractContacts(
        fileBuffer, mimeType, fileName, options
      );
    }

    // Execute with circuit breaker protection
    return await this.circuitBreaker.execute(strategyName, async () => {
      return await strategy.extractContacts(fileBuffer, mimeType, fileName, options);
    });
  }

  selectOptimalStrategy(classification, options) {
    const { documentType, layoutType, extractionStrategy } = classification;
    
    // Priority order for strategy selection
    const strategyPriority = [
      extractionStrategy, // Classifier's recommendation
      options.preferredStrategy, // User preference
      this.getDefaultStrategy(documentType.type), // Document type default
      'adaptive_extraction' // Final fallback
    ];

    // Return first available strategy
    for (const strategy of strategyPriority) {
      if (strategy && this.strategies.has(strategy)) {
        return strategy;
      }
    }

    return 'adaptive_extraction';
  }

  getDefaultStrategy(documentType) {
    const defaults = {
      'call_sheet': 'form_pattern_extraction',
      'invoice': 'financial_document_extraction',
      'resume': 'resume_extraction',
      'contract': 'legal_document_extraction',
      'medical_record': 'medical_record_extraction',
      'financial_statement': 'financial_document_extraction'
    };

    return defaults[documentType];
  }

  determineProcessingMode(fileBuffer, options) {
    // Factors for async processing decision
    const fileSize = fileBuffer.length;
    const isLargeFile = fileSize > 10 * 1024 * 1024; // 10MB
    const isBatchRequest = options.batch === true;
    const hasLowPriority = options.priority === 'low' || options.priority === 'batch';
    const isComplexDocument = options.complexity === 'high';

    // Force async for certain conditions
    if (isLargeFile || isBatchRequest || hasLowPriority || isComplexDocument) {
      return 'async';
    }

    // Check current system load
    const systemLoad = this.getSystemLoad();
    if (systemLoad > 0.8) { // 80% load threshold
      return 'async';
    }

    return options.processingMode || 'sync';
  }

  selectQueue(fileBuffer, options) {
    const fileSize = fileBuffer.length;
    const priority = options.priority || 'standard';

    if (priority === 'urgent') return 'extraction-high-priority';
    if (priority === 'batch' || fileSize > 50 * 1024 * 1024) return 'extraction-batch';
    if (options.requiresAI) return 'ai-processing';
    
    return 'extraction-standard';
  }

  async postProcessResults(result, classification, options) {
    if (!result.success) return result;

    // Enterprise post-processing pipeline
    const pipeline = [
      this.validateBusinessRules,
      this.enhanceWithAI,
      this.deduplicateContacts,
      this.enrichContactData,
      this.applyPrivacyFilters,
      this.calculateConfidenceScores
    ];

    let processedResult = { ...result };

    for (const processor of pipeline) {
      try {
        processedResult = await processor.call(this, processedResult, classification, options);
      } catch (error) {
        console.warn(`⚠️ Post-processing step failed:`, error.message);
        // Continue with other steps
      }
    }

    return processedResult;
  }

  async validateBusinessRules(result, classification, options) {
    // Implement business rule validation
    // e.g., minimum contact count, required fields, etc.
    
    const validatedContacts = result.contacts.filter(contact => {
      // Business rule: contacts must have either phone or email
      return contact.phone || contact.email;
    });

    return {
      ...result,
      contacts: validatedContacts,
      metadata: {
        ...result.metadata,
        businessRulesApplied: true,
        originalContactCount: result.contacts.length,
        validatedContactCount: validatedContacts.length
      }
    };
  }

  async enhanceWithAI(result, classification, options) {
    // Skip AI enhancement if disabled or already AI-processed
    if (options.skipAI || result.metadata?.aiEnhanced) {
      return result;
    }

    try {
      // Use AI to enhance contact information
      const aiStrategy = this.strategies.get('ai_enhanced_extraction');
      if (aiStrategy && result.contacts.length > 0) {
        const enhancedResult = await aiStrategy.enhanceContacts(
          result.contacts,
          result.metadata?.originalText || '',
          options
        );

        return {
          ...result,
          contacts: enhancedResult.contacts || result.contacts,
          metadata: {
            ...result.metadata,
            aiEnhanced: true,
            aiConfidence: enhancedResult.confidence
          }
        };
      }
    } catch (error) {
      console.warn('⚠️ AI enhancement failed:', error.message);
    }

    return result;
  }

  async deduplicateContacts(result, classification, options) {
    if (result.contacts.length <= 1) return result;

    const uniqueContacts = [];
    const seen = new Set();

    for (const contact of result.contacts) {
      const key = this.generateContactKey(contact);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueContacts.push(contact);
      }
    }

    return {
      ...result,
      contacts: uniqueContacts,
      metadata: {
        ...result.metadata,
        deduplicationApplied: true,
        duplicatesRemoved: result.contacts.length - uniqueContacts.length
      }
    };
  }

  async enrichContactData(result, classification, options) {
    // Skip enrichment if disabled
    if (options.skipEnrichment) return result;

    // Enrich contacts with additional data sources
    const enrichedContacts = await Promise.all(
      result.contacts.map(async (contact) => {
        try {
          // Example: lookup company information, validate emails, etc.
          const enrichedContact = { ...contact };
          
          // Add any enrichment logic here
          if (contact.email && !contact.company) {
            enrichedContact.company = this.inferCompanyFromEmail(contact.email);
          }

          return enrichedContact;
        } catch (error) {
          console.warn('⚠️ Contact enrichment failed for:', contact.name);
          return contact;
        }
      })
    );

    return {
      ...result,
      contacts: enrichedContacts,
      metadata: {
        ...result.metadata,
        enrichmentApplied: true
      }
    };
  }

  async applyPrivacyFilters(result, classification, options) {
    // Apply privacy and compliance filters
    if (!options.privacyMode) return result;

    const filteredContacts = result.contacts.map(contact => {
      const filtered = { ...contact };
      
      // Mask sensitive information based on privacy settings
      if (options.maskEmails) {
        filtered.email = this.maskEmail(contact.email);
      }
      
      if (options.maskPhones) {
        filtered.phone = this.maskPhone(contact.phone);
      }

      return filtered;
    });

    return {
      ...result,
      contacts: filteredContacts,
      metadata: {
        ...result.metadata,
        privacyFiltersApplied: true,
        privacyMode: options.privacyMode
      }
    };
  }

  async calculateConfidenceScores(result, classification, options) {
    // Enhanced confidence calculation based on multiple factors
    const contacts = result.contacts.map(contact => {
      let confidence = contact.confidence || 0.5;
      
      // Boost confidence based on completeness
      if (contact.name && contact.phone && contact.email) confidence += 0.2;
      if (contact.role && contact.company) confidence += 0.1;
      
      // Boost confidence based on document classification confidence
      confidence += (classification.confidence * 0.1);
      
      // Ensure confidence is between 0 and 1
      confidence = Math.max(0, Math.min(1, confidence));
      
      return { ...contact, confidence };
    });

    const overallConfidence = contacts.length > 0 
      ? contacts.reduce((sum, c) => sum + c.confidence, 0) / contacts.length 
      : 0;

    return {
      ...result,
      contacts,
      confidence: overallConfidence,
      metadata: {
        ...result.metadata,
        confidenceCalculated: true,
        overallConfidence
      }
    };
  }

  // Utility methods
  generateExtractionId() {
    return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCacheKey(fileBuffer, options) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    hash.update(JSON.stringify(options));
    return `extraction_${hash.digest('hex').substring(0, 16)}`;
  }

  generateContactKey(contact) {
    const name = (contact.name || '').toLowerCase().trim();
    const phone = (contact.phone || '').replace(/\D/g, '');
    const email = (contact.email || '').toLowerCase().trim();
    return `${name}_${phone}_${email}`;
  }

  inferCompanyFromEmail(email) {
    if (!email || !email.includes('@')) return '';
    
    const domain = email.split('@')[1];
    const company = domain.split('.')[0];
    
    // Capitalize first letter
    return company.charAt(0).toUpperCase() + company.slice(1);
  }

  maskEmail(email) {
    if (!email || !email.includes('@')) return email;
    
    const [local, domain] = email.split('@');
    const maskedLocal = local.length > 2 
      ? local.substring(0, 2) + '*'.repeat(local.length - 2)
      : '*'.repeat(local.length);
    
    return `${maskedLocal}@${domain}`;
  }

  maskPhone(phone) {
    if (!phone) return phone;
    
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      return phone.replace(/\d/g, (match, index) => 
        index < phone.length - 4 ? '*' : match
      );
    }
    
    return phone;
  }

  getSystemLoad() {
    // Simplified system load calculation
    // In production, this would use proper system monitoring
    const memUsage = process.memoryUsage();
    const memPercent = memUsage.heapUsed / memUsage.heapTotal;
    
    return memPercent;
  }

  formatCachedResult(cachedResult, extractionId) {
    return {
      ...cachedResult,
      extractionId,
      cached: true,
      processingTime: 0
    };
  }

  isRetryableError(error) {
    const retryableErrors = [
      'TIMEOUT',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'NETWORK_ERROR'
    ];
    
    return retryableErrors.some(type => 
      error.message.toUpperCase().includes(type)
    );
  }

  handleAlert(alert) {
    console.log(`🚨 Handling alert: ${alert.type}`);
    
    // Implement alert handling logic
    switch (alert.type) {
      case 'high_error_rate':
        this.circuitBreaker.openCircuit('extraction');
        break;
      case 'queue_backup':
        // Trigger worker scaling
        break;
      case 'memory_pressure':
        // Clear caches, trigger garbage collection
        this.cache.clear();
        break;
    }
  }

  // Health and status methods
  async getStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        queueManager: await this.queueManager.getQueueStats(),
        documentClassifier: this.documentClassifier.getHealthStatus(),
        monitoring: this.monitoring.getHealthStatus(),
        circuitBreaker: this.circuitBreaker.getStatus(),
        cache: await this.cache.getStats()
      },
      strategies: Array.from(this.strategies.keys()),
      metrics: this.monitoring.getMetricsForDashboard()
    };
  }

  async shutdown() {
    console.log('🛑 Shutting down Enterprise Extraction Orchestrator...');
    
    await this.queueManager.shutdown();
    await this.cache.shutdown();
    this.monitoring.shutdown();
    
    console.log('✅ Enterprise Extraction Orchestrator shutdown complete');
  }
}

// Simple implementations for missing components
class CircuitBreaker extends require('events').EventEmitter {
  constructor() {
    super();
    this.circuits = new Map();
  }

  async execute(service, operation) {
    // Simplified circuit breaker implementation
    return await operation();
  }

  openCircuit(service) {
    this.circuits.set(service, 'open');
    this.emit('open', service);
  }

  getStatus() {
    return { circuits: Object.fromEntries(this.circuits) };
  }
}


class LoadBalancer {
  constructor() {
    this.instances = [];
  }
}

class RetryManager {
  constructor() {
    this.maxRetries = 3;
  }
}

module.exports = new EnterpriseExtractionOrchestrator();
