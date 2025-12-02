/**
 * Token Service
 * 
 * Service for JWT token operations (generation, verification, validation)
 * 
 * Best Practice: Service Layer - encapsulates token business logic
 */
const JWTToken = require('../value-objects/JWTToken');
const crypto = require('crypto');

class TokenService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Generate access token
   * @param {object} payload - Token payload (userId, email, provider, etc.)
   * @param {string|number} expiresIn - Expiration time (default: from env)
   * @returns {JWTToken} JWT token value object
   */
  generateAccessToken(payload, expiresIn = null) {
    return JWTToken.generate(
      payload,
      this.jwtSecret,
      expiresIn || this.jwtExpiry
    );
  }

  /**
   * Generate refresh token (random string)
   * @returns {string} Refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify access token
   * @param {string} token - JWT token string
   * @returns {object} Verified token payload
   * @throws {Error} If token is invalid or expired
   */
  verifyAccessToken(token) {
    const jwtToken = JWTToken.fromString(token, this.jwtSecret);
    return jwtToken.verify(this.jwtSecret);
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token string
   * @returns {object} Decoded token payload
   */
  decodeToken(token) {
    const jwtToken = JWTToken.fromString(token);
    return jwtToken.getPayload();
  }

  /**
   * Get user ID from token
   * @param {string} token - JWT token string
   * @returns {string|null} User ID
   */
  getUserIdFromToken(token) {
    try {
      const jwtToken = JWTToken.fromString(token);
      return jwtToken.getUserId();
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token string
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    try {
      const jwtToken = JWTToken.fromString(token);
      return jwtToken.isExpired();
    } catch {
      return true; // If we can't decode, consider it expired
    }
  }

  /**
   * Create JWTToken value object from string
   * @param {string} token - JWT token string
   * @returns {JWTToken} JWT token value object
   */
  createToken(token) {
    return JWTToken.fromString(token, this.jwtSecret);
  }

  /**
   * Validate token format
   * @param {string} token - Token to validate
   * @returns {boolean} True if valid format
   */
  isValidTokenFormat(token) {
    return JWTToken.isValidFormat(token);
  }
}

module.exports = new TokenService();

