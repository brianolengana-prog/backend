/**
 * Pattern Extraction Strategy
 * 
 * Implements extraction using pattern matching (regex-based)
 * Wraps existing RobustCallSheetExtractor service
 * 
 * Best Practice: Adapter Pattern - adapts existing service to new interface
 * Best Practice: Composition over inheritance - uses extractor, doesn't extend it
 * Best Practice: Dependency Injection - extractor passed via constructor
 */
const ExtractionStrategy = require('../base/ExtractionStrategy');
const ExtractionResult = require('../../value-objects/ExtractionResult');
const ExtractionMetadata = require('../../value-objects/ExtractionMetadata');

class PatternExtractionStrategy extends ExtractionStrategy {
  /**
   * Constructor with dependency injection
   * @param {object} robustExtractor - RobustCallSheetExtractor instance
   */
  constructor(robustExtractor = null) {
    super();
    
    // Lazy load extractor if not provided (backward compatibility)
    if (!robustExtractor) {
      // Will be loaded on first use
      this._extractor = null;
    } else {
      this._extractor = robustExtractor;
    }
  }

  /**
   * Get or initialize the robust extractor
   * @private
   * @returns {object} RobustCallSheetExtractor instance
   */
  _getExtractor() {
    if (!this._extractor) {
      // Lazy load to avoid circular dependencies
      const RobustCallSheetExtractor = require('../../../../services/robustCallSheetExtractor.service');
      this._extractor = new RobustCallSheetExtractor();
    }
    return this._extractor;
  }

  /**
   * Extract contacts from document text
   * @param {string} text - Document text content
   * @param {object} options - Extraction options
   * @returns {Promise<ExtractionResult>} Extraction result
   */
  async extract(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return ExtractionResult.failure(
          'Empty or invalid text provided',
          { strategy: 'pattern' },
          0
        );
      }

      // Get extractor and extract contacts
      const extractor = this._getExtractor();
      const result = await extractor.extractContacts(text, {
        ...options,
        extractionId: options.extractionId || `pattern_${Date.now()}`
      });

      const processingTime = Date.now() - startTime;

      // Convert to ExtractionResult value object
      if (result.success) {
        // Calculate confidence from pattern matches
        const confidence = this._calculateConfidence(result);
        
        // Create metadata
        const metadata = ExtractionMetadata.fromAnalysis(
          {
            type: 'call_sheet',
            textLength: text.length,
            quality: confidence,
            confidence: confidence
          },
          'pattern-based',
          processingTime
        );

        // Add pattern-specific metadata
        const enhancedMetadata = {
          ...metadata.toJSON(),
          extractionId: result.metadata?.extractionId,
          patternsUsed: result.metadata?.patternsUsed || {},
          strategy: 'pattern-based'
        };

        return ExtractionResult.success(
          result.contacts || [],
          enhancedMetadata,
          'pattern',
          processingTime
        );
      } else {
        // Handle failure
        return ExtractionResult.failure(
          result.metadata?.error || 'Pattern extraction failed',
          {
            strategy: 'pattern',
            extractionId: result.metadata?.extractionId
          },
          processingTime
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return ExtractionResult.failure(
        error.message || 'Pattern extraction error',
        {
          strategy: 'pattern',
          error: error.message,
          stack: error.stack
        },
        processingTime
      );
    }
  }

  /**
   * Calculate confidence based on extraction results
   * @private
   * @param {object} result - Extraction result from robust extractor
   * @returns {number} Confidence score (0-1)
   */
  _calculateConfidence(result) {
    if (!result.contacts || result.contacts.length === 0) {
      return 0;
    }

    // Base confidence from pattern types used
    const patternsUsed = result.metadata?.patternsUsed || {};
    const structuredCount = patternsUsed.structured || 0;
    const semiStructuredCount = patternsUsed.semiStructured || 0;
    const unstructuredCount = patternsUsed.unstructured || 0;
    const totalPatternMatches = structuredCount + semiStructuredCount + unstructuredCount;

    if (totalPatternMatches === 0) {
      return 0.5; // Default confidence if no pattern info
    }

    // Higher confidence for structured patterns
    const structuredWeight = structuredCount * 0.95;
    const semiStructuredWeight = semiStructuredCount * 0.85;
    const unstructuredWeight = unstructuredCount * 0.70;
    
    const weightedScore = (structuredWeight + semiStructuredWeight + unstructuredWeight) / totalPatternMatches;
    
    // Normalize to 0-1 range
    return Math.min(1, Math.max(0, weightedScore));
  }

  /**
   * Get strategy name
   * @returns {string} Strategy name
   */
  getName() {
    return 'PatternExtractionStrategy';
  }

  /**
   * Get strategy confidence level
   * Pattern extraction is good for structured call sheets
   * 
   * @param {object} documentAnalysis - Document analysis
   * @returns {number} Confidence score (0-1)
   */
  getConfidence(documentAnalysis = {}) {
    // High confidence for call sheets
    if (documentAnalysis.type === 'call_sheet') {
      return 0.95;
    }
    
    // Good confidence for structured documents
    if (documentAnalysis.type === 'structured' || documentAnalysis.type === 'table') {
      return 0.85;
    }
    
    // Medium confidence for semi-structured
    if (documentAnalysis.type === 'semi-structured') {
      return 0.75;
    }
    
    // Lower confidence for unstructured
    return 0.60;
  }

  /**
   * Check if strategy is available
   * Pattern extraction is always available (no external dependencies)
   * 
   * @returns {Promise<boolean>} Always true
   */
  async isAvailable() {
    return true; // Pattern extraction doesn't require external services
  }

  /**
   * Get strategy capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      supportsPDF: true,
      supportsImages: false, // Requires OCR first
      supportsWord: true,
      supportsExcel: true,
      requiresAPI: false,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      cost: 'free',
      speed: 'fast'
    };
  }

  /**
   * Get estimated processing time
   * Pattern extraction is fast
   * 
   * @param {object} document - Document value object
   * @returns {number} Estimated processing time in milliseconds
   */
  getEstimatedTime(document) {
    const textLength = document.getContentLength();
    
    // Base time: 1 second
    // Additional time: ~1ms per 1000 characters
    const baseTime = 1000;
    const perCharTime = textLength / 1000;
    
    return Math.min(10000, baseTime + perCharTime); // Max 10 seconds
  }

  /**
   * Get strategy description
   * @returns {string} Strategy description
   */
  getDescription() {
    return 'Fast pattern-based extraction using regex patterns. Best for structured call sheets. No external API required.';
  }
}

module.exports = PatternExtractionStrategy;

