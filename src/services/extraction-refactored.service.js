/**
 * Refactored Extraction Service
 * 
 * Clean, maintainable extraction service that delegates to specialized components
 * This replaces the monolithic extraction.service.js with a modular architecture
 */

const ExtractionOrchestrator = require('./extraction/ExtractionOrchestrator');
const LibraryManager = require('./extraction/LibraryManager');

class RefactoredExtractionService {
  constructor() {
    // Initialize libraries on startup
    this.initializeAsync();
  }

  async initializeAsync() {
    try {
      await LibraryManager.initialize();
      console.log('✅ Refactored extraction service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize refactored extraction service:', error.message);
    }
  }

  /**
   * Main extraction method - processes file and extracts contacts
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    return await ExtractionOrchestrator.extractContacts(fileBuffer, mimeType, fileName, options);
  }

  /**
   * Extract text from document (for other services)
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    return await ExtractionOrchestrator.extractTextFromDocument(fileBuffer, mimeType);
  }

  /**
   * Extract contacts from already extracted text
   */
  async extractContactsFromText(text, documentAnalysis, options = {}) {
    return await ExtractionOrchestrator.extractContactsFromText(text, documentAnalysis, options);
  }

  /**
   * Save contacts to database
   */
  async saveContacts(contacts, userId, jobId) {
    return await ExtractionOrchestrator.saveContacts(contacts, userId, jobId);
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      ...ExtractionOrchestrator.getHealthStatus(),
      libraries: LibraryManager.getHealthStatus(),
      version: '2.0.0-refactored'
    };
  }

  /**
   * Get extraction statistics
   */
  async getExtractionStats(userId, timeframe = '30d') {
    return await ExtractionOrchestrator.getExtractionStats(userId, timeframe);
  }

  // Backward compatibility methods (delegate to orchestrator)
  
  /**
   * @deprecated Use extractTextFromDocument instead
   */
  async processFile(fileBuffer, mimeType, fileName) {
    console.warn('⚠️ processFile is deprecated, use extractTextFromDocument instead');
    return await this.extractTextFromDocument(fileBuffer, mimeType);
  }

  /**
   * @deprecated Use DocumentAnalyzer directly
   */
  analyzeDocumentStructure(text) {
    console.warn('⚠️ analyzeDocumentStructure is deprecated, use DocumentAnalyzer.analyzeDocument instead');
    const DocumentAnalyzer = require('./extraction/DocumentAnalyzer');
    return DocumentAnalyzer.analyzeDocument(text);
  }

  /**
   * @deprecated Use ContactValidator directly
   */
  validateContacts(contacts) {
    console.warn('⚠️ validateContacts is deprecated, use ContactValidator.validateContacts instead');
    const ContactValidator = require('./extraction/ContactValidator');
    return ContactValidator.validateContacts(contacts);
  }

  /**
   * @deprecated Use ContactValidator directly
   */
  calculateConfidenceScores(contacts) {
    console.warn('⚠️ calculateConfidenceScores is deprecated, contacts are scored automatically');
    return contacts; // Already scored by validator
  }

  /**
   * @deprecated Use ContactValidator directly
   */
  calculateOverallConfidence(contacts) {
    console.warn('⚠️ calculateOverallConfidence is deprecated, use ContactValidator.calculateOverallConfidence instead');
    const ContactValidator = require('./extraction/ContactValidator');
    return ContactValidator.calculateOverallConfidence(contacts);
  }
}

module.exports = new RefactoredExtractionService();
