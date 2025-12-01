/**
 * Extraction Service Adapter
 * 
 * Adapter to integrate new ExtractionService with existing routes
 * Provides backward-compatible interface
 * 
 * Best Practice: Adapter Pattern for integration
 * Best Practice: Maintains backward compatibility
 */
const ExtractionService = require('./ExtractionService');
const ExtractionStrategyFactory = require('./ExtractionStrategyFactory');
const featureFlags = require('../../../shared/infrastructure/features/feature-flags.service');
const logger = require('../../../shared/infrastructure/logger/logger.service');

class ExtractionServiceAdapter {
  constructor() {
    this.strategyFactory = new ExtractionStrategyFactory();
    this.extractionService = new ExtractionService({
      strategyFactory: this.strategyFactory
    });
  }

  /**
   * Extract contacts (backward compatible interface)
   * Adapts new service to old interface
   * 
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {object} options - Extraction options
   * @returns {Promise<object>} Result in legacy format
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    try {
      // Use new extraction service
      const result = await this.extractionService.extractContacts(
        fileBuffer,
        mimeType,
        fileName,
        options
      );

      // Convert to legacy format for backward compatibility
      return {
        success: result.isSuccessful(),
        contacts: result.contacts || [],
        metadata: {
          ...result.metadata,
          extractionMethod: result.metadata.strategy || 'unknown',
          processingTime: result.processingTime,
          confidence: result.confidence || 0
        },
        processingTime: result.processingTime,
        error: result.isFailed() ? result.error : null
      };
    } catch (error) {
      logger.error('Extraction adapter error', error, {
        fileName,
        mimeType
      });

      return {
        success: false,
        contacts: [],
        error: error.message,
        metadata: {
          extractionMethod: 'new-architecture-failed',
          processingTime: 0
        }
      };
    }
  }

  /**
   * Extract text from document (backward compatible)
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @returns {Promise<string>} Extracted text
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    return await this.extractionService._extractText(fileBuffer, mimeType, 'document');
  }

  /**
   * Extract contacts from text (backward compatible)
   * @param {string} text - Document text
   * @param {object} documentAnalysis - Document analysis
   * @param {object} options - Extraction options
   * @returns {Promise<Array>} Extracted contacts
   */
  async extractContactsFromText(text, documentAnalysis, options = {}) {
    const result = await this.extractionService.extractContactsFromText(text, options);
    
    if (result.isSuccessful()) {
      return result.contacts || [];
    }
    
    return [];
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return this.extractionService.getHealthStatus();
  }
}

// Export singleton instance
module.exports = new ExtractionServiceAdapter();

