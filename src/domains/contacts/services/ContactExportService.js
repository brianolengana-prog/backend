/**
 * Contact Export Service
 * 
 * Handles contact export in multiple formats
 * Ensures clean, validated data before export
 * 
 * Best Practice: Single Responsibility - export only
 * Best Practice: Data validation before export
 */
const ContactRepository = require('../repositories/ContactRepository');
const ContactValidationService = require('./ContactValidationService');
const ExportService = require('../../../services/export.service');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

class ContactExportService {
  constructor({
    contactRepository = new ContactRepository(),
    validationService = new ContactValidationService(),
    exportService = ExportService
  } = {}) {
    this.contactRepository = contactRepository;
    this.validationService = validationService;
    this.exportService = exportService;
    logger.info('ContactExportService initialized');
  }

  /**
   * Export contacts with strict job scoping
   * 
   * STRICT: If jobId provided, ONLY exports contacts from that job
   * Validates and cleans data before export
   * 
   * @param {string} userId - User ID
   * @param {object} options - Export options
   * @param {string} options.jobId - Job ID (enforces strict scoping)
   * @param {Array<string>} options.contactIds - Optional contact IDs to export
   * @param {string} options.format - Export format: 'csv', 'excel', 'json', 'vcard'
   * @param {object} options.exportOptions - Format-specific options
   * @returns {Promise<object>} { data, filename, mimeType }
   */
  async exportContacts(userId, options = {}) {
    const { jobId, contactIds, format = 'csv', exportOptions = {} } = options;

    logger.info(`Exporting contacts for user: ${userId}`, {
      jobId,
      format,
      contactCount: contactIds?.length || 'all'
    });

    // STRICT: Get contacts with job scoping
    const contacts = await this.getContactsForExport(userId, { jobId, contactIds });

    if (contacts.length === 0) {
      throw new Error('No contacts found to export');
    }

    logger.info(`Found ${contacts.length} contacts to export`);

    // Validate and clean before export
    const { cleaned } = this.validationService.validateAndCleanContacts(contacts, {
      removeInvalid: true,
      deduplicate: true
    });

    if (cleaned.length === 0) {
      throw new Error('No valid contacts to export after validation');
    }

    logger.info(`Exporting ${cleaned.length} cleaned contacts`);

    // Use existing export service for format generation
    return await this.exportService.exportContacts(cleaned, format, exportOptions);
  }

  /**
   * Get contacts for export with strict scoping
   * @private
   */
  async getContactsForExport(userId, { jobId, contactIds }) {
    // STRICT: If jobId provided, ONLY get contacts from that job
    if (jobId && jobId !== 'all') {
      const jobContacts = await this.contactRepository.findByJobId(jobId);
      
      // Security: Filter to user's contacts
      let userContacts = jobContacts.filter(c => c.userId === userId);
      
      // If specific contact IDs requested, filter further
      if (contactIds && contactIds.length > 0) {
        userContacts = userContacts.filter(c => contactIds.includes(c.id));
      }
      
      return userContacts;
    }

    // If specific contact IDs requested, get those
    if (contactIds && contactIds.length > 0) {
      const contacts = await Promise.all(
        contactIds.map(id => this.contactRepository.findById(id))
      );
      
      // Filter to user's contacts and remove nulls
      return contacts.filter(c => c && c.userId === userId);
    }

    // Get all user's contacts (no job scoping)
    const result = await this.contactRepository.findByUserId(userId, {
      page: 1,
      limit: 10000 // Large limit for export
    });
    
    return result.contacts;
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return {
      service: 'ContactExportService',
      status: 'healthy',
      repository: 'available',
      validation: 'available',
      exportFormats: ['csv', 'excel', 'json', 'vcard'],
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ContactExportService;

