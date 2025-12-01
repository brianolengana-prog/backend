const { PrismaClient } = require('@prisma/client');

/**
 * Base Repository
 * Provides common CRUD operations for all repositories
 * 
 * All domain repositories should extend this class
 */
class BaseRepository {
  constructor(modelName, prisma = null) {
    if (!prisma) {
      this.prisma = new PrismaClient();
    } else {
      this.prisma = prisma;
    }
    this.modelName = modelName;
    this.model = this.prisma[modelName];
  }

  /**
   * Find by ID
   * @param {string} id - Record ID
   * @param {object} include - Prisma include object
   * @returns {Promise<object|null>}
   */
  async findById(id, include = null) {
    const options = { where: { id } };
    if (include) {
      options.include = include;
    }
    return await this.model.findUnique(options);
  }

  /**
   * Find many with optional filters
   * @param {object} where - Prisma where clause
   * @param {object} options - Additional options (skip, take, orderBy, include)
   * @returns {Promise<Array>}
   */
  async findMany(where = {}, options = {}) {
    const query = {
      where,
      ...options
    };
    return await this.model.findMany(query);
  }

  /**
   * Find first matching record
   * @param {object} where - Prisma where clause
   * @param {object} options - Additional options
   * @returns {Promise<object|null>}
   */
  async findFirst(where = {}, options = {}) {
    const query = {
      where,
      ...options
    };
    return await this.model.findFirst(query);
  }

  /**
   * Create new record
   * @param {object} data - Record data
   * @param {object} include - Prisma include object
   * @returns {Promise<object>}
   */
  async create(data, include = null) {
    const options = { data };
    if (include) {
      options.include = include;
    }
    return await this.model.create(options);
  }

  /**
   * Update record
   * @param {string} id - Record ID
   * @param {object} data - Update data
   * @param {object} include - Prisma include object
   * @returns {Promise<object>}
   */
  async update(id, data, include = null) {
    const options = {
      where: { id },
      data
    };
    if (include) {
      options.include = include;
    }
    return await this.model.update(options);
  }

  /**
   * Delete record
   * @param {string} id - Record ID
   * @returns {Promise<object>}
   */
  async delete(id) {
    return await this.model.delete({ where: { id } });
  }

  /**
   * Count records
   * @param {object} where - Prisma where clause
   * @returns {Promise<number>}
   */
  async count(where = {}) {
    return await this.model.count({ where });
  }

  /**
   * Upsert record
   * @param {object} where - Where clause for finding existing record
   * @param {object} create - Data to create if not exists
   * @param {object} update - Data to update if exists
   * @param {object} include - Prisma include object
   * @returns {Promise<object>}
   */
  async upsert(where, create, update, include = null) {
    const options = {
      where,
      create,
      update
    };
    if (include) {
      options.include = include;
    }
    return await this.model.upsert(options);
  }

  /**
   * Get Prisma client (for complex queries)
   * @returns {PrismaClient}
   */
  getPrisma() {
    return this.prisma;
  }

  /**
   * Get model (for direct access if needed)
   * @returns {object}
   */
  getModel() {
    return this.model;
  }
}

module.exports = BaseRepository;

