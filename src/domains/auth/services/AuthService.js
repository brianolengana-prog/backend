/**
 * Auth Service
 * 
 * Main authentication service orchestrating different auth strategies
 * Provides unified interface for all authentication methods
 * 
 * Best Practice: Service Layer - orchestrates domain components
 * Best Practice: Strategy Pattern - delegates to specific strategies
 */
const EmailAuthStrategy = require('./strategies/EmailAuthStrategy');
const GoogleAuthStrategy = require('./strategies/GoogleAuthStrategy');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

class AuthService {
  constructor({
    emailStrategy = new EmailAuthStrategy(),
    googleStrategy = new GoogleAuthStrategy()
  } = {}) {
    this.emailStrategy = emailStrategy;
    this.googleStrategy = googleStrategy;
  }

  /**
   * Register new user with email/password
   * @param {object} params - Registration parameters
   * @param {string} params.name - User name
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @returns {Promise<AuthResult>} Auth result
   */
  async register(params) {
    logger.info('Registration attempt', { email: params.email });
    return await this.emailStrategy.register(params);
  }

  /**
   * Login with email/password
   * @param {object} params - Login parameters
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @returns {Promise<AuthResult>} Auth result
   */
  async login(params) {
    logger.info('Login attempt', { email: params.email });
    return await this.emailStrategy.login(params);
  }

  /**
   * Get Google OAuth authorization URL
   * @returns {string} Authorization URL
   */
  getGoogleAuthUrl() {
    return this.googleStrategy.getAuthUrl();
  }

  /**
   * Authenticate with Google OAuth code
   * @param {object} params - OAuth parameters
   * @param {string} params.code - OAuth authorization code
   * @returns {Promise<AuthResult>} Auth result
   */
  async authenticateWithGoogle(params) {
    logger.info('Google OAuth authentication attempt');
    return await this.googleStrategy.authenticate(params);
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return {
      service: 'AuthService',
      status: 'healthy',
      strategies: {
        email: 'available',
        google: 'available'
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AuthService;

