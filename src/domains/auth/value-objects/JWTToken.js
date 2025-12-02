/**
 * JWT Token Value Object
 * 
 * Immutable value object representing a JWT token
 * Validates token format and extracts claims
 * 
 * Best Practice: Value Object - immutable, validates on creation
 */
const jwt = require('jsonwebtoken');

class JWTToken {
  constructor(value, secret = null) {
    if (!value || typeof value !== 'string') {
      throw new Error('JWT token must be a non-empty string');
    }

    // Basic JWT format validation (header.payload.signature)
    const parts = value.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    this._value = value;
    this._secret = secret;
    this._decoded = null;
    
    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Decode token (without verification)
   * @returns {object} Decoded token payload
   */
  decode() {
    if (this._decoded) {
      return this._decoded;
    }

    try {
      this._decoded = jwt.decode(this._value, { complete: true });
      return this._decoded;
    } catch (error) {
      throw new Error(`Failed to decode JWT token: ${error.message}`);
    }
  }

  /**
   * Verify token signature
   * @param {string} secret - JWT secret
   * @returns {object} Verified token payload
   */
  verify(secret) {
    try {
      return jwt.verify(this._value, secret || this._secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Get token payload (decoded)
   * @returns {object} Token payload
   */
  getPayload() {
    const decoded = this.decode();
    return decoded.payload || decoded;
  }

  /**
   * Get user ID from token
   * @returns {string|null} User ID
   */
  getUserId() {
    const payload = this.getPayload();
    return payload.userId || payload.sub || null;
  }

  /**
   * Get email from token
   * @returns {string|null} Email
   */
  getEmail() {
    const payload = this.getPayload();
    return payload.email || null;
  }

  /**
   * Check if token is expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    try {
      const payload = this.getPayload();
      if (!payload.exp) {
        return false; // No expiration claim
      }
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true; // If we can't decode, consider it expired
    }
  }

  /**
   * Get expiration date
   * @returns {Date|null} Expiration date
   */
  getExpirationDate() {
    const payload = this.getPayload();
    if (!payload.exp) {
      return null;
    }
    return new Date(payload.exp * 1000);
  }

  /**
   * Get token value
   * @returns {string} JWT token string
   */
  getValue() {
    return this._value;
  }

  /**
   * Convert to string
   * @returns {string} JWT token string
   */
  toString() {
    return this._value;
  }

  /**
   * Convert to JSON
   * @returns {string} JWT token string
   */
  toJSON() {
    return this._value;
  }

  /**
   * Create from string
   * @param {string} value - JWT token string
   * @param {string} secret - Optional secret for verification
   * @returns {JWTToken} JWTToken instance
   */
  static fromString(value, secret = null) {
    return new JWTToken(value, secret);
  }

  /**
   * Generate new token
   * @param {object} payload - Token payload
   * @param {string} secret - JWT secret
   * @param {string|number} expiresIn - Expiration time (e.g., '24h', 3600)
   * @returns {JWTToken} New JWTToken instance
   */
  static generate(payload, secret, expiresIn = '24h') {
    const token = jwt.sign(payload, secret, { expiresIn });
    return new JWTToken(token, secret);
  }

  /**
   * Validate token format (static utility)
   * @param {string} value - Token to validate
   * @returns {boolean} True if valid format
   */
  static isValidFormat(value) {
    try {
      new JWTToken(value);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = JWTToken;

