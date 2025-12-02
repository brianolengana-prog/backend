/**
 * User Entity
 * 
 * Domain entity representing a user
 * Immutable entity with business logic
 * 
 * Best Practice: Entity - has identity, immutable, contains business logic
 */
const Email = require('../value-objects/Email');

class User {
  constructor({
    id,
    email,
    name,
    passwordHash = null,
    provider = 'email',
    providerId = null,
    emailVerified = false,
    twoFactorEnabled = false,
    twoFactorSecret = null,
    loginAttempts = 0,
    lockedUntil = null,
    lastLoginAt = null,
    createdAt = null,
    updatedAt = null
  }) {
    if (!id) {
      throw new Error('User requires an id');
    }

    if (!email) {
      throw new Error('User requires an email');
    }

    if (!name) {
      throw new Error('User requires a name');
    }

    // Convert email to Email value object
    this._email = email instanceof Email ? email : new Email(email);
    
    this._id = id;
    this._name = name;
    this._passwordHash = passwordHash;
    this._provider = provider;
    this._providerId = providerId;
    this._emailVerified = emailVerified;
    this._twoFactorEnabled = twoFactorEnabled;
    this._twoFactorSecret = twoFactorSecret;
    this._loginAttempts = loginAttempts;
    this._lockedUntil = lockedUntil ? new Date(lockedUntil) : null;
    this._lastLoginAt = lastLoginAt ? new Date(lastLoginAt) : null;
    this._createdAt = createdAt ? new Date(createdAt) : new Date();
    this._updatedAt = updatedAt ? new Date(updatedAt) : new Date();

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getId() {
    return this._id;
  }

  /**
   * Get email (as Email value object)
   * @returns {Email} Email value object
   */
  getEmail() {
    return this._email;
  }

  /**
   * Get email string
   * @returns {string} Email address
   */
  getEmailString() {
    return this._email.getValue();
  }

  /**
   * Get name
   * @returns {string} User name
   */
  getName() {
    return this._name;
  }

  /**
   * Get password hash
   * @returns {string|null} Password hash
   */
  getPasswordHash() {
    return this._passwordHash;
  }

  /**
   * Get provider
   * @returns {string} Auth provider
   */
  getProvider() {
    return this._provider;
  }

  /**
   * Get provider ID
   * @returns {string|null} Provider ID
   */
  getProviderId() {
    return this._providerId;
  }

  /**
   * Check if email is verified
   * @returns {boolean} True if verified
   */
  isEmailVerified() {
    return this._emailVerified;
  }

  /**
   * Check if 2FA is enabled
   * @returns {boolean} True if enabled
   */
  isTwoFactorEnabled() {
    return this._twoFactorEnabled;
  }

  /**
   * Check if account is locked
   * @returns {boolean} True if locked
   */
  isLocked() {
    if (!this._lockedUntil) {
      return false;
    }
    return new Date() < this._lockedUntil;
  }

  /**
   * Get login attempts
   * @returns {number} Number of failed login attempts
   */
  getLoginAttempts() {
    return this._loginAttempts;
  }

  /**
   * Get last login date
   * @returns {Date|null} Last login date
   */
  getLastLoginAt() {
    return this._lastLoginAt;
  }

  /**
   * Get created date
   * @returns {Date} Created date
   */
  getCreatedAt() {
    return this._createdAt;
  }

  /**
   * Get updated date
   * @returns {Date} Updated date
   */
  getUpdatedAt() {
    return this._updatedAt;
  }

  /**
   * Create new user with updated email verification
   * @param {boolean} verified - Verification status
   * @returns {User} New User instance
   */
  withEmailVerified(verified) {
    return new User({
      id: this._id,
      email: this._email,
      name: this._name,
      passwordHash: this._passwordHash,
      provider: this._provider,
      providerId: this._providerId,
      emailVerified: verified,
      twoFactorEnabled: this._twoFactorEnabled,
      twoFactorSecret: this._twoFactorSecret,
      loginAttempts: this._loginAttempts,
      lockedUntil: this._lockedUntil,
      lastLoginAt: this._lastLoginAt,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Create new user with updated login attempts
   * @param {number} attempts - Login attempts
   * @param {Date|null} lockedUntil - Lock expiration date
   * @returns {User} New User instance
   */
  withLoginAttempts(attempts, lockedUntil = null) {
    return new User({
      id: this._id,
      email: this._email,
      name: this._name,
      passwordHash: this._passwordHash,
      provider: this._provider,
      providerId: this._providerId,
      emailVerified: this._emailVerified,
      twoFactorEnabled: this._twoFactorEnabled,
      twoFactorSecret: this._twoFactorSecret,
      loginAttempts: attempts,
      lockedUntil,
      lastLoginAt: this._lastLoginAt,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Create new user with updated last login
   * @param {Date} lastLoginAt - Last login date
   * @returns {User} New User instance
   */
  withLastLoginAt(lastLoginAt) {
    return new User({
      id: this._id,
      email: this._email,
      name: this._name,
      passwordHash: this._passwordHash,
      provider: this._provider,
      providerId: this._providerId,
      emailVerified: this._emailVerified,
      twoFactorEnabled: this._twoFactorEnabled,
      twoFactorSecret: this._twoFactorSecret,
      loginAttempts: 0, // Reset on successful login
      lockedUntil: null, // Clear lock on successful login
      lastLoginAt,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Convert to plain object (for API responses)
   * @returns {object} Plain object representation
   */
  toObject() {
    return {
      id: this._id,
      email: this._email.getValue(),
      name: this._name,
      provider: this._provider,
      emailVerified: this._emailVerified,
      twoFactorEnabled: this._twoFactorEnabled,
      lastLoginAt: this._lastLoginAt?.toISOString() || null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
      // Never expose passwordHash, providerId, twoFactorSecret
    };
  }

  /**
   * Convert to JSON
   * @returns {object} JSON representation
   */
  toJSON() {
    return this.toObject();
  }

  /**
   * Create from Prisma model
   * @param {object} prismaUser - Prisma User model
   * @returns {User} User entity
   */
  static fromPrisma(prismaUser) {
    if (!prismaUser) {
      return null;
    }

    return new User({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
      passwordHash: prismaUser.passwordHash,
      provider: prismaUser.provider,
      providerId: prismaUser.providerId,
      emailVerified: prismaUser.emailVerified,
      twoFactorEnabled: prismaUser.twoFactorEnabled,
      twoFactorSecret: prismaUser.twoFactorSecret,
      loginAttempts: prismaUser.loginAttempts,
      lockedUntil: prismaUser.lockedUntil,
      lastLoginAt: prismaUser.lastLoginAt,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt
    });
  }

  /**
   * Convert to Prisma data format
   * @returns {object} Prisma data object
   */
  toPrismaData() {
    return {
      id: this._id,
      email: this._email.getValue(),
      name: this._name,
      passwordHash: this._passwordHash,
      provider: this._provider,
      providerId: this._providerId,
      emailVerified: this._emailVerified,
      twoFactorEnabled: this._twoFactorEnabled,
      twoFactorSecret: this._twoFactorSecret,
      loginAttempts: this._loginAttempts,
      lockedUntil: this._lockedUntil,
      lastLoginAt: this._lastLoginAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

module.exports = User;

