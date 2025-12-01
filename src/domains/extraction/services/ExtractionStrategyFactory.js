/**
 * Extraction Strategy Factory
 * 
 * Factory for creating and selecting appropriate extraction strategies
 * Uses Factory Pattern to select best strategy based on document analysis
 * 
 * Best Practice: Factory Pattern for object creation
 * Best Practice: Strategy selection based on document characteristics
 * Best Practice: Dependency injection for strategies
 */
const PatternExtractionStrategy = require('../strategies/pattern/PatternExtractionStrategy');
const AIExtractionStrategy = require('../strategies/ai/AIExtractionStrategy');

class ExtractionStrategyFactory {
  /**
   * Constructor with dependency injection
   * @param {object} options - Factory options
   * @param {object} options.patternStrategy - Pattern strategy instance (optional)
   * @param {object} options.aiStrategy - AI strategy instance (optional)
   */
  constructor(options = {}) {
    this.patternStrategy = options.patternStrategy || null;
    this.aiStrategy = options.aiStrategy || null;
  }

  /**
   * Get or create pattern strategy
   * @private
   * @returns {PatternExtractionStrategy}
   */
  _getPatternStrategy() {
    if (!this.patternStrategy) {
      this.patternStrategy = new PatternExtractionStrategy();
    }
    return this.patternStrategy;
  }

  /**
   * Get or create AI strategy
   * @private
   * @returns {AIExtractionStrategy}
   */
  _getAIStrategy() {
    if (!this.aiStrategy) {
      this.aiStrategy = new AIExtractionStrategy();
    }
    return this.aiStrategy;
  }

  /**
   * Get all available strategies
   * @param {object} documentAnalysis - Document analysis
   * @returns {Promise<Array>} Array of available strategies with confidence scores
   */
  async getAvailableStrategies(documentAnalysis = {}) {
    const strategies = [];

    // Pattern strategy (always available)
    const patternStrategy = this._getPatternStrategy();
    const patternConfidence = patternStrategy.getConfidence(documentAnalysis);
    strategies.push({
      strategy: patternStrategy,
      name: patternStrategy.getName(),
      confidence: patternConfidence,
      available: true,
      cost: 'free',
      speed: 'fast'
    });

    // AI strategy (check availability)
    const aiStrategy = this._getAIStrategy();
    const aiAvailable = await aiStrategy.isAvailable();
    if (aiAvailable) {
      const aiConfidence = aiStrategy.getConfidence(documentAnalysis);
      strategies.push({
        strategy: aiStrategy,
        name: aiStrategy.getName(),
        confidence: aiConfidence,
        available: true,
        cost: 'variable',
        speed: 'medium'
      });
    }

    // Sort by confidence (highest first)
    strategies.sort((a, b) => b.confidence - a.confidence);

    return strategies;
  }

  /**
   * Select best strategy for document automatically
   * 
   * Intelligent selection logic (hides complexity from users):
   * 1. Check which strategies are available
   * 2. Calculate confidence for each based on document characteristics
   * 3. Prefer fast, free strategies when confidence is similar
   * 4. Use AI for complex/unstructured documents when needed
   * 5. Return best match automatically
   * 
   * @param {object} documentAnalysis - Document analysis
   * @param {object} options - Selection options
   * @param {string} options.preferredStrategy - Force specific strategy (for testing/admin only)
   * @param {boolean} options.preferFast - Prefer fast strategies (default: true)
   * @param {boolean} options.preferFree - Prefer free strategies (default: true)
   * @returns {Promise<ExtractionStrategy>} Selected strategy
   */
  async selectStrategy(documentAnalysis = {}, options = {}) {
    // Force specific strategy if requested (admin/testing only - not for users)
    if (options.preferredStrategy && options.preferredStrategy !== 'auto') {
      return this._getStrategyByName(options.preferredStrategy);
    }

    // Get available strategies with confidence scores
    const availableStrategies = await this.getAvailableStrategies(documentAnalysis);

    if (availableStrategies.length === 0) {
      throw new Error('No extraction strategies available');
    }

    // Intelligent auto-selection logic
    // Default: prefer fast and free when confidence is similar
    const preferFast = options.preferFast !== false; // Default: true
    const preferFree = options.preferFree !== false; // Default: true

    // Filter candidates based on preferences
    let candidates = availableStrategies;

    // If document is a call sheet (structured), pattern extraction is usually best
    if (documentAnalysis.type === 'call_sheet' || documentAnalysis.type === 'structured') {
      // Prefer pattern for structured documents
      const patternStrategy = candidates.find(s => s.name.includes('Pattern'));
      if (patternStrategy && patternStrategy.confidence >= 0.8) {
        return patternStrategy.strategy;
      }
    }

    // If document is complex or unstructured, consider AI
    if (documentAnalysis.complexity === 'high' || documentAnalysis.type === 'unknown') {
      const aiStrategy = candidates.find(s => s.name.includes('AI'));
      const patternStrategy = candidates.find(s => s.name.includes('Pattern'));
      
      // Use AI if available and pattern confidence is low
      if (aiStrategy && patternStrategy && patternStrategy.confidence < 0.7) {
        return aiStrategy.strategy;
      }
    }

    // Prefer fast strategies when confidence is similar
    if (preferFast) {
      const fastStrategies = candidates.filter(s => s.speed === 'fast');
      if (fastStrategies.length > 0) {
        // If fastest strategy has good confidence, use it
        const bestFast = fastStrategies[0];
        if (bestFast.confidence >= 0.8) {
          return bestFast.strategy;
        }
      }
    }

    // Prefer free strategies when confidence is similar
    if (preferFree) {
      const freeStrategies = candidates.filter(s => s.cost === 'free');
      if (freeStrategies.length > 0) {
        const bestFree = freeStrategies[0];
        // Use free strategy if confidence is acceptable
        if (bestFree.confidence >= 0.75) {
          return bestFree.strategy;
        }
      }
    }

    // Default: Select highest confidence strategy
    const selected = candidates[0];
    return selected.strategy;
  }

  /**
   * Get strategy by name
   * @private
   * @param {string} name - Strategy name ('pattern', 'ai')
   * @returns {ExtractionStrategy}
   */
  _getStrategyByName(name) {
    switch (name.toLowerCase()) {
      case 'pattern':
      case 'pattern-based':
        return this._getPatternStrategy();
      
      case 'ai':
      case 'ai-powered':
      case 'gpt':
        return this._getAIStrategy();
      
      default:
        throw new Error(`Unknown strategy: ${name}`);
    }
  }

  /**
   * Create strategy for document
   * Convenience method that analyzes document and selects strategy
   * 
   * @param {object} document - Document value object
   * @param {object} options - Selection options
   * @returns {Promise<ExtractionStrategy>} Selected strategy
   */
  async createStrategyForDocument(document, options = {}) {
    // Simple document analysis
    const documentAnalysis = {
      type: this._analyzeDocumentType(document),
      complexity: this._analyzeComplexity(document),
      textLength: document.getContentLength()
    };

    return await this.selectStrategy(documentAnalysis, options);
  }

  /**
   * Analyze document type
   * @private
   * @param {object} document - Document value object
   * @returns {string} Document type
   */
  _analyzeDocumentType(document) {
    if (document.isPDF()) {
      return 'call_sheet'; // Assume call sheet for PDFs
    }
    if (document.isWord()) {
      return 'structured';
    }
    if (document.isExcel()) {
      return 'table';
    }
    return 'unknown';
  }

  /**
   * Analyze document complexity
   * @private
   * @param {object} document - Document value object
   * @returns {string} Complexity level
   */
  _analyzeComplexity(document) {
    const length = document.getContentLength();
    
    if (length < 1000) {
      return 'low';
    }
    if (length < 10000) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * Get strategy recommendations
   * Returns recommendations for which strategy to use
   * 
   * @param {object} documentAnalysis - Document analysis
   * @returns {Promise<object>} Recommendations object
   */
  async getRecommendations(documentAnalysis = {}) {
    const strategies = await this.getAvailableStrategies(documentAnalysis);
    
    const recommendations = {
      best: strategies[0] || null,
      alternatives: strategies.slice(1),
      all: strategies,
      reasoning: this._generateReasoning(strategies, documentAnalysis)
    };

    return recommendations;
  }

  /**
   * Generate reasoning for strategy selection
   * @private
   * @param {Array} strategies - Available strategies
   * @param {object} documentAnalysis - Document analysis
   * @returns {string} Reasoning text
   */
  _generateReasoning(strategies, documentAnalysis) {
    if (strategies.length === 0) {
      return 'No strategies available';
    }

    const best = strategies[0];
    const reasons = [];

    reasons.push(`${best.name} selected with ${(best.confidence * 100).toFixed(0)}% confidence`);

    if (documentAnalysis.type === 'call_sheet') {
      reasons.push('Document appears to be a call sheet - pattern extraction is optimal');
    }

    if (documentAnalysis.complexity === 'high') {
      reasons.push('Document is complex - AI extraction may provide better results');
    }

    if (best.cost === 'free') {
      reasons.push('Selected strategy is free and fast');
    }

    return reasons.join('. ');
  }

  /**
   * Get health status of all strategies
   * Returns information about available strategies for API consumption
   * 
   * @returns {Promise<object>} Health status with strategy information
   */
  async getHealthStatus() {
    const { logger } = require('../../../shared/infrastructure/logger/logger.service');
    
    try {
      const strategies = {};
      let availableCount = 0;

      // Get pattern strategy status
      try {
        const patternStrategy = this._getPatternStrategy();
        const patternHealth = patternStrategy.getHealthStatus ? 
          patternStrategy.getHealthStatus() : 
          { name: patternStrategy.getName(), available: true, confidence: 0.95 };
        
        strategies.pattern = {
          id: 'pattern',
          name: patternHealth.name || 'PatternExtractionStrategy',
          description: 'Fast pattern-based extraction using regex patterns. Best for structured call sheets. No external API required.',
          confidence: patternHealth.confidence || 0.95,
          available: patternHealth.available !== false,
          estimatedCost: 0.00,
          estimatedTime: 500,
          cost: 'free',
          speed: 'fast'
        };
        
        if (strategies.pattern.available) availableCount++;
      } catch (error) {
        logger.warn('Pattern strategy health check failed', { error: error.message });
        strategies.pattern = {
          id: 'pattern',
          name: 'PatternExtractionStrategy',
          available: false,
          error: error.message
        };
      }

      // Get AI strategy status
      try {
        const aiStrategy = this._getAIStrategy();
        const aiAvailable = await aiStrategy.isAvailable();
        const aiHealth = aiStrategy.getHealthStatus ? 
          aiStrategy.getHealthStatus() : 
          { name: aiStrategy.getName(), available: aiAvailable, confidence: 0.96 };
        
        strategies.ai = {
          id: 'ai',
          name: aiHealth.name || 'AIExtractionStrategy',
          description: 'Advanced AI-powered extraction using GPT-4o Mini. Best for complex or unstructured documents.',
          confidence: aiHealth.confidence || 0.96,
          available: aiHealth.available !== false && aiAvailable,
          estimatedCost: 0.10, // Average cost per extraction
          estimatedTime: 5000,
          cost: 'variable',
          speed: 'medium'
        };
        
        if (strategies.ai.available) availableCount++;
      } catch (error) {
        logger.warn('AI strategy health check failed', { error: error.message });
        strategies.ai = {
          id: 'ai',
          name: 'AIExtractionStrategy',
          available: false,
          error: error.message
        };
      }

      return {
        initialized: true,
        strategies,
        availableCount,
        totalCount: Object.keys(strategies).length
      };
    } catch (error) {
      logger.error('Strategy factory health check failed', { error: error.message, stack: error.stack });
      return {
        initialized: false,
        strategies: {},
        availableCount: 0,
        totalCount: 0,
        error: error.message
      };
    }
  }
}

module.exports = ExtractionStrategyFactory;

