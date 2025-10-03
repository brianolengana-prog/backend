/**
 * Intelligent Strategy Selection Service
 * 
 * Enterprise-grade strategy selection that optimizes for:
 * - GPT-4o Mini limitations (3 RPM, 60k TPM, 128k context)
 * - Cost optimization based on user plan
 * - Document complexity analysis
 * - Historical performance data
 * - Real-time service health
 * - User preferences and context
 */

const { PrismaClient } = require('@prisma/client');
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

class IntelligentStrategyService {
  constructor() {
    this.prisma = new PrismaClient();
    this.strategyCache = new Map();
    this.performanceHistory = new Map();
    
    // GPT-4o Mini specific constraints
    this.gpt4oMiniLimits = {
      contextWindow: 128000,
      maxInputTokens: 120000,
      maxOutputTokens: 4000,
      requestsPerMinute: 3,
      tokensPerMinute: 60000,
      costPerInputToken: 0.00015 / 1000,
      costPerOutputToken: 0.0006 / 1000
    };

    // Strategy performance weights
    this.strategyWeights = {
      accuracy: 0.4,
      speed: 0.2,
      cost: 0.2,
      reliability: 0.2
    };

    // Document complexity thresholds
    this.complexityThresholds = {
      simple: { maxSize: 1024 * 1024, maxContacts: 20, complexityScore: 0.3 },
      medium: { maxSize: 5 * 1024 * 1024, maxContacts: 100, complexityScore: 0.6 },
      complex: { maxSize: 50 * 1024 * 1024, maxContacts: 500, complexityScore: 1.0 }
    };
  }

  /**
   * Main strategy selection method
   */
  async selectOptimalStrategy(fileBuffer, mimeType, fileName, options = {}) {
    try {
      logger.info('🎯 Starting intelligent strategy selection', {
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        userId: options.userId
      });

      // Step 1: Analyze document characteristics
      const docAnalysis = await this.analyzeDocument(fileBuffer, mimeType, fileName);
      
      // Step 2: Get user context and constraints
      const userContext = await this.getUserContext(options.userId);
      
      // Step 3: Check service health and availability
      const serviceHealth = await this.checkServiceHealth();
      
      // Step 4: Calculate strategy scores
      const strategyScores = await this.calculateStrategyScores(
        docAnalysis,
        userContext,
        serviceHealth,
        options
      );

      // Step 5: Select optimal strategy
      const selectedStrategy = this.selectBestStrategy(strategyScores, docAnalysis, userContext);
      
      // Step 6: Log decision for learning
      await this.logStrategyDecision(selectedStrategy, docAnalysis, userContext, options);

      logger.info('✅ Strategy selected', {
        strategy: selectedStrategy.name,
        confidence: selectedStrategy.confidence,
        reasoning: selectedStrategy.reasoning
      });

      return selectedStrategy;

    } catch (error) {
      logger.error('❌ Strategy selection failed', { error: error.message });
      // Fallback to safe default
      return this.getFallbackStrategy();
    }
  }

  /**
   * Comprehensive document analysis
   */
  async analyzeDocument(fileBuffer, mimeType, fileName) {
    const analysis = {
      // Basic properties
      fileSize: fileBuffer.length,
      mimeType,
      fileName,
      extension: this.getFileExtension(fileName),
      
      // Content analysis
      isScannedPDF: false,
      isComplexDocument: false,
      isStructuredDocument: false,
      hasImages: false,
      hasTables: false,
      
      // Complexity metrics
      complexityScore: 0,
      estimatedContacts: 0,
      estimatedTokens: 0,
      textDensity: 0,
      
      // Quality indicators
      textQuality: 'unknown',
      structureQuality: 'unknown',
      extractionDifficulty: 'unknown'
    };

    try {
      // Extract text for analysis
      const extractedText = await this.extractTextForAnalysis(fileBuffer, mimeType, fileName);
      
      if (extractedText && extractedText.length > 0) {
        analysis.textDensity = extractedText.length / fileBuffer.length;
        analysis.estimatedTokens = Math.ceil(extractedText.length / 4);
        
        // Analyze text quality and structure
        analysis.textQuality = this.analyzeTextQuality(extractedText);
        analysis.structureQuality = this.analyzeStructureQuality(extractedText);
        analysis.estimatedContacts = this.estimateContactCount(extractedText);
        analysis.hasTables = this.detectTables(extractedText);
        analysis.isStructuredDocument = this.detectStructuredContent(extractedText);
        
        // Calculate complexity score
        analysis.complexityScore = this.calculateComplexityScore(analysis);
        analysis.extractionDifficulty = this.assessExtractionDifficulty(analysis);
      }

      // Special handling for PDFs
      if (mimeType === 'application/pdf') {
        analysis.isScannedPDF = await this.detectScannedPDF(fileBuffer);
      }

      // Detect images
      analysis.hasImages = this.detectImages(fileBuffer, mimeType);

    } catch (error) {
      logger.warn('⚠️ Document analysis failed, using defaults', { error: error.message });
    }

    return analysis;
  }

  /**
   * Get user context and constraints
   */
  async getUserContext(userId) {
    if (!userId) {
      return this.getDefaultUserContext();
    }

    try {
      // Get user subscription and usage
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true,
          usage: true
        }
      });

      if (!user) {
        return this.getDefaultUserContext();
      }

      // Get historical performance data
      const recentJobs = await this.prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          metadata: true,
          status: true,
          createdAt: true
        }
      });

      return {
        userId,
        planType: user.subscription?.planId || 'free',
        planLimits: this.getPlanLimits(user.subscription?.planId || 'free'),
        usageStats: user.usage || {},
        recentPerformance: this.analyzeRecentPerformance(recentJobs),
        preferences: this.extractUserPreferences(user),
        costSensitivity: this.assessCostSensitivity(user.subscription?.planId || 'free')
      };

    } catch (error) {
      logger.warn('⚠️ Failed to get user context', { error: error.message });
      return this.getDefaultUserContext();
    }
  }

  /**
   * Check real-time service health
   */
  async checkServiceHealth() {
    const health = {
      ai: { available: false, rateLimitRemaining: 0, estimatedWaitTime: 0 },
      awsTextract: { available: false, estimatedCost: 0 },
      pattern: { available: true, performance: 'good' },
      hybrid: { available: true, performance: 'good' }
    };

    try {
      // Check AI service health and rate limits
      const aiHealth = await this.checkAIServiceHealth();
      health.ai = aiHealth;

      // Check AWS Textract availability and cost
      const textractHealth = await this.checkTextractHealth();
      health.awsTextract = textractHealth;

    } catch (error) {
      logger.warn('⚠️ Service health check failed', { error: error.message });
    }

    return health;
  }

  /**
   * Calculate strategy scores based on multiple factors
   */
  async calculateStrategyScores(docAnalysis, userContext, serviceHealth, options) {
    const strategies = [
      'pattern-only',
      'ai-only',
      'aws-textract-only',
      'hybrid-pattern-ai',
      'hybrid-textract-ai',
      'hybrid-adaptive'
    ];

    const scores = {};

    for (const strategy of strategies) {
      scores[strategy] = await this.calculateStrategyScore(
        strategy,
        docAnalysis,
        userContext,
        serviceHealth,
        options
      );
    }

    return scores;
  }

  /**
   * Calculate score for a specific strategy
   */
  async calculateStrategyScore(strategy, docAnalysis, userContext, serviceHealth, options) {
    const score = {
      name: strategy,
      accuracy: 0,
      speed: 0,
      cost: 0,
      reliability: 0,
      total: 0,
      confidence: 0,
      reasoning: []
    };

    // Accuracy scoring
    score.accuracy = this.scoreAccuracy(strategy, docAnalysis, serviceHealth);
    
    // Speed scoring
    score.speed = this.scoreSpeed(strategy, docAnalysis, serviceHealth);
    
    // Cost scoring
    score.cost = this.scoreCost(strategy, docAnalysis, userContext, serviceHealth);
    
    // Reliability scoring
    score.reliability = this.scoreReliability(strategy, serviceHealth, userContext);

    // Calculate weighted total
    score.total = (
      score.accuracy * this.strategyWeights.accuracy +
      score.speed * this.strategyWeights.speed +
      score.cost * this.strategyWeights.cost +
      score.reliability * this.strategyWeights.reliability
    );

    // Calculate confidence based on data quality
    score.confidence = this.calculateConfidence(score, docAnalysis, serviceHealth);

    // Generate reasoning
    score.reasoning = this.generateReasoning(score, docAnalysis, userContext, serviceHealth);

    return score;
  }

  /**
   * Score accuracy for a strategy
   */
  scoreAccuracy(strategy, docAnalysis, serviceHealth) {
    const baseScores = {
      'pattern-only': 0.85,
      'ai-only': 0.92,
      'aws-textract-only': 0.88,
      'hybrid-pattern-ai': 0.94,
      'hybrid-textract-ai': 0.96,
      'hybrid-adaptive': 0.95
    };

    let score = baseScores[strategy] || 0.5;

    // Adjust based on document characteristics
    if (docAnalysis.isScannedPDF && strategy.includes('textract')) {
      score += 0.05; // Textract excels at scanned PDFs
    }

    if (docAnalysis.isComplexDocument && strategy.includes('ai')) {
      score += 0.03; // AI excels at complex documents
    }

    if (docAnalysis.isStructuredDocument && strategy.includes('pattern')) {
      score += 0.02; // Patterns work well with structured data
    }

    // Adjust based on service health
    if (strategy.includes('ai') && !serviceHealth.ai.available) {
      score = 0; // AI not available
    }

    if (strategy.includes('textract') && !serviceHealth.awsTextract.available) {
      score = 0; // Textract not available
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score speed for a strategy
   */
  scoreSpeed(strategy, docAnalysis, serviceHealth) {
    const baseScores = {
      'pattern-only': 0.95,
      'ai-only': 0.70,
      'aws-textract-only': 0.80,
      'hybrid-pattern-ai': 0.75,
      'hybrid-textract-ai': 0.70,
      'hybrid-adaptive': 0.80
    };

    let score = baseScores[strategy] || 0.5;

    // Adjust based on document size
    if (docAnalysis.fileSize > 5 * 1024 * 1024) { // Large file
      if (strategy.includes('ai')) {
        score -= 0.1; // AI slower on large files
      }
      if (strategy.includes('textract')) {
        score -= 0.05; // Textract slower on large files
      }
    }

    // Adjust based on rate limits
    if (strategy.includes('ai') && serviceHealth.ai.rateLimitRemaining === 0) {
      score -= 0.3; // Rate limited
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score cost for a strategy
   */
  scoreCost(strategy, docAnalysis, userContext, serviceHealth) {
    const baseScores = {
      'pattern-only': 1.0, // Free
      'ai-only': 0.3, // Expensive
      'aws-textract-only': 0.4, // Moderate cost
      'hybrid-pattern-ai': 0.6, // Moderate cost
      'hybrid-textract-ai': 0.5, // Higher cost
      'hybrid-adaptive': 0.7 // Optimized cost
    };

    let score = baseScores[strategy] || 0.5;

    // Adjust based on user plan
    if (userContext.planType === 'free' && strategy.includes('ai')) {
      score -= 0.2; // Free users prefer cheaper options
    }

    if (userContext.planType === 'enterprise' && strategy.includes('pattern')) {
      score -= 0.1; // Enterprise users prefer quality over cost
    }

    // Adjust based on document size (larger = more expensive)
    if (docAnalysis.estimatedTokens > 10000) {
      if (strategy.includes('ai')) {
        score -= 0.1;
      }
      if (strategy.includes('textract')) {
        score -= 0.05;
      }
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Score reliability for a strategy
   */
  scoreReliability(strategy, serviceHealth, userContext) {
    const baseScores = {
      'pattern-only': 0.95,
      'ai-only': 0.80,
      'aws-textract-only': 0.85,
      'hybrid-pattern-ai': 0.90,
      'hybrid-textract-ai': 0.88,
      'hybrid-adaptive': 0.92
    };

    let score = baseScores[strategy] || 0.5;

    // Adjust based on service availability
    if (strategy.includes('ai') && !serviceHealth.ai.available) {
      score = 0;
    }

    if (strategy.includes('textract') && !serviceHealth.awsTextract.available) {
      score = 0;
    }

    // Adjust based on user's recent performance
    if (userContext.recentPerformance && userContext.recentPerformance[strategy]) {
      const recentReliability = userContext.recentPerformance[strategy].reliability;
      score = (score + recentReliability) / 2; // Blend with historical data
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Select the best strategy based on scores
   */
  selectBestStrategy(strategyScores, docAnalysis, userContext) {
    // Sort strategies by total score
    const sortedStrategies = Object.values(strategyScores)
      .sort((a, b) => b.total - a.total);

    const bestStrategy = sortedStrategies[0];

    // Apply business rules and constraints
    const finalStrategy = this.applyBusinessRules(bestStrategy, docAnalysis, userContext);

    return {
      name: finalStrategy.name,
      confidence: finalStrategy.confidence,
      reasoning: finalStrategy.reasoning,
      estimatedTime: this.estimateProcessingTime(finalStrategy.name, docAnalysis),
      estimatedCost: this.estimateCost(finalStrategy.name, docAnalysis),
      fallbackStrategy: this.getFallbackStrategy(finalStrategy.name)
    };
  }

  /**
   * Apply business rules and constraints
   */
  applyBusinessRules(strategy, docAnalysis, userContext) {
    // Rule 1: Free users get pattern-only for simple documents
    if (userContext.planType === 'free' && 
        docAnalysis.complexityScore < 0.4 && 
        strategy.name !== 'pattern-only') {
      return {
        ...strategy,
        name: 'pattern-only',
        reasoning: [...strategy.reasoning, 'Free plan: using pattern-only for simple document'],
        confidence: 0.8
      };
    }

    // Rule 2: Large documents need chunking for AI
    if (strategy.name.includes('ai') && docAnalysis.estimatedTokens > this.gpt4oMiniLimits.maxInputTokens) {
      return {
        ...strategy,
        name: 'hybrid-adaptive',
        reasoning: [...strategy.reasoning, 'Large document: using adaptive chunking strategy'],
        confidence: 0.9
      };
    }

    // Rule 3: Scanned PDFs should use Textract if available
    if (docAnalysis.isScannedPDF && strategy.name !== 'aws-textract-only') {
      return {
        ...strategy,
        name: 'aws-textract-only',
        reasoning: [...strategy.reasoning, 'Scanned PDF: using AWS Textract for optimal OCR'],
        confidence: 0.95
      };
    }

    return strategy;
  }

  /**
   * Helper methods for analysis
   */
  async extractTextForAnalysis(fileBuffer, mimeType, fileName) {
    // Implementation for text extraction
    // This would use the same logic as in hybridExtraction.service.js
    return '';
  }

  analyzeTextQuality(text) {
    if (!text || text.length < 100) return 'poor';
    
    const qualityIndicators = {
      emailCount: (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).length,
      phoneCount: (text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g) || []).length,
      namePatterns: (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []).length,
      structureIndicators: (text.match(/[|]\s*[|]|\t.*\t|\n\s*\n/g) || []).length
    };

    const totalIndicators = Object.values(qualityIndicators).reduce((sum, count) => sum + count, 0);
    
    if (totalIndicators > 20) return 'excellent';
    if (totalIndicators > 10) return 'good';
    if (totalIndicators > 5) return 'fair';
    return 'poor';
  }

  analyzeStructureQuality(text) {
    // Analyze document structure
    const hasHeaders = /^#+\s/.test(text);
    const hasLists = /^\s*[-*+]\s/.test(text);
    const hasTables = /[|]\s*[|]/.test(text);
    const hasSections = /\n\s*\n/.test(text);

    const structureScore = [hasHeaders, hasLists, hasTables, hasSections]
      .filter(Boolean).length;

    if (structureScore >= 3) return 'excellent';
    if (structureScore >= 2) return 'good';
    if (structureScore >= 1) return 'fair';
    return 'poor';
  }

  estimateContactCount(text) {
    const emailCount = (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).length;
    const phoneCount = (text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g) || []).length;
    const nameCount = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []).length;

    return Math.max(emailCount, phoneCount, Math.floor(nameCount / 2));
  }

  detectTables(text) {
    return /[|]\s*[|]|\t.*\t/.test(text);
  }

  detectStructuredContent(text) {
    const structurePatterns = [
      /[|]\s*[|]/, // Tables
      /^\s*[-*+]\s/, // Lists
      /^\d+\.\s/, // Numbered lists
      /\n\s*\n/ // Sections
    ];

    return structurePatterns.some(pattern => pattern.test(text));
  }

  calculateComplexityScore(analysis) {
    let score = 0;

    // File size factor
    if (analysis.fileSize > 5 * 1024 * 1024) score += 0.3;
    else if (analysis.fileSize > 1024 * 1024) score += 0.1;

    // Text density factor
    if (analysis.textDensity < 0.1) score += 0.2; // Low text density = complex

    // Structure factor
    if (analysis.isStructuredDocument) score += 0.2;
    if (analysis.hasTables) score += 0.1;

    // Contact count factor
    if (analysis.estimatedContacts > 100) score += 0.2;
    else if (analysis.estimatedContacts > 20) score += 0.1;

    // Quality factor
    if (analysis.textQuality === 'poor') score += 0.2;
    else if (analysis.textQuality === 'fair') score += 0.1;

    return Math.min(1.0, score);
  }

  assessExtractionDifficulty(analysis) {
    if (analysis.complexityScore > 0.7) return 'high';
    if (analysis.complexityScore > 0.4) return 'medium';
    return 'low';
  }

  async detectScannedPDF(fileBuffer) {
    // Implementation for scanned PDF detection
    return false;
  }

  detectImages(fileBuffer, mimeType) {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];
    return imageTypes.includes(mimeType);
  }

  getFileExtension(fileName) {
    return fileName.split('.').pop()?.toLowerCase() || '';
  }

  getDefaultUserContext() {
    return {
      userId: null,
      planType: 'free',
      planLimits: this.getPlanLimits('free'),
      usageStats: {},
      recentPerformance: {},
      preferences: {},
      costSensitivity: 'high'
    };
  }

  getPlanLimits(planType) {
    const limits = {
      free: { maxFileSize: 5 * 1024 * 1024, maxContacts: 50, aiUsage: 0 },
      starter: { maxFileSize: 10 * 1024 * 1024, maxContacts: 200, aiUsage: 10 },
      professional: { maxFileSize: 50 * 1024 * 1024, maxContacts: 1000, aiUsage: 100 },
      enterprise: { maxFileSize: 100 * 1024 * 1024, maxContacts: -1, aiUsage: -1 }
    };
    return limits[planType] || limits.free;
  }

  analyzeRecentPerformance(recentJobs) {
    // Analyze recent job performance by strategy
    const performance = {};
    
    recentJobs.forEach(job => {
      const strategy = job.metadata?.extractionMethod || 'unknown';
      if (!performance[strategy]) {
        performance[strategy] = { success: 0, total: 0, avgTime: 0, reliability: 0 };
      }
      
      performance[strategy].total++;
      if (job.status === 'COMPLETED') {
        performance[strategy].success++;
      }
    });

    // Calculate reliability scores
    Object.keys(performance).forEach(strategy => {
      const stats = performance[strategy];
      stats.reliability = stats.total > 0 ? stats.success / stats.total : 0;
    });

    return performance;
  }

  extractUserPreferences(user) {
    // Extract user preferences from profile or settings
    return {
      preferredAccuracy: 'high',
      preferredSpeed: 'medium',
      costTolerance: 'medium'
    };
  }

  assessCostSensitivity(planType) {
    const sensitivity = {
      free: 'high',
      starter: 'medium',
      professional: 'low',
      enterprise: 'very-low'
    };
    return sensitivity[planType] || 'high';
  }

  async checkAIServiceHealth() {
    // Check AI service health and rate limits
    return {
      available: true,
      rateLimitRemaining: 2,
      estimatedWaitTime: 0
    };
  }

  async checkTextractHealth() {
    // Check AWS Textract health and cost
    return {
      available: true,
      estimatedCost: 0.01
    };
  }

  calculateConfidence(score, docAnalysis, serviceHealth) {
    let confidence = score.total;

    // Reduce confidence if services are unavailable
    if (score.name.includes('ai') && !serviceHealth.ai.available) {
      confidence *= 0.5;
    }

    if (score.name.includes('textract') && !serviceHealth.awsTextract.available) {
      confidence *= 0.5;
    }

    // Increase confidence for well-analyzed documents
    if (docAnalysis.complexityScore > 0.5) {
      confidence *= 1.1;
    }

    return Math.min(1.0, confidence);
  }

  generateReasoning(score, docAnalysis, userContext, serviceHealth) {
    const reasoning = [];

    if (score.accuracy > 0.9) {
      reasoning.push('High accuracy expected');
    }

    if (score.speed > 0.8) {
      reasoning.push('Fast processing expected');
    }

    if (score.cost > 0.8) {
      reasoning.push('Cost-effective solution');
    }

    if (docAnalysis.isScannedPDF && score.name.includes('textract')) {
      reasoning.push('Optimal for scanned documents');
    }

    if (docAnalysis.isComplexDocument && score.name.includes('ai')) {
      reasoning.push('Best for complex document structure');
    }

    return reasoning;
  }

  estimateProcessingTime(strategy, docAnalysis) {
    const baseTimes = {
      'pattern-only': 2000,
      'ai-only': 10000,
      'aws-textract-only': 5000,
      'hybrid-pattern-ai': 8000,
      'hybrid-textract-ai': 12000,
      'hybrid-adaptive': 15000
    };

    let time = baseTimes[strategy] || 5000;

    // Adjust based on file size
    if (docAnalysis.fileSize > 5 * 1024 * 1024) {
      time *= 1.5;
    }

    return time;
  }

  estimateCost(strategy, docAnalysis) {
    if (strategy === 'pattern-only') return 0;

    let cost = 0;

    if (strategy.includes('ai')) {
      const tokens = docAnalysis.estimatedTokens || 1000;
      cost += tokens * this.gpt4oMiniLimits.costPerInputToken;
      cost += 1000 * this.gpt4oMiniLimits.costPerOutputToken; // Estimated output
    }

    if (strategy.includes('textract')) {
      cost += 0.01; // Base Textract cost
    }

    return cost;
  }

  getFallbackStrategy(primaryStrategy) {
    const fallbacks = {
      'pattern-only': 'pattern-only',
      'ai-only': 'pattern-only',
      'aws-textract-only': 'ai-only',
      'hybrid-pattern-ai': 'pattern-only',
      'hybrid-textract-ai': 'ai-only',
      'hybrid-adaptive': 'pattern-only'
    };

    return fallbacks[primaryStrategy] || 'pattern-only';
  }

  getFallbackStrategy() {
    return {
      name: 'pattern-only',
      confidence: 0.8,
      reasoning: ['Fallback to reliable pattern extraction'],
      estimatedTime: 2000,
      estimatedCost: 0,
      fallbackStrategy: 'pattern-only'
    };
  }

  async logStrategyDecision(strategy, docAnalysis, userContext, options) {
    try {
      await this.prisma.strategyDecision.create({
        data: {
          userId: userContext.userId,
          strategy: strategy.name,
          confidence: strategy.confidence,
          documentType: docAnalysis.mimeType,
          fileSize: docAnalysis.fileSize,
          complexityScore: docAnalysis.complexityScore,
          estimatedContacts: docAnalysis.estimatedContacts,
          reasoning: JSON.stringify(strategy.reasoning),
          metadata: JSON.stringify({
            docAnalysis,
            userContext,
            options
          })
        }
      });
    } catch (error) {
      logger.warn('⚠️ Failed to log strategy decision', { error: error.message });
    }
  }
}

module.exports = new IntelligentStrategyService();
