/**
 * Test Case Entity
 * Domain entity representing a test case for extraction evaluation
 * 
 * SOLID Principles:
 * - Single Responsibility: Represents test case data and validation
 * - Encapsulation: Validates its own data integrity
 */

class TestCase {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.text = data.text;
    this.expectedContacts = data.expectedContacts || [];
    this.format = data.format || 'unknown';
    this.difficulty = data.difficulty || 'medium';
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.createdBy = data.createdBy || null;
    
    this.validate();
  }

  /**
   * Validate test case data
   */
  validate() {
    if (!this.id || typeof this.id !== 'string') {
      throw new Error('Test case must have a valid id');
    }
    
    if (!this.name || typeof this.name !== 'string' || this.name.trim().length === 0) {
      throw new Error('Test case must have a valid name');
    }
    
    if (!this.text || typeof this.text !== 'string' || this.text.trim().length === 0) {
      throw new Error('Test case must have valid text content');
    }
    
    if (!Array.isArray(this.expectedContacts)) {
      throw new Error('Expected contacts must be an array');
    }
    
    // Validate expected contacts structure
    this.expectedContacts.forEach((contact, index) => {
      if (!contact.name || typeof contact.name !== 'string') {
        throw new Error(`Contact at index ${index} must have a valid name`);
      }
      
      // At least email or phone must be present
      const hasEmail = contact.email && typeof contact.email === 'string';
      const hasPhone = contact.phone && typeof contact.phone === 'string';
      
      if (!hasEmail && !hasPhone) {
        throw new Error(`Contact at index ${index} must have at least email or phone`);
      }
    });
    
    // Validate format
    const validFormats = ['structured', 'semi-structured', 'unstructured', 'tabular', 'unknown'];
    if (!validFormats.includes(this.format)) {
      throw new Error(`Invalid format: ${this.format}. Must be one of: ${validFormats.join(', ')}`);
    }
    
    // Validate difficulty
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(this.difficulty)) {
      throw new Error(`Invalid difficulty: ${this.difficulty}. Must be one of: ${validDifficulties.join(', ')}`);
    }
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      text: this.text,
      expectedContacts: this.expectedContacts,
      format: this.format,
      difficulty: this.difficulty,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy
    };
  }

  /**
   * Update test case
   */
  update(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.text !== undefined) this.text = data.text;
    if (data.expectedContacts !== undefined) this.expectedContacts = data.expectedContacts;
    if (data.format !== undefined) this.format = data.format;
    if (data.difficulty !== undefined) this.difficulty = data.difficulty;
    if (data.metadata !== undefined) this.metadata = { ...this.metadata, ...data.metadata };
    
    this.updatedAt = new Date();
    this.validate();
  }
}

module.exports = TestCase;

