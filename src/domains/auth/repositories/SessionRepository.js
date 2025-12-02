/**
 * Session Repository
 * 
 * Data access layer for Session entities
 * Extends BaseRepository for common operations
 * 
 * Best Practice: Repository Pattern - abstracts data access from business logic
 */
const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const db = require('../../../config/database');
const Session = require('../entities/Session');

class SessionRepository extends BaseRepository {
  constructor() {
    // Use lazy-loaded Prisma client from database config
    const prisma = db.getClient();
    super('session', prisma); // Pass model name as string, not model object
  }

  /**
   * Converts Prisma Session model to Session entity
   * @param {object} prismaSession - Prisma Session model
   * @returns {Session|null} Session entity or null
   */
  _toEntity(prismaSession) {
    if (!prismaSession) return null;
    return Session.fromPrisma(prismaSession);
  }

  /**
   * Converts Session entity to Prisma data format
   * @param {Session} session - Session entity
   * @returns {object} Prisma data object
   */
  _toPrismaData(session) {
    if (!session) return null;
    if (session instanceof Session) {
      // Convert Session entity to Prisma data format
      return {
        userId: session.userId,
        accessToken: session.accessToken.getValue(),
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        isActive: session.isActive,
      };
    }
    return session;
  }

  /**
   * Find session by access token
   * @param {string} accessToken - Access token
   * @returns {Promise<Session|null>} Session entity or null
   */
  async findByAccessToken(accessToken) {
    const session = await this.model.findFirst({
      where: { accessToken }
    });
    return this._toEntity(session);
  }

  /**
   * Find session by refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Session|null>} Session entity or null
   */
  async findByRefreshToken(refreshToken) {
    const session = await this.model.findFirst({
      where: { refreshToken }
    });
    return this._toEntity(session);
  }

  /**
   * Find active sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<Session[]>} Array of Session entities
   */
  async findActiveByUserId(userId) {
    const sessions = await this.model.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: {
          gt: new Date() // Not expired
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    return sessions.map(s => this._toEntity(s));
  }

  /**
   * Create new session
   * @param {object} data - Session data
   * @returns {Promise<Session>} Created Session entity
   */
  async create(data) {
    const session = await this.model.create({
      data: this._toPrismaData(data)
    });
    return this._toEntity(session);
  }

  /**
   * Update session
   * @param {string} id - Session ID
   * @param {object} data - Update data
   * @returns {Promise<Session>} Updated Session entity
   */
  async update(id, data) {
    const session = await this.model.update({
      where: { id },
      data: this._toPrismaData(data)
    });
    return this._toEntity(session);
  }

  /**
   * Deactivate session
   * @param {string} id - Session ID
   * @returns {Promise<Session>} Updated Session entity
   */
  async deactivate(id) {
    return await this.update(id, { isActive: false });
  }

  /**
   * Deactivate all sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of sessions deactivated
   */
  async deactivateAllByUserId(userId) {
    const result = await this.model.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });
    return result.count;
  }

  /**
   * Delete expired sessions
   * @param {Date} before - Delete sessions expired before this date
   * @returns {Promise<number>} Number of sessions deleted
   */
  async deleteExpired(before = new Date()) {
    const result = await this.model.deleteMany({
      where: {
        expiresAt: {
          lt: before
        }
      }
    });
    return result.count;
  }

  /**
   * Find session by ID
   * @param {string} id - Session ID
   * @returns {Promise<Session|null>} Session entity or null
   */
  async findById(id) {
    const session = await super.findById(id);
    return this._toEntity(session);
  }
}

module.exports = SessionRepository;

