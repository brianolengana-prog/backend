/**
 * Auth Result Value Object
 * 
 * Immutable value object representing the result of an authentication operation
 * Encapsulates success/failure state, user, tokens, and error information
 * 
 * Best Practice: Value Object - immutable, encapsulates operation result
 */
class AuthResult {
  constructor({
    success,
    user = null,
    accessToken = null,
    refreshToken = null,
    session = null,
    error = null,
    message = null
  }) {
    if (typeof success !== 'boolean') {
      throw new Error('AuthResult requires a boolean success value');
    }

    if (success && !user) {
      throw new Error('Successful auth result requires a user');
    }

    if (!success && !error) {
      throw new Error('Failed auth result requires an error');
    }

    this._success = success;
    this._user = user;
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this._session = session;
    this._error = error;
    this._message = message;

    // Freeze to ensure immutability
    Object.freeze(this);
  }

  /**
   * Check if result is successful
   * @returns {boolean} True if successful
   */
  isSuccess() {
    return this._success;
  }

  /**
   * Check if result is failure
   * @returns {boolean} True if failed
   */
  isFailure() {
    return !this._success;
  }

  /**
   * Get user (if successful)
   * @returns {object|null} User object
   */
  getUser() {
    return this._user;
  }

  /**
   * Get access token (if successful)
   * @returns {string|null} Access token
   */
  getAccessToken() {
    return this._accessToken;
  }

  /**
   * Get refresh token (if successful)
   * @returns {string|null} Refresh token
   */
  getRefreshToken() {
    return this._refreshToken;
  }

  /**
   * Get session (if successful)
   * @returns {object|null} Session object
   */
  getSession() {
    return this._session;
  }

  /**
   * Get error (if failed)
   * @returns {string|null} Error message
   */
  getError() {
    return this._error;
  }

  /**
   * Get message
   * @returns {string|null} Message
   */
  getMessage() {
    return this._message;
  }

  /**
   * Convert to plain object (for API responses)
   * @returns {object} Plain object representation
   */
  toObject() {
    if (this._success) {
      return {
        success: true,
        user: this._user,
        token: this._accessToken,
        refreshToken: this._refreshToken,
        session: this._session,
        message: this._message
      };
    } else {
      return {
        success: false,
        error: this._error,
        message: this._message
      };
    }
  }

  /**
   * Convert to JSON
   * @returns {object} JSON representation
   */
  toJSON() {
    return this.toObject();
  }

  /**
   * Create success result
   * @param {object} params - Success parameters
   * @param {object} params.user - User object
   * @param {string} params.accessToken - Access token
   * @param {string} params.refreshToken - Refresh token
   * @param {object} params.session - Session object
   * @param {string} params.message - Optional message
   * @returns {AuthResult} Success AuthResult
   */
  static success({ user, accessToken, refreshToken, session, message = null }) {
    return new AuthResult({
      success: true,
      user,
      accessToken,
      refreshToken,
      session,
      message
    });
  }

  /**
   * Create failure result
   * @param {object} params - Failure parameters
   * @param {string} params.error - Error message
   * @param {string} params.message - Optional message
   * @returns {AuthResult} Failure AuthResult
   */
  static failure({ error, message = null }) {
    return new AuthResult({
      success: false,
      error,
      message
    });
  }
}

module.exports = AuthResult;

