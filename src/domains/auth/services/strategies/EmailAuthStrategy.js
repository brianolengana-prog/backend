/**
 * Email Authentication Strategy
 * 
 * Strategy for email/password authentication
 * Implements Strategy Pattern for authentication methods
 * 
 * Best Practice: Strategy Pattern - encapsulates authentication algorithm
 */
const Email = require('../../value-objects/Email');
const Password = require('../../value-objects/Password');
const AuthResult = require('../../value-objects/AuthResult');
const UserRepository = require('../../repositories/UserRepository');
const SessionRepository = require('../../repositories/SessionRepository');
const EmailVerificationRepository = require('../../repositories/EmailVerificationRepository');
const PasswordService = require('../PasswordService');
const TokenService = require('../TokenService');
const emailService = require('../../../../services/email.service');
const crypto = require('crypto');
const { logger } = require('../../../../shared/infrastructure/logger/logger.service');

class EmailAuthStrategy {
  constructor({
    userRepository = new UserRepository(),
    sessionRepository = new SessionRepository(),
    emailVerificationRepository = new EmailVerificationRepository(),
    passwordService = PasswordService,
    tokenService = TokenService,
    emailServiceInstance = emailService
  } = {}) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.emailVerificationRepository = emailVerificationRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
    this.emailService = emailServiceInstance;
  }

  /**
   * Register new user with email/password
   * @param {object} params - Registration parameters
   * @param {string} params.name - User name
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @returns {Promise<AuthResult>} Auth result
   */
  async register({ name, email, password }) {
    try {
      // Validate email
      const emailVO = new Email(email);

      // Check if user already exists
      const existing = await this.userRepository.findByEmail(emailVO.getValue());
      if (existing) {
        return AuthResult.failure({
          error: 'User already exists',
          message: 'An account with this email already exists'
        });
      }

      // Validate and hash password
      const passwordVO = Password.fromPlainText(password);
      const hashedPassword = await passwordVO.hash();

      // Create user
      const user = await this.userRepository.create({
        name,
        email: emailVO.getValue(),
        passwordHash: hashedPassword.getHash(),
        provider: 'email',
        emailVerified: false
      });

      // Create session
      const session = await this._createSession(user);

      // Auto-create free plan subscription
      await this._createFreeSubscription(user.getId());

      // Send email verification
      await this._sendVerificationEmail(user.getId(), emailVO.getValue());

      logger.info('User registered successfully', { userId: user.getId(), email: emailVO.getValue() });

      return AuthResult.success({
        user: user.toObject(),
        accessToken: session.getAccessToken(),
        refreshToken: session.getRefreshToken(),
        session: session.toObject(),
        message: 'Registration successful. Please check your email to verify your account.'
      });
    } catch (error) {
      logger.error('Registration failed', { error: error.message, stack: error.stack });
      return AuthResult.failure({
        error: error.message || 'Registration failed',
        message: 'Failed to create account'
      });
    }
  }

  /**
   * Login with email/password
   * @param {object} params - Login parameters
   * @param {string} params.email - User email
   * @param {string} params.password - Plain text password
   * @returns {Promise<AuthResult>} Auth result
   */
  async login({ email, password }) {
    try {
      // Validate email
      const emailVO = new Email(email);

      // Find user
      const user = await this.userRepository.findByEmail(emailVO.getValue());
      if (!user) {
        return AuthResult.failure({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return AuthResult.failure({
          error: 'Account locked',
          message: 'Account is temporarily locked due to too many failed login attempts'
        });
      }

      // Verify password
      if (!user.getPasswordHash()) {
        return AuthResult.failure({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      const passwordMatch = await this.passwordService.comparePassword(
        password,
        user.getPasswordHash()
      );

      if (!passwordMatch) {
        // Increment login attempts
        const attempts = user.getLoginAttempts() + 1;
        const maxAttempts = 5;
        const lockDuration = 30 * 60 * 1000; // 30 minutes

        let lockedUntil = null;
        if (attempts >= maxAttempts) {
          lockedUntil = new Date(Date.now() + lockDuration);
        }

        await this.userRepository.updateLoginAttempts(
          user.getId(),
          attempts,
          lockedUntil
        );

        return AuthResult.failure({
          error: 'Invalid credentials',
          message: 'Email or password is incorrect'
        });
      }

      // Successful login - reset attempts and update last login
      const updatedUser = await this.userRepository.updateLastLogin(user.getId());
      
      // Create session
      const session = await this._createSession(updatedUser);

      logger.info('User logged in successfully', { userId: updatedUser.getId(), email: emailVO.getValue() });

      return AuthResult.success({
        user: updatedUser.toObject(),
        accessToken: session.getAccessToken(),
        refreshToken: session.getRefreshToken(),
        session: session.toObject(),
        message: 'Login successful'
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message, stack: error.stack });
      return AuthResult.failure({
        error: error.message || 'Login failed',
        message: 'Failed to authenticate'
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

  /**
   * Send verification email to user
   * @private
   */
  async _sendVerificationEmail(userId, email) {
    try {
      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create verification token record
      await this.emailVerificationRepository.create({
        userId,
        token,
        expiresAt,
        used: false
      });

      // Send verification email
      await this.emailService.sendVerificationEmail(email, token);
      
      logger.info('Verification email sent', { userId, email });
    } catch (error) {
      logger.error('Failed to send verification email', { 
        userId, 
        email, 
        error: error.message 
      });
      // Don't throw - registration should succeed even if email fails
      // User can request resend later
    }
  }
}

module.exports = EmailAuthStrategy;

