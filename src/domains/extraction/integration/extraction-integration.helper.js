/**
 * Extraction Integration Helper
 * 
 * Helper to integrate new extraction domain with existing routes
 * Uses feature flags to switch between old and new architecture
 * 
 * Best Practice: Gradual migration with feature flags
 * Best Practice: Backward compatibility maintained
 */
const featureFlags = require('../../../shared/infrastructure/features/feature-flags.service');
const ExtractionServiceAdapter = require('../services/ExtractionServiceAdapter');
const logger = require('../../../shared/infrastructure/logger/logger.service');

class ExtractionIntegrationHelper {
  /**
   * Check if new architecture should be used
   * @param {string} userId - User ID for percentage-based rollout
   * @returns {boolean} True if new architecture should be used
   */
  shouldUseNewArchitecture(userId) {
    return featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId);
  }

  /**
   * Extract contacts using appropriate architecture
   * Automatically selects old or new based on feature flag
   * 
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {object} options - Extraction options
   * @param {string} userId - User ID
   * @returns {Promise<object>} Extraction result
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}, userId = null) {
    const useNew = userId ? this.shouldUseNewArchitecture(userId) : featureFlags.isEnabled('USE_NEW_EXTRACTION');

    if (useNew) {
      logger.info('Using new extraction architecture', {
        userId,
        fileName,
        extractionId: options.extractionId
      });

      try {
        return await ExtractionServiceAdapter.extractContacts(
          fileBuffer,
          mimeType,
          fileName,
          options
        );
      } catch (error) {
        logger.error('New architecture extraction failed, falling back to old', error, {
          userId,
          fileName
        });
        // Fall through to old architecture
      }
    }

    // Use old architecture (existing code)
    logger.info('Using legacy extraction architecture', {
      userId,
      fileName,
      extractionId: options.extractionId
    });

    // This will be handled by existing code in the route
    return null; // Signal to use old code
  }

  /**
   * Extract contacts from text using appropriate architecture
   * @param {string} text - Document text
   * @param {object} options - Extraction options
   * @param {string} userId - User ID
   * @returns {Promise<object>} Extraction result
   */
  async extractContactsFromText(text, options = {}, userId = null) {
    const useNew = userId ? this.shouldUseNewArchitecture(userId) : featureFlags.isEnabled('USE_NEW_EXTRACTION');

    if (useNew) {
      try {
        const result = await ExtractionServiceAdapter.extractContactsFromText(text, null, options);
        return {
          success: true,
          contacts: result,
          metadata: {
            extractionMethod: 'new-architecture',
            strategy: 'auto-selected'
          }
        };
      } catch (error) {
        logger.error('New architecture text extraction failed', error);
        // Fall through
      }
    }

    return null; // Signal to use old code
  }

  /**
   * Get integration status
   * @returns {object} Integration status
   */
  getStatus() {
    return {
      newArchitectureAvailable: true,
      featureFlagEnabled: featureFlags.isEnabled('USE_NEW_EXTRACTION'),
      featureFlagPercentage: featureFlags.getAllFlags().USE_NEW_EXTRACTION_PERCENTAGE || 0,
      adapterAvailable: true
    };
  }
}

module.exports = new ExtractionIntegrationHelper();

