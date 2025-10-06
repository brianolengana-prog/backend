/**
 * Enhanced Adaptive Extraction Service
 * 
 * Enterprise-grade extraction orchestrator that:
 * - Uses advanced document analysis
 * - Applies intelligent strategy selection
 * - Leverages enterprise contact extractor
 * - Provides comprehensive error handling
 * - Includes performance monitoring
 */

const EnterpriseContactExtractor = require('./EnterpriseContactExtractor');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class EnhancedAdaptiveExtractionService {
  constructor() {
    this.enterpriseExtractor = new EnterpriseContactExtractor();
    
    // Document type classifiers with enhanced detection
    this.documentClassifiers = {
      'call_sheet': {
        keywords: ['call sheet', 'call time', 'location', 'crew', 'talent', 'production', 'shoot'],
        patterns: [/call\s*sheet/i, /crew\s*list/i, /talent\s*list/i, /production\s*info/i],
        confidence: 0.9,
        strategy: 'structured_extraction'
      },
      'contact_directory': {
        keywords: ['directory', 'contacts', 'phone list', 'email list', 'staff list'],
        patterns: [/contact\s*directory/i, /staff\s*directory/i, /phone\s*list/i],
        confidence: 0.85,
        strategy: 'tabular_extraction'
      },
      'production_schedule': {
        keywords: ['schedule', 'timeline', 'shooting schedule', 'call times'],
        patterns: [/shooting\s*schedule/i, /production\s*schedule/i, /call\s*times/i],
        confidence: 0.8,
        strategy: 'temporal_extraction'
      },
      'crew_list': {
        keywords: ['crew', 'department', 'team', 'staff'],
        patterns: [/crew\s*list/i, /department\s*list/i, /team\s*roster/i],
        confidence: 0.85,
        strategy: 'hierarchical_extraction'
      },
      'talent_sheet': {
        keywords: ['talent', 'model', 'actor', 'agency', 'casting'],
        patterns: [/talent\s*sheet/i, /casting\s*list/i, /model\s*list/i],
        confidence: 0.9,
        strategy: 'talent_extraction'
      }
    };

    // Extraction strategies
    this.strategies = {
      'structured_extraction': {
        name: 'structured_extraction',
        description: 'For well-structured documents like call sheets',
        usePatterns: ['structured', 'callSheet'],
        useAI: true,
        aiMode: 'enhancement',
        confidenceThreshold: 0.7
      },
      'tabular_extraction': {
        name: 'tabular_extraction',
        description: 'For tabular data and directories',
        usePatterns: ['structured', 'semiStructured'],
        useAI: true,
        aiMode: 'validation',
        confidenceThreshold: 0.8
      },
      'temporal_extraction': {
        name: 'temporal_extraction',
        description: 'For schedule-based documents',
        usePatterns: ['semiStructured', 'callSheet'],
        useAI: true,
        aiMode: 'enhancement',
        confidenceThreshold: 0.6
      },
      'hierarchical_extraction': {
        name: 'hierarchical_extraction',
        description: 'For department-based crew lists',
        usePatterns: ['structured', 'callSheet'],
        useAI: true,
        aiMode: 'enhancement',
        confidenceThreshold: 0.75
      },
      'talent_extraction': {
        name: 'talent_extraction',
        description: 'For talent and agency information',
        usePatterns: ['callSheet', 'semiStructured'],
        useAI: true,
        aiMode: 'enhancement',
        confidenceThreshold: 0.8
      },
      'fallback_extraction': {
        name: 'fallback_extraction',
        description: 'Fallback for unrecognized documents',
        usePatterns: ['fallback', 'semiStructured'],
        useAI: true,
        aiMode: 'discovery',
        confidenceThreshold: 0.5
      }
    };

    // Performance thresholds
    this.performanceThresholds = {
      maxProcessingTime: 30000, // 30 seconds
      maxTextLength: 100000, // 100KB
      minConfidenceForAI: 0.3,
      maxContactsPerDocument: 500
    };
  }

  /**
   * Main extraction method with enhanced intelligence
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info('🚀 Starting enhanced adaptive extraction', {
      extractionId,
      textLength: text.length,
      options
    });

    try {
      // Step 1: Pre-processing and validation
      const processedText = this.preprocessText(text, extractionId);
      
      // Step 2: Document analysis and classification
      const documentAnalysis = this.analyzeDocument(processedText, extractionId);
      
      // Step 3: Strategy selection
      const strategy = this.selectStrategy(documentAnalysis, options, extractionId);
      
      // Step 4: Execute extraction with selected strategy
      const extractionResult = await this.executeExtraction(
        processedText, 
        strategy, 
        documentAnalysis, 
        extractionId
      );
      
      // Step 5: Post-processing and quality assurance
      const finalResult = this.postProcessResults(
        extractionResult, 
        documentAnalysis, 
        strategy, 
        extractionId
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ Enhanced extraction completed', {
        extractionId,
        contactsFound: finalResult.contacts.length,
        processingTime,
        strategy: strategy.name,
        documentType: documentAnalysis.type
      });

      return {
        success: true,
        contacts: finalResult.contacts,
        metadata: {
          extractionId,
          strategy: strategy.name,
          documentType: documentAnalysis.type,
          confidence: finalResult.averageConfidence,
          processingTime,
          textLength: text.length,
          qualityMetrics: finalResult.qualityMetrics
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('❌ Enhanced extraction failed', {
        extractionId,
        error: error.message,
        processingTime
      });

      // Attempt fallback extraction
      try {
        logger.info('🔄 Attempting fallback extraction', { extractionId });
        
        const fallbackResult = await this.enterpriseExtractor.extractContacts(text, {
          ...options,
          extractionId,
          useAI: false // Disable AI for fallback
        });

        return {
          success: true,
          contacts: fallbackResult.contacts,
          metadata: {
            extractionId,
            strategy: 'fallback',
            documentType: 'unknown',
            confidence: 0.3,
            processingTime: Date.now() - startTime,
            fallbackUsed: true,
            originalError: error.message
          }
        };

      } catch (fallbackError) {
        logger.error('❌ Fallback extraction also failed', {
          extractionId,
          fallbackError: fallbackError.message
        });

        return {
          success: false,
          contacts: [],
          error: error.message,
          metadata: {
            extractionId,
            processingTime: Date.now() - startTime,
            fallbackFailed: true
          }
        };
      }
    }
  }

  /**
   * Preprocess text for better extraction
   */
  preprocessText(text, extractionId) {
    logger.info('🔧 Preprocessing text', { extractionId });

    let processed = text;

    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Clean up excessive whitespace while preserving structure
    processed = processed.replace(/[ \t]+/g, ' '); // Multiple spaces to single space
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple newlines to double newline

    // Fix common OCR errors
    processed = processed.replace(/[""]/g, '"'); // Smart quotes
    processed = processed.replace(/['']/g, "'"); // Smart apostrophes
    processed = processed.replace(/–/g, '-'); // En dash to hyphen
    processed = processed.replace(/—/g, '-'); // Em dash to hyphen

    // Normalize phone number formats for better pattern matching
    processed = processed.replace(/(\d{3})\s*[\.\-]\s*(\d{3})\s*[\.\-]\s*(\d{4})/g, '($1) $2-$3');

    logger.info('✅ Text preprocessing completed', {
      extractionId,
      originalLength: text.length,
      processedLength: processed.length
    });

    return processed;
  }

  /**
   * Enhanced document analysis
   */
  analyzeDocument(text, extractionId) {
    logger.info('📊 Analyzing document structure', { extractionId });

    const analysis = {
      type: 'unknown',
      confidence: 0,
      structure: 'unstructured',
      complexity: 'low',
      estimatedContacts: 0,
      sections: [],
      patterns: [],
      characteristics: {}
    };

    // Analyze document type
    let maxConfidence = 0;
    for (const [type, classifier] of Object.entries(this.documentClassifiers)) {
      let typeConfidence = 0;

      // Check keywords
      const keywordMatches = classifier.keywords.filter(keyword =>
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      typeConfidence += (keywordMatches / classifier.keywords.length) * 0.6;

      // Check patterns
      const patternMatches = classifier.patterns.filter(pattern =>
        pattern.test(text)
      ).length;
      typeConfidence += (patternMatches / classifier.patterns.length) * 0.4;

      if (typeConfidence > maxConfidence) {
        maxConfidence = typeConfidence;
        analysis.type = type;
        analysis.confidence = typeConfidence * classifier.confidence;
      }
    }

    // Analyze structure
    analysis.structure = this.analyzeStructure(text);
    analysis.complexity = this.analyzeComplexity(text);
    analysis.estimatedContacts = this.estimateContactCount(text);
    analysis.sections = this.identifySections(text);
    analysis.characteristics = this.analyzeCharacteristics(text);

    logger.info('📋 Document analysis completed', {
      extractionId,
      type: analysis.type,
      confidence: analysis.confidence,
      structure: analysis.structure,
      estimatedContacts: analysis.estimatedContacts
    });

    return analysis;
  }

  /**
   * Analyze document structure
   */
  analyzeStructure(text) {
    const lines = text.split('\n');
    const tabCount = (text.match(/\t/g) || []).length;
    const colonCount = (text.match(/:/g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;

    if (tabCount > lines.length * 0.3) return 'tabular';
    if (colonCount > lines.length * 0.2) return 'structured';
    if (commaCount > lines.length * 0.5) return 'csv-like';
    
    return 'unstructured';
  }

  /**
   * Analyze document complexity
   */
  analyzeComplexity(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    const uniqueWords = new Set(text.toLowerCase().match(/\b\w+\b/g) || []).size;

    if (avgLineLength > 100 || uniqueWords > 500) return 'high';
    if (avgLineLength > 50 || uniqueWords > 200) return 'medium';
    
    return 'low';
  }

  /**
   * Estimate contact count
   */
  estimateContactCount(text) {
    const emailCount = (text.match(/@/g) || []).length;
    const phoneCount = (text.match(/\(\d{3}\)/g) || []).length;
    const namePatterns = (text.match(/[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []).length;

    return Math.max(emailCount, phoneCount, Math.floor(namePatterns * 0.7));
  }

  /**
   * Identify document sections
   */
  identifySections(text) {
    const sections = [];
    const sectionPatterns = [
      { name: 'CREW', pattern: /crew/i },
      { name: 'TALENT', pattern: /talent|model|actor/i },
      { name: 'PRODUCTION', pattern: /production|client/i },
      { name: 'CONTACTS', pattern: /contact|directory/i }
    ];

    sectionPatterns.forEach(({ name, pattern }) => {
      if (pattern.test(text)) {
        sections.push(name);
      }
    });

    return sections;
  }

  /**
   * Analyze document characteristics
   */
  analyzeCharacteristics(text) {
    return {
      hasEmails: /@/.test(text),
      hasPhones: /\(\d{3}\)/.test(text),
      hasRoles: /[A-Z]{2,}:/.test(text),
      hasTabs: /\t/.test(text),
      hasStructuredData: /[A-Z][A-Z\s]+:\s*[A-Za-z]/.test(text),
      lineCount: text.split('\n').length,
      avgLineLength: text.split('\n').reduce((sum, line) => sum + line.length, 0) / text.split('\n').length
    };
  }

  /**
   * Select optimal extraction strategy
   */
  selectStrategy(documentAnalysis, options, extractionId) {
    logger.info('🎯 Selecting extraction strategy', {
      extractionId,
      documentType: documentAnalysis.type,
      confidence: documentAnalysis.confidence
    });

    // Get strategy based on document type
    const classifier = this.documentClassifiers[documentAnalysis.type];
    let selectedStrategy = this.strategies.fallback_extraction;

    if (classifier && documentAnalysis.confidence > 0.5) {
      selectedStrategy = this.strategies[classifier.strategy] || selectedStrategy;
    }

    // Override with user preferences
    if (options.strategy && this.strategies[options.strategy]) {
      selectedStrategy = this.strategies[options.strategy];
      logger.info('📝 Strategy overridden by user preference', {
        extractionId,
        userStrategy: options.strategy
      });
    }

    // Adjust strategy based on document characteristics
    if (documentAnalysis.complexity === 'high' && selectedStrategy.useAI) {
      selectedStrategy = { ...selectedStrategy, aiMode: 'discovery' };
    }

    logger.info('✅ Strategy selected', {
      extractionId,
      strategy: selectedStrategy.name,
      description: selectedStrategy.description
    });

    return selectedStrategy;
  }

  /**
   * Execute extraction with selected strategy
   */
  async executeExtraction(text, strategy, documentAnalysis, extractionId) {
    logger.info('⚡ Executing extraction', {
      extractionId,
      strategy: strategy.name
    });

    // Configure extraction options based on strategy
    const extractionOptions = {
      extractionId,
      useAI: strategy.useAI,
      aiMode: strategy.aiMode,
      confidenceThreshold: strategy.confidenceThreshold,
      patternCategories: strategy.usePatterns,
      documentType: documentAnalysis.type,
      maxContacts: this.performanceThresholds.maxContactsPerDocument
    };

    // Execute enterprise extraction
    const result = await this.enterpriseExtractor.extractContacts(text, extractionOptions);

    return result;
  }

  /**
   * Post-process results for quality assurance
   */
  postProcessResults(extractionResult, documentAnalysis, strategy, extractionId) {
    logger.info('🔍 Post-processing results', {
      extractionId,
      contactCount: extractionResult.contacts.length
    });

    const contacts = extractionResult.contacts;

    // Apply confidence threshold filtering
    const filteredContacts = contacts.filter(contact => 
      contact.confidence >= strategy.confidenceThreshold
    );

    // Sort by confidence
    filteredContacts.sort((a, b) => b.confidence - a.confidence);

    // Limit results if necessary
    const limitedContacts = filteredContacts.slice(0, this.performanceThresholds.maxContactsPerDocument);

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(limitedContacts, extractionResult);

    // Calculate average confidence
    const averageConfidence = limitedContacts.length > 0 
      ? limitedContacts.reduce((sum, c) => sum + c.confidence, 0) / limitedContacts.length
      : 0;

    logger.info('✅ Post-processing completed', {
      extractionId,
      originalCount: contacts.length,
      filteredCount: filteredContacts.length,
      finalCount: limitedContacts.length,
      averageConfidence
    });

    return {
      contacts: limitedContacts,
      averageConfidence,
      qualityMetrics
    };
  }

  /**
   * Calculate quality metrics
   */
  calculateQualityMetrics(contacts, extractionResult) {
    const total = contacts.length;
    if (total === 0) return {};

    const withEmail = contacts.filter(c => c.email).length;
    const withPhone = contacts.filter(c => c.phone).length;
    const withRole = contacts.filter(c => c.role).length;
    const highConfidence = contacts.filter(c => c.confidence > 0.8).length;

    return {
      totalContacts: total,
      completenessScore: {
        email: withEmail / total,
        phone: withPhone / total,
        role: withRole / total,
        overall: (withEmail + withPhone + withRole) / (total * 3)
      },
      confidenceDistribution: {
        high: highConfidence / total,
        medium: contacts.filter(c => c.confidence > 0.5 && c.confidence <= 0.8).length / total,
        low: contacts.filter(c => c.confidence <= 0.5).length / total
      },
      averageConfidence: contacts.reduce((sum, c) => sum + c.confidence, 0) / total,
      processingSteps: extractionResult.metadata?.processingSteps || []
    };
  }

  /**
   * Get service health and capabilities
   */
  getHealthStatus() {
    return {
      service: 'EnhancedAdaptiveExtractionService',
      status: 'operational',
      capabilities: {
        documentTypes: Object.keys(this.documentClassifiers),
        strategies: Object.keys(this.strategies),
        aiAvailable: this.enterpriseExtractor.isAIAvailable,
        maxProcessingTime: this.performanceThresholds.maxProcessingTime,
        maxTextLength: this.performanceThresholds.maxTextLength
      },
      version: '2.0.0'
    };
  }
}

module.exports = EnhancedAdaptiveExtractionService;
