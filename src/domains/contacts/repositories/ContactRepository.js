const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const databaseManager = require('../../../shared/infrastructure/database/database.manager');

/**
 * Contact Repository
 * Handles all data access for contacts
 * 
 * Example implementation of domain repository using BaseRepository
 */
class ContactRepository extends BaseRepository {
  constructor() {
    // Initialize with model name
    // Prisma client will be set via initializePrisma
    super('contact', null);
    this.initializePrisma();
  }

  /**
   * Initialize Prisma client from database manager
   * @private
   */
  async initializePrisma() {
    this.prisma = await databaseManager.getClient();
    this.model = this.prisma.contact;
  }

  /**
   * Find contacts by user ID with pagination
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Contacts and pagination info
   */
  async findByUserId(userId, options = {}) {
    await this.initializePrisma();
    
    const {
      page = 1,
      limit = 25,
      search = '',
      role = '',
      jobId = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      requireContact = true
    } = options;

    const where = {
      userId,
      ...(jobId && { jobId }),
      ...(role && { role: { contains: role, mode: 'insensitive' } }),
      ...(requireContact && {
        OR: [
          { email: { not: null } },
          { phone: { not: null } }
        ]
      })
    };

    // Add search filter
    if (search) {
      where.OR = [
        ...(where.OR || []),
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [contacts, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy
      }),
      this.model.count({ where })
    ]);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find contacts by job ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Array>} Array of contacts
   */
  async findByJobId(jobId) {
    await this.initializePrisma();
    return await this.model.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' }
    });
  }

  /**
   * Get contact statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Statistics object
   */
  async getStats(userId) {
    await this.initializePrisma();
    
    const [
      totalContacts,
      contactsByRole,
      contactsWithEmail,
      contactsWithPhone
    ] = await Promise.all([
      this.model.count({ where: { userId } }),
      this.model.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      }),
      this.model.count({
        where: { userId, email: { not: null } }
      }),
      this.model.count({
        where: { userId, phone: { not: null } }
      })
    ]);

    return {
      totalContacts,
      contactsByRole: contactsByRole.map(item => ({
        role: item.role || 'Unknown',
        count: item._count.role
      })),
      contactsWithEmail,
      contactsWithPhone
    };
  }

  /**
   * Delete contacts by job ID
   * @param {string} jobId - Job ID
   * @returns {Promise<object>} Delete result
   */
  async deleteByJobId(jobId) {
    await this.initializePrisma();
    return await this.model.deleteMany({
      where: { jobId }
    });
  }
}

module.exports = ContactRepository;

