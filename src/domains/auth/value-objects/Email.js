/**
 * Email Value Object
 * 
 * Immutable value object representing an email address
 * Validates email format and ensures consistency
 * 
 * Best Practice: Value Object - immutable, validates on creation
 */
class Email {
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Email must be a non-empty string');
    }

    const trimmed = value.trim().toLowerCase();
    
    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
      throw new Error(`Invalid email format: ${value}`);
    }

    // Additional validation: max length
    if (trimmed.length > 254) {
      throw new Error('Email address too long (max 254 characters)');
    }

    // Set value before freezing
    this._value = trimmed;
    
    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Get email value
   * @returns {string} Email address
   */
  getValue() {
    return this._value;
  }

  /**
   * Get email domain
   * @returns {string} Domain part of email
   */
  getDomain() {
    return this._value.split('@')[1];
  }

  /**
   * Get email local part
   * @returns {string} Local part of email
   */
  getLocalPart() {
    return this._value.split('@')[0];
  }

  /**
   * Compare with another email
   * @param {Email} other - Other email to compare
   * @returns {boolean} True if emails are equal
   */
  equals(other) {
    if (!(other instanceof Email)) {
      return false;
    }
    return this._value === other._value;
  }

  /**
   * Convert to string
   * @returns {string} Email address
   */
  toString() {
    return this._value;
  }

  /**
   * Convert to JSON
   * @returns {string} Email address
   */
  toJSON() {
    return this._value;
  }

  /**
   * Create from string
   * @param {string} value - Email string
   * @returns {Email} Email instance
   */
  static fromString(value) {
    return new Email(value);
  }

  /**
   * Validate email format (static utility)
   * @param {string} value - Email to validate
   * @returns {boolean} True if valid
   */
  static isValid(value) {
    try {
      new Email(value);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = Email;

