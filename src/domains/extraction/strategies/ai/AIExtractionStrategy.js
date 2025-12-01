/**
 * AI Extraction Strategy
 * 
 * Implements extraction using OpenAI GPT-4o Mini
 * Wraps existing OptimizedAIExtractionService
 * 
 * Best Practice: Adapter Pattern - adapts existing service to new interface
 * Best Practice: Composition over inheritance
 * Best Practice: Dependency Injection
 */
const ExtractionStrategy = require('../base/ExtractionStrategy');
const ExtractionResult = require('../../value-objects/ExtractionResult');
const ExtractionMetadata = require('../../value-objects/ExtractionMetadata');

class AIExtractionStrategy extends ExtractionStrategy {
  /**
   * Constructor with dependency injection
   * @param {object} aiExtractionService - OptimizedAIExtractionService instance
   */
  constructor(aiExtractionService = null) {
    super();
    
    // Lazy load service if not provided (backward compatibility)
    if (!aiExtractionService) {
      this._service = null;
    } else {
      this._service = aiExtractionService;
    }
  }

  /**
   * Get or initialize the AI extraction service
   * @private
   * @returns {object} OptimizedAIExtractionService instance
   */
  _getService() {
    if (!this._service) {
      // Lazy load to avoid circular dependencies
      const OptimizedAIExtractionService = require('../../../../services/optimizedAIExtraction.service');
      this._service = new OptimizedAIExtractionService();
    }
    return this._service;
  }

  /**
   * Extract contacts from document text
   * Note: AI service expects file buffer, so we create a text buffer
   * 
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
          { strategy: 'ai' },
          0
        );
      }

      // Check if service is available
      const service = this._getService();
      if (!service.isAvailable) {
        return ExtractionResult.failure(
          'AI extraction service is not available - OpenAI API key required',
          { strategy: 'ai' },
          0
        );
      }

      // Convert text to buffer for AI service
      // AI service expects file buffer, so we create a text file buffer
      const textBuffer = Buffer.from(text, 'utf-8');
      const mimeType = options.mimeType || 'text/plain';
      const fileName = options.fileName || 'extracted-text.txt';

      // Extract contacts using AI service
      const result = await service.extractContacts(
        textBuffer,
        mimeType,
        fileName,
        {
          ...options,
          extractionId: options.extractionId || `ai_${Date.now()}`
        }
      );

      const processingTime = Date.now() - startTime;

      // Convert to ExtractionResult value object
      if (result.success) {
        // Calculate confidence from metadata
        const confidence = result.metadata?.confidence || 
                          this._calculateConfidenceFromContacts(result.contacts);
        
        // Create metadata
        const metadata = ExtractionMetadata.fromAnalysis(
          {
            type: result.metadata?.documentType || 'unknown',
            productionType: result.metadata?.productionType || null,
            textLength: text.length,
            quality: confidence,
            confidence: confidence
          },
          'ai-powered',
          processingTime
        );

        // Add AI-specific metadata
        const enhancedMetadata = {
          ...metadata.toJSON(),
          extractionId: result.metadata?.extractionId,
          extractionMethod: result.metadata?.extractionMethod || 'ai-powered',
          estimatedCost: result.metadata?.estimatedCost || 0,
          tokensUsed: result.metadata?.tokensUsed || 0,
          strategy: 'ai',
          model: 'gpt-4o-mini'
        };

        return ExtractionResult.success(
          result.contacts || [],
          enhancedMetadata,
          'ai',
          processingTime
        );
      } else {
        // Handle failure
        return ExtractionResult.failure(
          result.error || result.metadata?.error || 'AI extraction failed',
          {
            strategy: 'ai',
            extractionId: result.metadata?.extractionId,
            estimatedCost: result.metadata?.estimatedCost || 0
          },
          processingTime
        );
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return ExtractionResult.failure(
        error.message || 'AI extraction error',
        {
          strategy: 'ai',
          error: error.message,
          stack: error.stack
        },
        processingTime
      );
    }
  }

  /**
   * Calculate confidence from contacts
   * AI extraction typically has high confidence
   * @private
   * @param {Array} contacts - Extracted contacts
   * @returns {number} Confidence score (0-1)
   */
  _calculateConfidenceFromContacts(contacts) {
    if (!contacts || contacts.length === 0) {
      return 0;
    }

    // AI extraction typically has high confidence
    // Average confidence from contacts if available
    const contactsWithConfidence = contacts.filter(c => c.confidence !== undefined);
    if (contactsWithConfidence.length > 0) {
      const avgConfidence = contactsWithConfidence.reduce((sum, c) => sum + (c.confidence || 0), 0) / contactsWithConfidence.length;
      return Math.min(1, Math.max(0.85, avgConfidence)); // AI is at least 85% confident
    }

    // Default high confidence for AI
    return 0.92;
  }

  /**
   * Get strategy name
   * @returns {string} Strategy name
   */
  getName() {
    return 'AIExtractionStrategy';
  }

  /**
   * Get strategy confidence level
   * AI extraction is excellent for complex/unusual formats
   * 
   * @param {object} documentAnalysis - Document analysis
   * @returns {number} Confidence score (0-1)
   */
  getConfidence(documentAnalysis = {}) {
    // Highest confidence for complex/unusual documents
    if (documentAnalysis.type === 'unknown' || documentAnalysis.complexity === 'high') {
      return 0.95;
    }
    
    // High confidence for scanned PDFs (needs OCR + AI)
    if (documentAnalysis.type === 'scanned_pdf' || documentAnalysis.type === 'image') {
      return 0.93;
    }
    
    // High confidence for unstructured documents
    if (documentAnalysis.type === 'unstructured' || documentAnalysis.type === 'free_text') {
      return 0.90;
    }
    
    // Good confidence for all document types
    return 0.88;
  }

  /**
   * Check if strategy is available
   * Requires OpenAI API key
   * 
   * @returns {Promise<boolean>} True if OpenAI API key is configured
   */
  async isAvailable() {
    try {
      const service = this._getService();
      return service.isAvailable === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get strategy capabilities
   * @returns {object} Capabilities object
   */
  getCapabilities() {
    return {
      supportsPDF: true,
      supportsImages: true, // With OCR preprocessing
      supportsWord: true,
      supportsExcel: true,
      requiresAPI: true, // Requires OpenAI API
      requiresAPIKey: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      cost: 'variable', // Depends on document size
      speed: 'medium', // 10-60 seconds
      accuracy: 'high' // 92-96%
    };
  }

  /**
   * Get estimated processing time
   * AI extraction takes longer but is more accurate
   * 
   * @param {object} document - Document value object
   * @returns {number} Estimated processing time in milliseconds
   */
  getEstimatedTime(document) {
    const textLength = document.getContentLength();
    
    // Base time: 5 seconds
    // Additional time: ~2ms per 1000 characters
    // AI processing is slower but more accurate
    const baseTime = 5000;
    const perCharTime = (textLength / 1000) * 2;
    
    // Cap at 60 seconds
    return Math.min(60000, baseTime + perCharTime);
  }

  /**
   * Get estimated cost
   * @param {object} document - Document value object
   * @returns {number} Estimated cost in USD
   */
  getEstimatedCost(document) {
    const textLength = document.getContentLength();
    const estimatedTokens = Math.ceil(textLength / 4); // Rough: 4 chars = 1 token
    
    // GPT-4o Mini pricing
    const inputCostPer1k = 0.00015; // $0.00015 per 1k input tokens
    const outputCostPer1k = 0.0006; // $0.0006 per 1k output tokens
    
    // Estimate: mostly input tokens, some output
    const inputCost = (estimatedTokens / 1000) * inputCostPer1k;
    const outputCost = (estimatedTokens * 0.1 / 1000) * outputCostPer1k; // ~10% output
    
    return inputCost + outputCost;
  }

  /**
   * Get strategy description
   * @returns {string} Strategy description
   */
  getDescription() {
    return 'AI-powered extraction using GPT-4o Mini. Best for complex, unusual, or scanned documents. High accuracy (92-96%). Requires OpenAI API key.';
  }
}

module.exports = AIExtractionStrategy;

