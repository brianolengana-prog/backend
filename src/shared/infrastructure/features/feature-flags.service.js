/**
 * Feature Flag Service
 * Controls gradual rollout of new architecture
 * 
 * Allows safe deployment with instant rollback capability
 */
class FeatureFlagsService {
  constructor() {
    this.flags = {
      // Extraction domain
      USE_NEW_EXTRACTION: process.env.USE_NEW_EXTRACTION === 'true',
      USE_NEW_EXTRACTION_PERCENTAGE: parseInt(process.env.USE_NEW_EXTRACTION_PERCENTAGE || '0', 10),
      
      // Contacts domain
      USE_NEW_CONTACTS: process.env.USE_NEW_CONTACTS === 'true',
      USE_NEW_CONTACTS_PERCENTAGE: parseInt(process.env.USE_NEW_CONTACTS_PERCENTAGE || '0', 10),
      
      // Auth domain
      USE_NEW_AUTH: process.env.USE_NEW_AUTH === 'true',
      USE_NEW_AUTH_PERCENTAGE: parseInt(process.env.USE_NEW_AUTH_PERCENTAGE || '0', 10),
      
      // Billing domain
      USE_NEW_BILLING: process.env.USE_NEW_BILLING === 'true',
      USE_NEW_BILLING_PERCENTAGE: parseInt(process.env.USE_NEW_BILLING_PERCENTAGE || '0', 10),
      
      // API layer
      USE_NEW_API_LAYER: process.env.USE_NEW_API_LAYER === 'true',
      USE_NEW_API_LAYER_PERCENTAGE: parseInt(process.env.USE_NEW_API_LAYER_PERCENTAGE || '0', 10),
    };
  }

  /**
   * Check if feature is enabled
   * @param {string} featureName - Feature flag name
   * @returns {boolean}
   */
  isEnabled(featureName) {
    return this.flags[featureName] === true;
  }

  /**
   * Check if feature is enabled for user (percentage-based rollout)
   * @param {string} featureName - Feature flag name
   * @param {string} userId - User ID for consistent assignment
   * @returns {boolean}
   */
  isEnabledForUser(featureName, userId) {
    const flag = this.flags[featureName];
    if (!flag) return false;

    const percentageFlag = `${featureName}_PERCENTAGE`;
    const percentage = this.flags[percentageFlag] || 0;
    
    if (percentage === 0) return false;
    if (percentage >= 100) return true;

    // Hash user ID to get consistent assignment
    const hash = this.hashUserId(userId);
    const userPercentage = (hash % 100) + 1;
    
    return userPercentage <= percentage;
  }

  /**
   * Hash user ID for consistent percentage assignment
   * @param {string} userId - User ID
   * @returns {number} Hash value (0-99)
   */
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all flags (for debugging)
   * @returns {object} All feature flags
   */
  getAllFlags() {
    return { ...this.flags };
  }

  /**
   * Reload flags from environment (for runtime updates)
   */
  reload() {
    this.constructor.call(this);
  }
}

module.exports = new FeatureFlagsService();

