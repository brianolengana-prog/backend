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
   * Select best strategy for document
   * 
   * Selection logic:
   * 1. Check which strategies are available
   * 2. Calculate confidence for each
   * 3. Consider document characteristics
   * 4. Return best match
   * 
   * @param {object} documentAnalysis - Document analysis
   * @param {object} options - Selection options
   * @param {string} options.preferredStrategy - Force specific strategy ('pattern', 'ai')
   * @param {boolean} options.preferFast - Prefer fast strategies
   * @param {boolean} options.preferFree - Prefer free strategies
   * @returns {Promise<ExtractionStrategy>} Selected strategy
   */
  async selectStrategy(documentAnalysis = {}, options = {}) {
    // Force specific strategy if requested
    if (options.preferredStrategy) {
      return this._getStrategyByName(options.preferredStrategy);
    }

    // Get available strategies
    const availableStrategies = await this.getAvailableStrategies(documentAnalysis);

    if (availableStrategies.length === 0) {
      throw new Error('No extraction strategies available');
    }

    // Filter by preferences
    let candidates = availableStrategies;

    // Prefer fast strategies
    if (options.preferFast) {
      candidates = candidates.filter(s => s.speed === 'fast');
      if (candidates.length === 0) {
        candidates = availableStrategies; // Fallback to all
      }
    }

    // Prefer free strategies
    if (options.preferFree) {
      candidates = candidates.filter(s => s.cost === 'free');
      if (candidates.length === 0) {
        candidates = availableStrategies; // Fallback to all
      }
    }

    // Select highest confidence from candidates
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
}

module.exports = ExtractionStrategyFactory;

