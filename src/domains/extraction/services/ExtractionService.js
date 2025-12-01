/**
 * Extraction Service
 * 
 * Main orchestration service for contact extraction
 * Coordinates strategies, processors, and validators
 * 
 * Best Practice: Service Layer - orchestrates domain components
 * Best Practice: Dependency Injection - all dependencies injected
 * Best Practice: Single Responsibility - orchestration only
 */
const ExtractionStrategyFactory = require('./ExtractionStrategyFactory');
const Document = require('../value-objects/Document');
const ExtractionResult = require('../value-objects/ExtractionResult');
const ExtractionMetadata = require('../value-objects/ExtractionMetadata');
const logger = require('../../../shared/infrastructure/logger/logger.service');

class ExtractionService {
  /**
   * Constructor with dependency injection
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.strategyFactory - ExtractionStrategyFactory instance
   * @param {object} dependencies.documentProcessor - DocumentProcessor instance
   * @param {object} dependencies.contactValidator - ContactValidator instance
   */
  constructor(dependencies = {}) {
    this.strategyFactory = dependencies.strategyFactory || new ExtractionStrategyFactory();
    this.documentProcessor = dependencies.documentProcessor || null;
    this.contactValidator = dependencies.contactValidator || null;
  }

  /**
   * Get or initialize document processor
   * @private
   * @returns {object} DocumentProcessor instance
   */
  _getDocumentProcessor() {
    if (!this.documentProcessor) {
      // Lazy load to avoid circular dependencies
      const DocumentProcessor = require('../../../services/extraction/DocumentProcessor');
      this.documentProcessor = new DocumentProcessor();
    }
    return this.documentProcessor;
  }

  /**
   * Get or initialize contact validator
   * @private
   * @returns {object} ContactValidator instance
   */
  _getContactValidator() {
    if (!this.contactValidator) {
      // Lazy load to avoid circular dependencies
      const ContactValidator = require('../../../services/extraction/ContactValidator');
      this.contactValidator = ContactValidator;
    }
    return this.contactValidator;
  }

  /**
   * Extract contacts from file buffer
   * Main entry point for extraction
   * 
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {object} options - Extraction options
   * @returns {Promise<ExtractionResult>} Extraction result
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = options.extractionId || `extraction_${Date.now()}`;

    try {
      logger.info('🚀 Starting extraction', {
        extractionId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length
      });

      // Step 1: Extract text from document
      const extractedText = await this._extractText(fileBuffer, mimeType, fileName);
      
      if (!extractedText || extractedText.trim().length < 10) {
        return ExtractionResult.failure(
          'Could not extract meaningful text from document',
          { extractionId, strategy: 'unknown' },
          Date.now() - startTime
        );
      }

      logger.info('📄 Text extracted', {
        extractionId,
        textLength: extractedText.length
      });

      // Step 2: Create Document value object
      const document = Document.fromFile(fileBuffer, mimeType, fileName, extractedText);

      // Step 3: Analyze document (simple analysis for now)
      const documentAnalysis = this._analyzeDocument(document, extractedText);

      // Step 4: Select extraction strategy
      const strategy = await this.strategyFactory.selectStrategy(documentAnalysis, {
        preferredStrategy: options.strategy,
        preferFast: options.preferFast,
        preferFree: options.preferFree
      });

      logger.info('🎯 Strategy selected', {
        extractionId,
        strategy: strategy.getName(),
        documentType: documentAnalysis.type
      });

      // Step 5: Extract contacts using selected strategy
      const extractionResult = await strategy.extract(extractedText, {
        ...options,
        extractionId,
        mimeType,
        fileName
      });

      const processingTime = Date.now() - startTime;

      // Step 6: Validate contacts if validator available
      let validatedContacts = extractionResult.contacts || [];
      if (this.contactValidator && validatedContacts.length > 0) {
        const validator = this._getContactValidator();
        validatedContacts = validator.validateContacts(validatedContacts);
        
        // Sort contacts
        if (validator.sortContacts) {
          validatedContacts = validator.sortContacts(validatedContacts);
        }
      }

      // Step 7: Apply role preferences if specified
      if (options.rolePreferences && options.rolePreferences.length > 0) {
        validatedContacts = this._filterByRolePreferences(validatedContacts, options.rolePreferences);
      }

      // Step 8: Create final result
      const finalMetadata = {
        ...extractionResult.metadata,
        extractionId,
        processingTime,
        strategy: strategy.getName(),
        contactCount: validatedContacts.length,
        originalContactCount: extractionResult.getContactCount()
      };

      return ExtractionResult.success(
        validatedContacts,
        finalMetadata,
        strategy.getName(),
        processingTime
      );

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Extraction failed', error, {
        extractionId,
        fileName,
        processingTime
      });

      return ExtractionResult.failure(
        error.message || 'Extraction failed',
        {
          extractionId,
          error: error.message,
          stack: error.stack
        },
        processingTime
      );
    }
  }

  /**
   * Extract contacts from text (no file processing)
   * 
   * @param {string} text - Document text
   * @param {object} options - Extraction options
   * @returns {Promise<ExtractionResult>} Extraction result
   */
  async extractContactsFromText(text, options = {}) {
    const startTime = Date.now();
    const extractionId = options.extractionId || `text_extraction_${Date.now()}`;

    try {
      if (!text || text.trim().length < 10) {
        return ExtractionResult.failure(
          'Text is too short or empty',
          { extractionId },
          0
        );
      }

      // Create Document value object from text
      const document = Document.fromText(text, options.fileName || 'text.txt');

      // Analyze document
      const documentAnalysis = this._analyzeDocument(document, text);

      // Select strategy
      const strategy = await this.strategyFactory.selectStrategy(documentAnalysis, {
        preferredStrategy: options.strategy,
        preferFast: options.preferFast,
        preferFree: options.preferFree
      });

      // Extract contacts
      const result = await strategy.extract(text, {
        ...options,
        extractionId
      });

      const processingTime = Date.now() - startTime;

      // Validate contacts
      let validatedContacts = result.contacts || [];
      if (this.contactValidator && validatedContacts.length > 0) {
        const validator = this._getContactValidator();
        validatedContacts = validator.validateContacts(validatedContacts);
        
        if (validator.sortContacts) {
          validatedContacts = validator.sortContacts(validatedContacts);
        }
      }

      // Apply role preferences
      if (options.rolePreferences && options.rolePreferences.length > 0) {
        validatedContacts = this._filterByRolePreferences(validatedContacts, options.rolePreferences);
      }

      const finalMetadata = {
        ...result.metadata,
        extractionId,
        processingTime,
        strategy: strategy.getName(),
        contactCount: validatedContacts.length
      };

      return ExtractionResult.success(
        validatedContacts,
        finalMetadata,
        strategy.getName(),
        processingTime
      );

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Text extraction failed', error, {
        extractionId,
        processingTime
      });

      return ExtractionResult.failure(
        error.message || 'Text extraction failed',
        {
          extractionId,
          error: error.message
        },
        processingTime
      );
    }
  }

  /**
   * Extract text from document
   * @private
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @returns {Promise<string>} Extracted text
   */
  async _extractText(fileBuffer, mimeType, fileName) {
    const processor = this._getDocumentProcessor();
    return await processor.extractText(fileBuffer, mimeType, fileName);
  }

  /**
   * Analyze document structure
   * @private
   * @param {Document} document - Document value object
   * @param {string} text - Document text
   * @returns {object} Document analysis
   */
  _analyzeDocument(document, text) {
    // Simple analysis - can be enhanced later
    let type = 'unknown';
    let complexity = 'medium';

    // Detect document type
    if (document.isPDF()) {
      type = 'call_sheet'; // Assume call sheet for PDFs
    } else if (document.isWord()) {
      type = 'structured';
    } else if (document.isExcel()) {
      type = 'table';
    }

    // Assess complexity
    const textLength = text.length;
    if (textLength < 1000) {
      complexity = 'low';
    } else if (textLength < 10000) {
      complexity = 'medium';
    } else {
      complexity = 'high';
    }

    return {
      type,
      complexity,
      textLength,
      productionType: null
    };
  }

  /**
   * Filter contacts by role preferences
   * @private
   * @param {Array} contacts - Contacts array
   * @param {Array} rolePreferences - Preferred roles
   * @returns {Array} Filtered contacts
   */
  _filterByRolePreferences(contacts, rolePreferences) {
    if (!rolePreferences || rolePreferences.length === 0) {
      return contacts;
    }

    const normalizedPreferences = rolePreferences.map(r => r.toLowerCase().trim());
    
    return contacts.filter(contact => {
      if (!contact.role) return false;
      const normalizedRole = contact.role.toLowerCase().trim();
      return normalizedPreferences.some(pref => 
        normalizedRole.includes(pref) || pref.includes(normalizedRole)
      );
    });
  }

  /**
   * Get available strategies
   * @param {object} documentAnalysis - Document analysis
   * @returns {Promise<Array>} Available strategies
   */
  async getAvailableStrategies(documentAnalysis = {}) {
    return await this.strategyFactory.getAvailableStrategies(documentAnalysis);
  }

  /**
   * Get strategy recommendations
   * @param {object} documentAnalysis - Document analysis
   * @returns {Promise<object>} Strategy recommendations
   */
  async getStrategyRecommendations(documentAnalysis = {}) {
    return await this.strategyFactory.getRecommendations(documentAnalysis);
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return {
      initialized: true,
      strategyFactory: 'available',
      documentProcessor: this.documentProcessor ? 'available' : 'lazy-load',
      contactValidator: this.contactValidator ? 'available' : 'lazy-load',
      supportedFormats: [
        'PDF', 'DOCX', 'XLSX', 'XLS', 'CSV', 'Images', 'Plain Text'
      ]
    };
  }
}

module.exports = ExtractionService;

