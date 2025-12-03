const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const db = require('../../../config/database');
const { Contact } = require('../entities/Contact');
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

/**
 * Contact Repository
 * Handles all data access for contacts using the repository pattern
 * 
 * Best Practice: Repository abstracts data access from business logic
 */
class ContactRepository extends BaseRepository {
  constructor() {
    // Use lazy-loaded Prisma client from database config
    // Don't connect during construction - connection happens on first use
    const prisma = db.getClient();
    super(prisma.contact, prisma);
    logger.info('ContactRepository initialized');
  }

  /**
   * Converts Prisma Contact model to Contact entity
   * @param {object} prismaContact - Prisma Contact model
   * @returns {Contact|null}
   */
  _toEntity(prismaContact) {
    if (!prismaContact) return null;
    return Contact.fromPrisma(prismaContact);
  }

  /**
   * Converts Contact entity to Prisma data format
   * @param {Contact} entity - Contact entity
   * @returns {object}
   */
  _toPrismaData(entity) {
    return {
      userId: entity.userId,
      jobId: entity.jobId,
      name: entity.name,
      email: entity.email,
      phone: entity.phone,
      role: entity.role,
      company: entity.company,
      isSelected: entity.isSelected,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  /**
   * Find contacts by user ID with pagination and filtering
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Contacts (as entities) and pagination info
   */
  async findByUserId(userId, options = {}) {
    logger.debug(`Finding contacts for user: ${userId}`, options);
    
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

    // Build where clause
    const where = {
      userId,
      ...(jobId && jobId !== 'all' && { jobId }),
      ...(role && role !== 'all' && { role: { contains: role, mode: 'insensitive' } }),
      ...(requireContact === true || requireContact === 'true' ? {
        OR: [
          { email: { not: null, not: '', contains: '@' } },
          { phone: { not: null, not: '' } }
        ]
      } : {})
    };

    // Add search filter (combines with requireContact OR if present)
    if (search) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } }
      ];

      if (where.OR) {
        // Combine search with requireContact OR
        where.AND = [
          { OR: where.OR }, // requireContact condition
          { OR: searchConditions } // search condition
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Build orderBy
    const orderByField = sortBy === 'created_at' ? 'createdAt' : sortBy;
    const orderBy = { [orderByField]: sortOrder };

    // Execute queries in parallel
    const [contacts, total] = await Promise.all([
      this.model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              fileName: true,
              status: true,
              createdAt: true,
              productionId: true
            }
          }
        }
      }),
      this.model.count({ where })
    ]);

    // Convert to entities
    const contactEntities = contacts.map(c => this._toEntity(c));

    return {
      contacts: contactEntities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find contacts by job ID
   * @param {string} jobId - Job ID
   * @param {string} userId - Optional user ID for security filtering
   * @returns {Promise<Array>} Array of contacts (as entities)
   */
  async findByJobId(jobId, userId = null) {
    logger.debug(`Finding contacts by job ID: ${jobId}`, { userId });
    
    const where = { jobId };
    if (userId) {
      where.userId = userId; // Security: filter by user
    }
    
    const contacts = await this.model.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            fileName: true,
            status: true,
            createdAt: true
          }
        }
      }
    });
    return contacts.map(c => this._toEntity(c));
  }

  /**
   * Get contact statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<object>} Statistics object
   */
  async getStats(userId) {
    logger.debug(`Getting stats for user: ${userId}`);
    
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

