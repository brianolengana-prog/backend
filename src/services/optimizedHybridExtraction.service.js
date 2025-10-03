/**
 * Optimized Hybrid Extraction Service
 * 
 * Enterprise-grade extraction that intelligently combines:
 * - Intelligent strategy selection based on document analysis
 * - GPT-4o Mini optimization with token management
 * - Cost-aware processing based on user plan
 * - Performance learning and adaptation
 * - Real-time service health monitoring
 */

const intelligentStrategy = require('./intelligentStrategy.service');
const extractionService = require('./extraction.service');
const aiExtractionService = require('./aiExtraction.service');
const optimizedAIExtractionService = require('./optimizedAIExtraction.service');
const awsTextractService = require('./awsTextract.service');
const documentAnalysisService = require('./documentAnalysis.service');
const adaptivePatternService = require('./adaptivePattern.service');
const contextAwareAIService = require('./contextAwareAI.service');
const { PrismaClient } = require('@prisma/client');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/optimized-hybrid.log' })
  ]
});

class OptimizedHybridExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.strategyService = intelligentStrategy;
    this.processingStats = new Map();
    
    // Service health tracking
    this.serviceHealth = {
      ai: { available: true, lastCheck: Date.now() },
      textract: { available: true, lastCheck: Date.now() },
      pattern: { available: true, lastCheck: Date.now() }
    };

    logger.info('🚀 Optimized Hybrid Extraction Service initialized');
  }

  /**
   * Main optimized extraction method with intelligent context awareness
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = this.generateExtractionId();

    try {
      logger.info('🚀 Starting intelligent hybrid extraction', {
        extractionId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        userId: options.userId
      });

      // Step 1: Document analysis for context awareness
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType);
      const documentAnalysis = await documentAnalysisService.analyzeDocument(
        extractedText, 
        fileName, 
        mimeType
      );

      // Step 2: Generate adaptive patterns based on analysis
      const adaptivePatterns = await adaptivePatternService.generatePatterns(
        documentAnalysis, 
        extractedText
      );

      // Step 3: Intelligent strategy selection with context
      const strategy = await this.strategyService.selectOptimalStrategy(
        fileBuffer, 
        mimeType, 
        fileName, 
        {
          ...options,
          documentAnalysis,
          adaptivePatterns
        }
      );

      logger.info('🎯 Selected context-aware strategy', {
        extractionId,
        strategy: strategy.name,
        confidence: strategy.confidence,
        reasoning: strategy.reasoning,
        documentStructure: documentAnalysis.documentStructure
      });

      // Step 4: Execute extraction with full context
      let result;
      if (strategy.name === 'context_aware_ai' || documentAnalysis.confidence > 0.8) {
        result = await contextAwareAIService.extractContacts(fileBuffer, mimeType, fileName, {
          ...options,
          documentAnalysis,
          adaptivePatterns
        });
      } else {
        result = await this.executeExtractionWithMonitoring(
          strategy,
          fileBuffer,
          mimeType,
          fileName,
          options,
          extractionId
        );
      }

      // Step 5: Post-process with context awareness
      const finalResult = await this.postProcessWithContext(
        result,
        strategy,
        documentAnalysis,
        adaptivePatterns,
        options,
        extractionId
      );

      // Step 4: Update performance metrics
      const processingTime = Date.now() - startTime;
      await this.updatePerformanceMetrics(strategy.name, processingTime, finalResult, extractionId);

      logger.info('✅ Optimized hybrid extraction completed', {
        extractionId,
        strategy: strategy.name,
        processingTime,
        contactsFound: finalResult.contacts?.length || 0,
        confidence: strategy.confidence
      });

      return finalResult;

    } catch (error) {
      logger.error('❌ Optimized hybrid extraction failed', {
        extractionId,
        error: error.message,
        stack: error.stack
      });

      // Attempt fallback strategy
      return await this.executeFallbackStrategy(fileBuffer, mimeType, fileName, options, extractionId);
    }
  }

  /**
   * Execute extraction with real-time monitoring
   */
  async executeExtractionWithMonitoring(strategy, fileBuffer, mimeType, fileName, options, extractionId) {
    const monitoring = {
      startTime: Date.now(),
      steps: [],
      errors: [],
      performance: {}
    };

    try {
      // Update service health before processing
      await this.updateServiceHealth();

      let result;
      let actualMethod = strategy.name;

      // Execute based on selected strategy
      switch (strategy.name) {
        case 'pattern-only':
          result = await this.executePatternExtraction(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        case 'ai-only':
          result = await this.executeAIExtraction(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        case 'aws-textract-only':
          result = await this.executeTextractExtraction(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        case 'hybrid-pattern-ai':
          result = await this.executeHybridPatternAI(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        case 'hybrid-textract-ai':
          result = await this.executeHybridTextractAI(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        case 'hybrid-adaptive':
          result = await this.executeAdaptiveHybrid(fileBuffer, mimeType, fileName, options, monitoring);
          break;

        default:
          throw new Error(`Unknown strategy: ${strategy.name}`);
      }

      // Add monitoring data to result
      result.monitoring = {
        extractionId,
        strategy: strategy.name,
        actualMethod,
        processingTime: Date.now() - monitoring.startTime,
        steps: monitoring.steps,
        errors: monitoring.errors,
        performance: monitoring.performance
      };

      return result;

    } catch (error) {
      monitoring.errors.push({
        step: 'execution',
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Execute pattern-only extraction
   */
  async executePatternExtraction(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'pattern-extraction', startTime: Date.now() });

    const result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);

    monitoring.steps[monitoring.steps.length - 1].endTime = Date.now();
    monitoring.performance.patternExtraction = Date.now() - monitoring.steps[monitoring.steps.length - 1].startTime;

    return result;
  }

  /**
   * Execute AI-only extraction with GPT-4o Mini optimization
   */
  async executeAIExtraction(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'ai-extraction', startTime: Date.now() });

    // Check if we should use optimized AI service
    const shouldUseOptimized = this.shouldUseOptimizedAI(fileBuffer, options);
    
    let result;
    if (shouldUseOptimized) {
      result = await optimizedAIExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
    } else {
      result = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
    }

    monitoring.steps[monitoring.steps.length - 1].endTime = Date.now();
    monitoring.performance.aiExtraction = Date.now() - monitoring.steps[monitoring.steps.length - 1].startTime;

    return result;
  }

  /**
   * Execute AWS Textract extraction
   */
  async executeTextractExtraction(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'textract-extraction', startTime: Date.now() });

    const result = await awsTextractService.extractTextFromDocument(fileBuffer, mimeType, fileName, options);

    monitoring.steps[monitoring.steps.length - 1].endTime = Date.now();
    monitoring.performance.textractExtraction = Date.now() - monitoring.steps[monitoring.steps.length - 1].startTime;

    return result;
  }

  /**
   * Execute hybrid pattern + AI extraction
   */
  async executeHybridPatternAI(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'hybrid-pattern-ai', startTime: Date.now() });

    // Step 1: Try pattern extraction first (fast and free)
    let patternResult;
    try {
      patternResult = await this.executePatternExtraction(fileBuffer, mimeType, fileName, options, monitoring);
    } catch (error) {
      logger.warn('⚠️ Pattern extraction failed in hybrid', { error: error.message });
      patternResult = { success: false, contacts: [] };
    }

    // Step 2: If pattern found few contacts, try AI
    if (patternResult.success && patternResult.contacts && patternResult.contacts.length < 10) {
      try {
        const aiResult = await this.executeAIExtraction(fileBuffer, mimeType, fileName, options, monitoring);
        
        if (aiResult.success && aiResult.contacts && aiResult.contacts.length > patternResult.contacts.length) {
          logger.info('✅ AI found more contacts than pattern, using AI result');
          return aiResult;
        }
      } catch (error) {
        logger.warn('⚠️ AI extraction failed in hybrid', { error: error.message });
      }
    }

    monitoring.steps[monitoring.steps.length - 1].endTime = Date.now();
    return patternResult;
  }

  /**
   * Execute hybrid Textract + AI extraction
   */
  async executeHybridTextractAI(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'hybrid-textract-ai', startTime: Date.now() });

    // Step 1: Extract text with Textract
    const textractResult = await this.executeTextractExtraction(fileBuffer, mimeType, fileName, options, monitoring);
    
    if (!textractResult.success) {
      throw new Error(`Textract failed: ${textractResult.error}`);
    }

    // Step 2: Extract contacts from text using AI
    const aiResult = await optimizedAIExtractionService.extractContactsFromText(
      textractResult.text, 
      options
    );

    monitoring.steps[monitoring.steps.length - 1].endTime = Date.now();
    return aiResult;
  }

  /**
   * Execute adaptive hybrid extraction
   */
  async executeAdaptiveHybrid(fileBuffer, mimeType, fileName, options, monitoring) {
    monitoring.steps.push({ step: 'adaptive-hybrid', startTime: Date.now() });

    // Analyze document in real-time
    const docAnalysis = await this.strategyService.analyzeDocument(fileBuffer, mimeType, fileName);
    
    // Choose execution path based on real-time analysis
    if (docAnalysis.isScannedPDF) {
      return await this.executeHybridTextractAI(fileBuffer, mimeType, fileName, options, monitoring);
    } else if (docAnalysis.complexityScore > 0.7) {
      return await this.executeAIExtraction(fileBuffer, mimeType, fileName, options, monitoring);
    } else if (docAnalysis.estimatedContacts < 20) {
      return await this.executePatternExtraction(fileBuffer, mimeType, fileName, options, monitoring);
    } else {
      return await this.executeHybridPatternAI(fileBuffer, mimeType, fileName, options, monitoring);
    }
  }

  /**
   * Post-process and validate results
   */
  async postProcessResults(result, strategy, fileBuffer, mimeType, fileName, options, extractionId) {
    if (!result.success) {
      return result;
    }

    // Validate and clean contacts
    const cleanedContacts = this.validateAndCleanContacts(result.contacts || []);
    
    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(cleanedContacts, fileBuffer, mimeType);
    
    // Add metadata
    result.metadata = {
      ...result.metadata,
      extractionId,
      strategy: strategy.name,
      confidence: strategy.confidence,
      qualityMetrics,
      processingTime: result.monitoring?.processingTime || 0,
      optimized: true,
      hybridProcessing: true
    };

    result.contacts = cleanedContacts;

    return result;
  }

  /**
   * Execute fallback strategy
   */
  async executeFallbackStrategy(fileBuffer, mimeType, fileName, options, extractionId) {
    logger.info('🔄 Executing fallback strategy', { extractionId });

    try {
      // Always fallback to pattern extraction as it's most reliable
      const result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
      
      result.metadata = {
        ...result.metadata,
        extractionId,
        strategy: 'fallback-pattern',
        fallback: true,
        optimized: true
      };

      return result;

    } catch (error) {
      logger.error('❌ Fallback strategy also failed', { extractionId, error: error.message });
      
      return {
        success: false,
        error: 'All extraction methods failed',
        contacts: [],
        metadata: {
          extractionId,
          strategy: 'failed',
          fallback: true,
          error: error.message
        }
      };
    }
  }

  /**
   * Helper methods
   */
  shouldUseOptimizedAI(fileBuffer, options) {
    // Use optimized AI for large files or when explicitly requested
    return fileBuffer.length > 1024 * 1024 || options.useOptimizedAI === true;
  }

  validateAndCleanContacts(contacts) {
    if (!Array.isArray(contacts)) return [];

    return contacts
      .filter(contact => contact && typeof contact === 'object')
      .map(contact => ({
        id: contact.id || this.generateContactId(),
        name: this.cleanString(contact.name),
        email: this.cleanEmail(contact.email),
        phone: this.cleanPhone(contact.phone),
        role: this.cleanString(contact.role),
        company: this.cleanString(contact.company),
        department: this.cleanString(contact.department),
        confidence: contact.confidence || 0.8,
        metadata: contact.metadata || {}
      }))
      .filter(contact => contact.name || contact.email || contact.phone);
  }

  cleanString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().replace(/\s+/g, ' ');
  }

  cleanEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const cleaned = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleaned) ? cleaned : '';
  }

  cleanPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 ? phone.trim() : '';
  }

  calculateQualityMetrics(contacts, fileBuffer, mimeType) {
    const totalContacts = contacts.length;
    const contactsWithEmail = contacts.filter(c => c.email).length;
    const contactsWithPhone = contacts.filter(c => c.phone).length;
    const contactsWithRole = contacts.filter(c => c.role).length;
    
    return {
      totalContacts,
      completeness: {
        email: totalContacts > 0 ? (contactsWithEmail / totalContacts) : 0,
        phone: totalContacts > 0 ? (contactsWithPhone / totalContacts) : 0,
        role: totalContacts > 0 ? (contactsWithRole / totalContacts) : 0
      },
      averageConfidence: totalContacts > 0 ? 
        contacts.reduce((sum, c) => sum + (c.confidence || 0), 0) / totalContacts : 0,
      qualityScore: this.calculateOverallQualityScore(contacts)
    };
  }

  calculateOverallQualityScore(contacts) {
    if (contacts.length === 0) return 0;

    const scores = contacts.map(contact => {
      let score = 0;
      if (contact.name) score += 0.3;
      if (contact.email) score += 0.3;
      if (contact.phone) score += 0.2;
      if (contact.role) score += 0.1;
      if (contact.company) score += 0.1;
      return score;
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  async updateServiceHealth() {
    // Update service health status
    this.serviceHealth.ai.lastCheck = Date.now();
    this.serviceHealth.textract.lastCheck = Date.now();
    this.serviceHealth.pattern.lastCheck = Date.now();
  }

  async updatePerformanceMetrics(strategy, processingTime, result, extractionId) {
    try {
      const stats = this.processingStats.get(strategy) || {
        total: 0,
        successful: 0,
        totalTime: 0,
        avgTime: 0,
        avgContacts: 0,
        totalContacts: 0
      };

      stats.total++;
      if (result.success) stats.successful++;
      stats.totalTime += processingTime;
      stats.avgTime = stats.totalTime / stats.total;
      
      if (result.contacts) {
        stats.totalContacts += result.contacts.length;
        stats.avgContacts = stats.totalContacts / stats.total;
      }

      this.processingStats.set(strategy, stats);

      // Log to database for learning
      await this.prisma.extractionPerformance.create({
        data: {
          extractionId,
          strategy,
          processingTime,
          success: result.success,
          contactsFound: result.contacts?.length || 0,
          qualityScore: result.metadata?.qualityMetrics?.qualityScore || 0
        }
      });

    } catch (error) {
      logger.warn('⚠️ Failed to update performance metrics', { error: error.message });
    }
  }

  generateExtractionId() {
    return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateContactId() {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service health status
   */
  /**
   * Extract text from document
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    return await extractionService.extractTextFromDocument(fileBuffer, mimeType);
  }

  /**
   * Post-process results with context awareness
   */
  async postProcessWithContext(result, strategy, documentAnalysis, adaptivePatterns, options, extractionId) {
    try {
      // Enhanced post-processing with context
      const enhancedResult = await this.postProcessResults(result, strategy, options, extractionId);
      
      // Add context metadata
      enhancedResult.metadata = {
        ...enhancedResult.metadata,
        documentAnalysis,
        adaptivePatterns: adaptivePatterns.length,
        contextAware: true,
        extractionId
      };

      // Learn from this extraction
      await this.learnFromExtraction(documentAnalysis, enhancedResult, options.fileName || 'unknown');

      return enhancedResult;
    } catch (error) {
      logger.error('❌ Context-aware post-processing failed', { error: error.message });
      return result;
    }
  }

  /**
   * Learn from extraction for continuous improvement
   */
  async learnFromExtraction(documentAnalysis, result, fileName) {
    try {
      // Update pattern performance
      if (result.contacts && result.contacts.length > 0) {
        for (const contact of result.contacts) {
          if (contact.patternId) {
            adaptivePatternService.updatePatternPerformance(contact.patternId, true);
          }
        }
      }

      // Store learning data
      const learningEntry = {
        fileName,
        documentAnalysis,
        contactsFound: result.contacts?.length || 0,
        successRate: result.contacts?.length > 0 ? 1 : 0,
        timestamp: Date.now()
      };

      this.processingStats.set(fileName, learningEntry);

      logger.info('🧠 Learning from extraction', {
        fileName,
        contactsFound: result.contacts?.length || 0,
        documentStructure: documentAnalysis.documentStructure
      });
    } catch (error) {
      logger.warn('⚠️ Failed to learn from extraction', { error: error.message });
    }
  }

  getHealthStatus() {
    return {
      optimized: true,
      strategyService: true,
      performanceStats: Object.fromEntries(this.processingStats),
      serviceHealth: this.serviceHealth
    };
  }
}

module.exports = new OptimizedHybridExtractionService();
