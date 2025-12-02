/**
 * Email Verification Repository
 * 
 * Repository for email verification tokens
 * Follows Repository Pattern for data access abstraction
 */
const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const db = require('../../../config/database');

class EmailVerificationRepository extends BaseRepository {
  constructor() {
    super('emailVerificationToken', db.getClient());
  }

  /**
   * Create email verification token
   * @param {object} data - Token data
   * @param {string} data.userId - User ID
   * @param {string} data.token - Verification token
   * @param {Date} data.expiresAt - Expiration date
   * @returns {Promise<object>} Created token record
   */
  async create(data) {
    return await this.model.create({ data });
  }

  /**
   * Find verification token by token string
   * @param {string} token - Verification token
   * @returns {Promise<object|null>} Token record or null
   */
  async findByToken(token) {
    return await this.model.findUnique({ 
      where: { token },
      include: { user: true }
    });
  }

  /**
   * Mark token as used
   * @param {string} id - Token ID
   * @returns {Promise<object>} Updated token record
   */
  async markUsed(id) {
    return await this.model.update({
      where: { id },
      data: { used: true }
    });
  }

  /**
   * Delete expired tokens (cleanup)
   * @returns {Promise<number>} Number of deleted tokens
   */
  async deleteExpired() {
    const result = await this.model.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    return result.count;
  }
}

module.exports = EmailVerificationRepository;

