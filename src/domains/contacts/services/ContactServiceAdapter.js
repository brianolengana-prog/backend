/**
 * Contact Service Adapter
 * 
 * Adapter to integrate new ContactService with existing routes
 * Provides backward-compatible interface
 * 
 * Best Practice: Adapter Pattern for integration
 * Best Practice: Maintains backward compatibility
 */
const ContactService = require('./ContactService');
const ContactExportService = require('./ContactExportService');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

class ContactServiceAdapter {
  constructor({
    contactService = new ContactService(),
    exportService = new ContactExportService()
  } = {}) {
    this.contactService = contactService;
    this.exportService = exportService;
    logger.info('ContactServiceAdapter initialized');
  }

  /**
   * Get contact statistics (backward compatible)
   * @param {string} userId - User ID
   * @returns {Promise<object>} Statistics
   */
  async getContactStats(userId) {
    const stats = await this.contactService.getStats(userId);
    return stats.toObject();
  }

  /**
   * Get paginated contacts (backward compatible)
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Paginated contacts
   */
  async getContactsPaginated(userId, options = {}) {
    const result = await this.contactService.getContactsPaginated(userId, options);
    
    // Convert entities to plain objects for API response
    return {
      contacts: result.contacts.map(c => c.toObject ? c.toObject() : c),
      pagination: result.pagination,
      stats: result.stats.toObject()
    };
  }

  /**
   * Get contact by ID (backward compatible)
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<object|null>} Contact
   */
  async getContactById(userId, contactId) {
    const contact = await this.contactService.getContactById(userId, contactId);
    return contact ? (contact.toObject ? contact.toObject() : contact) : null;
  }

  /**
   * Delete contact (backward compatible)
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<void>}
   */
  async deleteContact(userId, contactId) {
    await this.contactService.deleteContact(userId, contactId);
  }

  /**
   * Export contacts (backward compatible)
   * @param {string} userId - User ID
   * @param {Array<string>} contactIds - Contact IDs
   * @param {string} format - Export format
   * @param {string} jobId - Job ID
   * @param {object} options - Export options
   * @returns {Promise<object>} Export result
   */
  async exportContacts(userId, contactIds, format, jobId, options) {
    return await this.exportService.exportContacts(userId, {
      jobId,
      contactIds,
      format,
      exportOptions: options
    });
  }

  /**
   * Normalize contact (backward compatible helper)
   * @param {object} contact - Contact object
   * @returns {object} Normalized contact
   */
  normalizeContact(contact) {
    // Use validation service to clean
    const validationService = this.contactService.validationService;
    const cleaned = validationService.cleanContact(contact);
    return cleaned || contact;
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return {
      service: 'ContactServiceAdapter',
      status: 'healthy',
      contactService: this.contactService.getHealthStatus(),
      exportService: this.exportService.getHealthStatus(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ContactServiceAdapter;

