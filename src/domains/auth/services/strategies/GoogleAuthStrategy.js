/**
 * Google OAuth Authentication Strategy
 * 
 * Strategy for Google OAuth authentication
 * Implements Strategy Pattern for authentication methods
 * 
 * Best Practice: Strategy Pattern - encapsulates authentication algorithm
 */
const { google } = require('googleapis');
const Email = require('../../value-objects/Email');
const AuthResult = require('../../value-objects/AuthResult');
const UserRepository = require('../../repositories/UserRepository');
const SessionRepository = require('../../repositories/SessionRepository');
const TokenService = require('../TokenService');
const { logger } = require('../../../../shared/infrastructure/logger/logger.service');

class GoogleAuthStrategy {
  constructor({
    userRepository = new UserRepository(),
    sessionRepository = new SessionRepository(),
    tokenService = TokenService
  } = {}) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.tokenService = tokenService;
    
    // Initialize Google OAuth2 client
    this.oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.FRONTEND_URL}/auth/callback`
    );
  }

  /**
   * Get Google OAuth authorization URL
   * @returns {string} Authorization URL
   */
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    return this.oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Authenticate with Google OAuth code
   * @param {object} params - OAuth parameters
   * @param {string} params.code - OAuth authorization code
   * @returns {Promise<AuthResult>} Auth result
   */
  async authenticate({ code }) {
    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2.getToken(code);
      this.oauth2.setCredentials(tokens);

      // Get user info from Google
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2 });
      const { data: info } = await oauth2.userinfo.get();

      if (!info.email) {
        return AuthResult.failure({
          error: 'Google profile missing email',
          message: 'Unable to retrieve email from Google account'
        });
      }

      // Validate email
      const emailVO = new Email(info.email);

      // Find or create user
      let user = await this.userRepository.findByProvider('google', info.id);
      
      if (!user) {
        // Create new user
        user = await this.userRepository.create({
          name: info.name || info.email,
          email: emailVO.getValue(),
          provider: 'google',
          providerId: info.id,
          emailVerified: !!info.verified_email
        });

        // Auto-create free plan subscription
        await this._createFreeSubscription(user.getId());

        logger.info('Google user created', { userId: user.getId(), email: emailVO.getValue() });
      } else {
        // Update last login for existing user
        user = await this.userRepository.updateLastLogin(user.getId());
        logger.info('Google user logged in', { userId: user.getId(), email: emailVO.getValue() });
      }

      // Create session
      const session = await this._createSession(user);

      return AuthResult.success({
        user: user.toObject(),
        accessToken: session.getAccessToken(),
        refreshToken: session.getRefreshToken(),
        session: session.toObject(),
        message: 'Google authentication successful'
      });
    } catch (error) {
      logger.error('Google authentication failed', { error: error.message, stack: error.stack });
      return AuthResult.failure({
        error: error.message || 'Google authentication failed',
        message: 'Failed to authenticate with Google'
      });
    }
  }

  /**
   * Create session for user
   * @private
   */
  async _createSession(user) {
    const accessToken = this.tokenService.generateAccessToken({
      userId: user.getId(),
      email: user.getEmailString(),
      provider: user.getProvider()
    });

    const refreshToken = this.tokenService.generateRefreshToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = await this.sessionRepository.create({
      userId: user.getId(),
      accessToken: accessToken.getValue(),
      refreshToken,
      expiresAt,
      isActive: true
    });

    return session;
  }

  /**
   * Create free plan subscription for new user
   * @private
   */
  async _createFreeSubscription(userId) {
    try {
      const subscriptionService = require('../../../../services/subscription.service');
      await subscriptionService.createSubscription(userId, 'free');
      logger.info('Free plan subscription created', { userId });
    } catch (error) {
      logger.error('Failed to create free subscription', { userId, error: error.message });
      // Don't throw - registration should succeed even if subscription creation fails
    }
  }
}

module.exports = GoogleAuthStrategy;

