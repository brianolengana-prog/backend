/**
 * ExtractionStrategy Base Class
 * 
 * Abstract base class for extraction strategies
 * Implements Strategy Pattern for pluggable extraction algorithms
 * 
 * Best Practice: Use Strategy Pattern for algorithms that can vary
 * Follows: Open/Closed Principle (open for extension, closed for modification)
 */
class ExtractionStrategy {
  constructor() {
    if (this.constructor === ExtractionStrategy) {
      throw new Error('ExtractionStrategy is abstract and cannot be instantiated');
    }
  }

  /**
   * Extract contacts from document text
   * Must be implemented by subclasses
   * 
   * @param {string} text - Document text content
   * @param {object} options - Extraction options
   * @returns {Promise<ExtractionResult>} Extraction result
   * @throws {Error} If not implemented
   */
  async extract(text, options = {}) {
    throw new Error('extract() must be implemented by subclass');
  }

  /**
   * Get strategy name
   * @returns {string} Strategy name
   */
  getName() {
    return this.constructor.name;
  }

  /**
   * Get strategy confidence level (0-1)
   * Higher confidence = more reliable for this document type
   * 
   * @param {object} documentAnalysis - Document analysis
   * @returns {number} Confidence score (0-1)
   */
  getConfidence(documentAnalysis = {}) {
    return 0.5; // Default confidence
  }

  /**
   * Check if strategy is available
   * Some strategies may require external services (API keys, etc.)
   * 
   * @returns {Promise<boolean>} True if strategy is available
   */
  async isAvailable() {
    return true; // Default: always available
  }

  /**
   * Get strategy capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      supportsPDF: false,
      supportsImages: false,
      supportsWord: false,
      supportsExcel: false,
      requiresAPI: false,
      maxFileSize: null
    };
  }

  /**
   * Validate if strategy can handle document
   * @param {object} document - Document value object
   * @returns {boolean} True if strategy can handle document
   */
  canHandle(document) {
    const capabilities = this.getCapabilities();
    
    if (document.isPDF() && !capabilities.supportsPDF) return false;
    if (document.isImage() && !capabilities.supportsImages) return false;
    if (document.isWord() && !capabilities.supportsWord) return false;
    if (document.isExcel() && !capabilities.supportsExcel) return false;
    
    if (capabilities.maxFileSize && document.size > capabilities.maxFileSize) {
      return false;
    }
    
    return true;
  }

  /**
   * Get estimated processing time (in milliseconds)
   * @param {object} document - Document value object
   * @returns {number} Estimated processing time
   */
  getEstimatedTime(document) {
    // Default: 5 seconds
    return 5000;
  }

  /**
   * Get strategy description
   * @returns {string} Strategy description
   */
  getDescription() {
    return 'Base extraction strategy';
  }
}

module.exports = ExtractionStrategy;

