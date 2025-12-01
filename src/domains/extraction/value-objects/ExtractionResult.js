/**
 * ExtractionResult Value Object
 * 
 * Immutable value object representing extraction results
 * Contains contacts, metadata, and extraction information
 * 
 * Best Practice: Value objects encapsulate related data
 */
class ExtractionResult {
  constructor(data) {
    this.success = data.success || false;
    this.contacts = data.contacts || [];
    this.metadata = data.metadata || {};
    this.error = data.error || null;
    this.processingTime = data.processingTime || 0;
    this.strategy = data.strategy || 'unknown';
    this.confidence = data.confidence || 0;
    
    // Freeze to prevent mutation
    Object.freeze(this);
  }

  /**
   * Check if extraction was successful
   * @returns {boolean}
   */
  isSuccessful() {
    return this.success === true;
  }

  /**
   * Check if extraction failed
   * @returns {boolean}
   */
  isFailed() {
    return this.success === false;
  }

  /**
   * Get number of contacts extracted
   * @returns {number}
   */
  getContactCount() {
    return this.contacts ? this.contacts.length : 0;
  }

  /**
   * Check if any contacts were extracted
   * @returns {boolean}
   */
  hasContacts() {
    return this.getContactCount() > 0;
  }

  /**
   * Get contacts with email
   * @returns {Array}
   */
  getContactsWithEmail() {
    if (!this.contacts) return [];
    return this.contacts.filter(contact => contact.email);
  }

  /**
   * Get contacts with phone
   * @returns {Array}
   */
  getContactsWithPhone() {
    if (!this.contacts) return [];
    return this.contacts.filter(contact => contact.phone);
  }

  /**
   * Check if result has high confidence
   * @param {number} threshold - Confidence threshold (default: 0.8)
   * @returns {boolean}
   */
  hasHighConfidence(threshold = 0.8) {
    return this.confidence >= threshold;
  }

  /**
   * Get processing time in seconds
   * @returns {number}
   */
  getProcessingTimeSeconds() {
    return this.processingTime / 1000;
  }

  /**
   * Create successful result
   * @param {Array} contacts - Extracted contacts
   * @param {object} metadata - Result metadata
   * @param {string} strategy - Extraction strategy used
   * @param {number} processingTime - Processing time in ms
   * @returns {ExtractionResult}
   */
  static success(contacts, metadata = {}, strategy = 'unknown', processingTime = 0) {
    const confidence = metadata.confidence || 0;
    return new ExtractionResult({
      success: true,
      contacts,
      metadata,
      strategy,
      processingTime,
      confidence
    });
  }

  /**
   * Create failed result
   * @param {string} error - Error message
   * @param {object} metadata - Error metadata
   * @param {number} processingTime - Processing time in ms
   * @returns {ExtractionResult}
   */
  static failure(error, metadata = {}, processingTime = 0) {
    return new ExtractionResult({
      success: false,
      error,
      metadata,
      processingTime,
      contacts: []
    });
  }

  /**
   * Convert to plain object
   * @returns {object}
   */
  toJSON() {
    return {
      success: this.success,
      contacts: this.contacts,
      metadata: this.metadata,
      error: this.error,
      processingTime: this.processingTime,
      strategy: this.strategy,
      confidence: this.confidence,
      contactCount: this.getContactCount()
    };
  }
}

module.exports = ExtractionResult;

