/**
 * Contact Service
 * 
 * Main business logic for contact management
 * Handles contact queries, validation, and operations
 * 
 * Best Practice: Service Layer - orchestrates domain components
 * Best Practice: Strict job scoping - enforces context boundaries
 */
const ContactRepository = require('../repositories/ContactRepository');
const ContactValidationService = require('./ContactValidationService');
const { ContactStats } = require('../value-objects/ContactStats');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

class ContactService {
  constructor({
    contactRepository = new ContactRepository(),
    validationService = new ContactValidationService()
  } = {}) {
    this.contactRepository = contactRepository;
    this.validationService = validationService;
    logger.info('ContactService initialized');
  }

  /**
   * Get paginated contacts with strict job scoping
   * 
   * STRICT: If jobId provided, ONLY returns contacts from that job
   * This ensures clean, scoped workflow per call sheet extraction
   * 
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @param {string} options.jobId - Job ID (enforces strict scoping)
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.search - Search term
   * @param {string} options.role - Role filter
   * @param {boolean} options.requireContact - Only contacts with email OR phone
   * @returns {Promise<object>} Paginated contacts with stats
   */
  async getContactsPaginated(userId, options = {}) {
    logger.debug(`Getting paginated contacts for user: ${userId}`, {
      jobId: options.jobId,
      page: options.page,
      limit: options.limit
    });

    // STRICT: Enforce job scoping if jobId provided
    const queryOptions = {
      ...options,
      // If jobId is provided and not 'all', enforce strict scoping
      jobId: options.jobId && options.jobId !== 'all' ? options.jobId : undefined
    };

    // Get contacts from repository
    const result = await this.contactRepository.findByUserId(userId, queryOptions);

    // Validate and clean contacts
    const { cleaned } = this.validationService.validateAndCleanContacts(result.contacts, {
      removeInvalid: true,
      deduplicate: true
    });

    // Sort by quality (most complete first)
    const sortedContacts = this.validationService.sortByQuality(cleaned);

    // Get job-scoped stats
    const stats = await this.getStats(userId, options.jobId);

    return {
      contacts: sortedContacts,
      pagination: result.pagination,
      stats
    };
  }

  /**
   * Get contact statistics
   * STRICT: If jobId provided, stats are scoped to that job only
   * 
   * @param {string} userId - User ID
   * @param {string} jobId - Optional job ID for scoped stats
   * @returns {Promise<ContactStats>} Statistics value object
   */
  async getStats(userId, jobId = null) {
    logger.debug(`Getting stats for user: ${userId}`, { jobId });

    if (jobId && jobId !== 'all') {
      // STRICT: Job-scoped stats
      return await this.getJobScopedStats(userId, jobId);
    }

    // User-wide stats
    return await this.getUserStats(userId);
  }

  /**
   * Get statistics scoped to a specific job
   * @private
   */
  async getJobScopedStats(userId, jobId) {
    logger.debug(`Getting job-scoped stats`, { userId, jobId });

    // Get contacts for this job only (repository handles user filtering)
    const jobContacts = await this.contactRepository.findByJobId(jobId, userId);

    // Validate and clean
    const { cleaned } = this.validationService.validateAndCleanContacts(userJobContacts, {
      removeInvalid: true,
      deduplicate: true
    });

    // Calculate stats
    const totalContacts = cleaned.length;
    const withEmail = cleaned.filter(c => c.email).length;
    const withPhone = cleaned.filter(c => c.phone).length;
    const recentContacts = cleaned.filter(c => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return c.createdAt && new Date(c.createdAt) >= thirtyDaysAgo;
    }).length;

    // Group by role
    const roleMap = new Map();
    cleaned.forEach(contact => {
      const role = contact.role || 'Unknown';
      roleMap.set(role, (roleMap.get(role) || 0) + 1);
    });
    const contactsByRole = Array.from(roleMap.entries()).map(([role, count]) => ({
      role,
      count
    }));

    return new ContactStats({
      totalContacts,
      withEmail,
      withPhone,
      totalJobs: 1, // Single job
      recentContacts,
      contactsByRole,
      contactsByProduction: [], // Not applicable for single job
      averageContactsPerJob: totalContacts,
      jobsWithContacts: 1,
      lastExtractionDate: cleaned.length > 0 
        ? cleaned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
        : null
    });
  }

  /**
   * Get user-wide statistics
   * @private
   */
  async getUserStats(userId) {
    logger.debug(`Getting user-wide stats`, { userId });

    const stats = await this.contactRepository.getStats(userId);

    // Get jobs with contacts (need to access Prisma model)
    const prisma = require('../../../config/database').getClient();
    const jobsWithContacts = await prisma.job.findMany({
      where: {
        userId,
        contacts: {
          some: {}
        }
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    const totalJobs = jobsWithContacts.length;
    const averageContactsPerJob = totalJobs > 0 
      ? Math.round((stats.totalContacts / totalJobs) * 100) / 100 
      : 0;

    const lastExtractionDate = jobsWithContacts.length > 0
      ? jobsWithContacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
      : null;

    return new ContactStats({
      totalContacts: stats.totalContacts,
      withEmail: stats.contactsWithEmail,
      withPhone: stats.contactsWithPhone,
      totalJobs,
      recentContacts: 0, // Would need date filtering
      contactsByRole: stats.contactsByRole,
      contactsByProduction: [],
      averageContactsPerJob,
      jobsWithContacts: totalJobs,
      lastExtractionDate
    });
  }

  /**
   * Get a single contact by ID
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Contact|null>} Contact entity or null
   */
  async getContactById(userId, contactId) {
    logger.debug(`Getting contact by ID: ${contactId}`, { userId });

    const contact = await this.contactRepository.findById(contactId);

    if (!contact || contact.userId !== userId) {
      return null;
    }

    // Clean and validate
    const cleaned = this.validationService.cleanContact(contact);
    return cleaned;
  }

  /**
   * Delete a contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<void>}
   */
  async deleteContact(userId, contactId) {
    logger.debug(`Deleting contact: ${contactId}`, { userId });

    const contact = await this.contactRepository.findById(contactId);

    if (!contact || contact.userId !== userId) {
      throw new Error('Contact not found');
    }

    await this.contactRepository.delete(contactId);
    logger.info(`Contact deleted: ${contactId}`, { userId });
  }

  /**
   * Get health status
   * @returns {object} Health status
   */
  getHealthStatus() {
    return {
      service: 'ContactService',
      status: 'healthy',
      repository: 'available',
      validation: 'available',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ContactService;

