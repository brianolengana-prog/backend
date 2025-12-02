/**
 * Password Value Object
 * 
 * Immutable value object representing a password
 * Validates password strength and handles hashing
 * 
 * Best Practice: Value Object - immutable, validates on creation
 * Best Practice: Never store plain text passwords
 */
const bcrypt = require('bcrypt');

class Password {
  constructor(value, isHashed = false) {
    if (!value || typeof value !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    // If already hashed, just store it
    if (isHashed) {
      this._value = value;
      this._isHashed = true;
      Object.freeze(this);
      return;
    }

    // Validate plain text password
    this._validatePlainPassword(value);
    
    // Store plain text temporarily (will be hashed when needed)
    this._value = value;
    this._isHashed = false;
    
    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Validate plain text password strength
   * @private
   */
  _validatePlainPassword(value) {
    if (value.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (value.length > 128) {
      throw new Error('Password must be less than 128 characters');
    }

    // Optional: Add more strength requirements
    // const hasUpperCase = /[A-Z]/.test(value);
    // const hasLowerCase = /[a-z]/.test(value);
    // const hasNumber = /\d/.test(value);
    // const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    
    // if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    //   throw new Error('Password must contain uppercase, lowercase, number, and special character');
    // }
  }

  /**
   * Hash the password
   * @param {number} saltRounds - Bcrypt salt rounds (default: 12)
   * @returns {Promise<Password>} New Password instance with hashed value
   */
  async hash(saltRounds = 12) {
    if (this._isHashed) {
      return this; // Already hashed
    }

    const hashed = await bcrypt.hash(this._value, saltRounds);
    return new Password(hashed, true);
  }

  /**
   * Compare with plain text password
   * @param {string} plainPassword - Plain text password to compare
   * @returns {Promise<boolean>} True if passwords match
   */
  async compare(plainPassword) {
    if (!this._isHashed) {
      throw new Error('Cannot compare: password is not hashed');
    }

    return await bcrypt.compare(plainPassword, this._value);
  }

  /**
   * Get hashed value (only if hashed)
   * @returns {string} Hashed password
   */
  getHash() {
    if (!this._isHashed) {
      throw new Error('Password is not hashed. Call hash() first.');
    }
    return this._value;
  }

  /**
   * Check if password is hashed
   * @returns {boolean} True if hashed
   */
  isHashed() {
    return this._isHashed;
  }

  /**
   * Never expose plain text password
   * @returns {string} Masked password
   */
  toString() {
    return '***';
  }

  /**
   * Convert to JSON (never expose password)
   * @returns {string} Masked password
   */
  toJSON() {
    return '***';
  }

  /**
   * Create from plain text
   * @param {string} value - Plain text password
   * @returns {Password} Password instance
   */
  static fromPlainText(value) {
    return new Password(value, false);
  }

  /**
   * Create from hash
   * @param {string} hash - Hashed password
   * @returns {Password} Password instance
   */
  static fromHash(hash) {
    return new Password(hash, true);
  }

  /**
   * Validate password strength (static utility)
   * @param {string} value - Password to validate
   * @returns {object} Validation result
   */
  static validateStrength(value) {
    const errors = [];

    if (!value || value.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (value && value.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Password;

