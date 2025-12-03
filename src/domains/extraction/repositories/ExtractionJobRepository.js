/**
 * Extraction Job Repository
 * 
 * Data access layer for extraction jobs
 * Extends BaseRepository for common operations
 * 
 * Best Practice: Repository Pattern - abstracts data access
 * Best Practice: Domain-specific queries in repository
 */
const BaseRepository = require('../../../shared/infrastructure/database/base.repository');
const db = require('../../../config/database');
const ExtractionJob = require('../entities/ExtractionJob');

class ExtractionJobRepository extends BaseRepository {
  constructor() {
    // Use lazy-loaded Prisma client from database config
    const prisma = db.getClient();
    super('job', prisma);
  }

  /**
   * Find job by ID and return as domain entity
   * @param {string} id - Job ID
   * @param {object} include - Prisma include object
   * @returns {Promise<ExtractionJob|null>} ExtractionJob entity or null
   */
  async findByIdAsEntity(id, include = null) {
    const job = await this.findById(id, include);
    return job ? ExtractionJob.fromPrisma(job) : null;
  }

  /**
   * Find jobs by user ID with pagination
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Jobs and pagination info
   */
  async findByUserId(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status = null,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const where = {
      userId,
      ...(status && { status })
    };

    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [jobs, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          contacts: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      }),
      this.model.count({ where })
    ]);

    // Convert to domain entities
    const jobEntities = jobs.map(job => ExtractionJob.fromPrisma(job));

    return {
      jobs: jobEntities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Find recent job by file hash (for deduplication)
   * @param {string} userId - User ID
   * @param {string} fileHash - File hash (SHA-256)
   * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
   * @returns {Promise<ExtractionJob|null>} Recent job or null
   */
  async findRecentByFileHash(userId, fileHash, maxAge = 24 * 60 * 60 * 1000) {
    const since = new Date(Date.now() - maxAge);
    
    const job = await this.model.findFirst({
      where: {
        userId,
        fileHash,
        status: 'COMPLETED',
        createdAt: {
          gte: since
        }
      },
      include: {
        contacts: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return job ? ExtractionJob.fromPrisma(job) : null;
  }

  /**
   * Create job and return as entity
   * @param {object} data - Job data
   * @returns {Promise<ExtractionJob>} Created job entity
   */
  async createAsEntity(data) {
    const job = await this.create(data);
    return ExtractionJob.fromPrisma(job);
  }

  /**
   * Update job status
   * @param {string} id - Job ID
   * @param {string} status - New status
   * @param {object} additionalData - Additional data to update
   * @returns {Promise<ExtractionJob>} Updated job entity
   */
  async updateStatus(id, status, additionalData = {}) {
    const job = await this.update(id, {
      status,
      ...additionalData
    });
    return ExtractionJob.fromPrisma(job);
  }

  /**
   * Mark job as completed
   * @param {string} id - Job ID
   * @param {number} contactCount - Number of contacts extracted
   * @returns {Promise<ExtractionJob>} Updated job entity
   */
  async markCompleted(id, contactCount = 0) {
    return await this.updateStatus(id, 'COMPLETED', {
      processedContacts: contactCount
    });
  }

  /**
   * Mark job as failed
   * @param {string} id - Job ID
   * @param {string} error - Error message
   * @returns {Promise<ExtractionJob>} Updated job entity
   */
  async markFailed(id, error = null) {
    return await this.updateStatus(id, 'FAILED', {
      processedContacts: error ? { error } : null
    });
  }

  /**
   * Get job statistics for user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<object>} Statistics object
   */
  async getStats(userId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalJobs,
      completedJobs,
      failedJobs,
      processingJobs,
      totalContacts
    ] = await Promise.all([
      this.model.count({
        where: {
          userId,
          createdAt: { gte: since }
        }
      }),
      this.model.count({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: { gte: since }
        }
      }),
      this.model.count({
        where: {
          userId,
          status: 'FAILED',
          createdAt: { gte: since }
        }
      }),
      this.model.count({
        where: {
          userId,
          status: 'PROCESSING',
          createdAt: { gte: since }
        }
      }),
      this.model.aggregate({
        where: {
          userId,
          createdAt: { gte: since }
        },
        _count: {
          contacts: true
        }
      })
    ]);

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      processingJobs,
      totalContacts: totalContacts._count.contacts || 0,
      successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      period: {
        days,
        start: since.toISOString(),
        end: new Date().toISOString()
      }
    };
  }
}

module.exports = ExtractionJobRepository;

