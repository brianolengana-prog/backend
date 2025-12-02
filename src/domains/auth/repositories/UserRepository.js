/**
 * User Repository
 * 
 * Data access layer for User entities
 * Extends BaseRepository for common operations
 * 
 * Best Practice: Repository Pattern - abstracts data access from business logic
 */
const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const db = require('../../../config/database');
const User = require('../entities/User');

class UserRepository extends BaseRepository {
  constructor() {
    // Use lazy-loaded Prisma client from database config
    const prisma = db.getClient();
    super('user', prisma); // Pass model name as string, not model object
  }

  /**
   * Converts Prisma User model to User entity
   * @param {object} prismaUser - Prisma User model
   * @returns {User|null} User entity or null
   */
  _toEntity(prismaUser) {
    if (!prismaUser) return null;
    return User.fromPrisma(prismaUser);
  }

  /**
   * Converts User entity to Prisma data format
   * @param {User} user - User entity
   * @returns {object} Prisma data object
   */
  _toPrismaData(user) {
    if (!user) return null;
    if (user instanceof User) {
      // Convert User entity to Prisma data format
      return {
        email: user.email.getValue(),
        name: user.name,
        passwordHash: user.passwordHash ? user.passwordHash.getValue() : null,
        provider: user.provider,
        providerId: user.providerId,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorSecret: user.twoFactorSecret,
        loginAttempts: user.loginAttempts,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
      };
    }
    return user;
  }

  /**
   * Find user by email
   * @param {string} email - Email address
   * @returns {Promise<User|null>} User entity or null
   */
  async findByEmail(email) {
    const user = await this.model.findUnique({
      where: { email: email.toLowerCase() }
    });
    return this._toEntity(user);
  }

  /**
   * Find user by provider and provider ID
   * @param {string} provider - Auth provider (e.g., 'google')
   * @param {string} providerId - Provider user ID
   * @returns {Promise<User|null>} User entity or null
   */
  async findByProvider(provider, providerId) {
    const user = await this.model.findFirst({
      where: {
        provider,
        providerId
      }
    });
    return this._toEntity(user);
  }

  /**
   * Find user by ID
   * @param {string} id - User ID
   * @returns {Promise<User|null>} User entity or null
   */
  async findById(id) {
    const user = await super.findById(id);
    return this._toEntity(user);
  }

  /**
   * Create new user
   * @param {object} data - User data
   * @returns {Promise<User>} Created User entity
   */
  async create(data) {
    // Ensure email is lowercase
    const userData = {
      ...data,
      email: data.email?.toLowerCase()
    };
    
    const user = await this.model.create({
      data: this._toPrismaData(userData)
    });
    return this._toEntity(user);
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} data - Update data
   * @returns {Promise<User>} Updated User entity
   */
  async update(id, data) {
    // Ensure email is lowercase if provided
    const updateData = { ...data };
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    const user = await this.model.update({
      where: { id },
      data: this._toPrismaData(updateData)
    });
    return this._toEntity(user);
  }

  /**
   * Update user email verification status
   * @param {string} id - User ID
   * @param {boolean} verified - Verification status
   * @returns {Promise<User>} Updated User entity
   */
  async updateEmailVerification(id, verified) {
    return await this.update(id, { emailVerified: verified });
  }

  /**
   * Update user login attempts and lock status
   * @param {string} id - User ID
   * @param {number} attempts - Login attempts
   * @param {Date|null} lockedUntil - Lock expiration date
   * @returns {Promise<User>} Updated User entity
   */
  async updateLoginAttempts(id, attempts, lockedUntil = null) {
    return await this.update(id, {
      loginAttempts: attempts,
      lockedUntil
    });
  }

  /**
   * Update user last login
   * @param {string} id - User ID
   * @param {Date} lastLoginAt - Last login date
   * @returns {Promise<User>} Updated User entity
   */
  async updateLastLogin(id, lastLoginAt = new Date()) {
    return await this.update(id, {
      lastLoginAt,
      loginAttempts: 0, // Reset on successful login
      lockedUntil: null // Clear lock on successful login
    });
  }

  /**
   * Check if email exists
   * @param {string} email - Email address
   * @returns {Promise<boolean>} True if email exists
   */
  async emailExists(email) {
    const user = await this.findByEmail(email);
    return user !== null;
  }
}

module.exports = UserRepository;

