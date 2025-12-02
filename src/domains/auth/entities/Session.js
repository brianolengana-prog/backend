/**
 * Session Entity
 * 
 * Domain entity representing a user session
 * Immutable entity with business logic
 * 
 * Best Practice: Entity - has identity, immutable, contains business logic
 */
class Session {
  constructor({
    id,
    userId,
    accessToken,
    refreshToken,
    expiresAt,
    isActive = true,
    createdAt = null,
    updatedAt = null
  }) {
    if (!id) {
      throw new Error('Session requires an id');
    }

    if (!userId) {
      throw new Error('Session requires a userId');
    }

    if (!accessToken) {
      throw new Error('Session requires an accessToken');
    }

    if (!refreshToken) {
      throw new Error('Session requires a refreshToken');
    }

    if (!expiresAt) {
      throw new Error('Session requires an expiresAt date');
    }

    this._id = id;
    this._userId = userId;
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._expiresAt = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    this._isActive = isActive;
    this._createdAt = createdAt ? new Date(createdAt) : new Date();
    this._updatedAt = updatedAt ? new Date(updatedAt) : new Date();

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Get session ID
   * @returns {string} Session ID
   */
  getId() {
    return this._id;
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return this._userId;
  }

  /**
   * Get access token
   * @returns {string} Access token
   */
  getAccessToken() {
    return this._accessToken;
  }

  /**
   * Get refresh token
   * @returns {string} Refresh token
   */
  getRefreshToken() {
    return this._refreshToken;
  }

  /**
   * Get expiration date
   * @returns {Date} Expiration date
   */
  getExpiresAt() {
    return this._expiresAt;
  }

  /**
   * Check if session is active
   * @returns {boolean} True if active
   */
  isActive() {
    return this._isActive;
  }

  /**
   * Check if session is expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    return new Date() >= this._expiresAt;
  }

  /**
   * Check if session is valid (active and not expired)
   * @returns {boolean} True if valid
   */
  isValid() {
    return this._isActive && !this.isExpired();
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
   * Create new session with updated active status
   * @param {boolean} isActive - Active status
   * @returns {Session} New Session instance
   */
  withActiveStatus(isActive) {
    return new Session({
      id: this._id,
      userId: this._userId,
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt,
      isActive,
      createdAt: this._createdAt,
      updatedAt: new Date()
    });
  }

  /**
   * Create new session with updated expiration
   * @param {Date} expiresAt - New expiration date
   * @returns {Session} New Session instance
   */
  withExpiration(expiresAt) {
    return new Session({
      id: this._id,
      userId: this._userId,
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
      isActive: this._isActive,
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
      userId: this._userId,
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt.toISOString(),
      isActive: this._isActive,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString()
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
   * @param {object} prismaSession - Prisma Session model
   * @returns {Session} Session entity
   */
  static fromPrisma(prismaSession) {
    if (!prismaSession) {
      return null;
    }

    return new Session({
      id: prismaSession.id,
      userId: prismaSession.userId,
      accessToken: prismaSession.accessToken,
      refreshToken: prismaSession.refreshToken,
      expiresAt: prismaSession.expiresAt,
      isActive: prismaSession.isActive,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt
    });
  }

  /**
   * Convert to Prisma data format
   * @returns {object} Prisma data object
   */
  toPrismaData() {
    return {
      id: this._id,
      userId: this._userId,
      accessToken: this._accessToken,
      refreshToken: this._refreshToken,
      expiresAt: this._expiresAt,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
}

module.exports = Session;

