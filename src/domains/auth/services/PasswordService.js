/**
 * Password Service
 * 
 * Service for password operations (hashing, validation, comparison)
 * 
 * Best Practice: Service Layer - encapsulates password business logic
 */
const Password = require('../value-objects/Password');

class PasswordService {
  /**
   * Hash a plain text password
   * @param {string} plainPassword - Plain text password
   * @param {number} saltRounds - Bcrypt salt rounds (default: 12)
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(plainPassword, saltRounds = 12) {
    const password = Password.fromPlainText(plainPassword);
    const hashed = await password.hash(saltRounds);
    return hashed.getHash();
  }

  /**
   * Compare plain password with hash
   * @param {string} plainPassword - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} True if passwords match
   */
  async comparePassword(plainPassword, hash) {
    const hashedPassword = Password.fromHash(hash);
    return await hashedPassword.compare(plainPassword);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {object} Validation result with isValid and errors
   */
  validatePasswordStrength(password) {
    return Password.validateStrength(password);
  }

  /**
   * Create Password value object from plain text
   * @param {string} plainPassword - Plain text password
   * @returns {Password} Password value object
   */
  createPassword(plainPassword) {
    return Password.fromPlainText(plainPassword);
  }

  /**
   * Create Password value object from hash
   * @param {string} hash - Hashed password
   * @returns {Password} Password value object
   */
  createPasswordFromHash(hash) {
    return Password.fromHash(hash);
  }
}

module.exports = new PasswordService();

