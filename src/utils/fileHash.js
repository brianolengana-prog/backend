/**
 * File Hash Utility
 * 
 * Provides SHA-256 hashing for file deduplication
 * Used to identify duplicate uploads and serve cached results
 */

const crypto = require('crypto');

/**
 * Calculate SHA-256 hash of a file buffer
 * 
 * @param {Buffer} buffer - File buffer
 * @returns {string} - Hex-encoded SHA-256 hash (64 characters)
 */
function calculateFileHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid buffer provided to calculateFileHash');
  }

  return crypto
    .createHash('sha256')
    .update(buffer)
    .digest('hex');
}

/**
 * Calculate SHA-256 hash of a string
 * 
 * @param {string} text - Text content
 * @returns {string} - Hex-encoded SHA-256 hash (64 characters)
 */
function calculateTextHash(text) {
  if (typeof text !== 'string') {
    throw new Error('Invalid text provided to calculateTextHash');
  }

  return crypto
    .createHash('sha256')
    .update(text, 'utf8')
    .digest('hex');
}

/**
 * Verify if a hash matches a buffer
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} hash - Expected hash
 * @returns {boolean} - True if hash matches
 */
function verifyFileHash(buffer, hash) {
  const calculated = calculateFileHash(buffer);
  return calculated === hash;
}

module.exports = {
  calculateFileHash,
  calculateTextHash,
  verifyFileHash
};

