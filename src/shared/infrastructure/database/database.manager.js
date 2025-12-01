const { PrismaClient } = require('@prisma/client');
const db = require('../../../config/database');

/**
 * Database Manager
 * Singleton Prisma client instance
 * 
 * Provides centralized database connection management
 */
class DatabaseManager {
  constructor() {
    this.prisma = null;
    this.isConnected = false;
  }

  /**
   * Get Prisma client instance
   * @returns {Promise<PrismaClient>}
   */
  async getClient() {
    if (!this.prisma) {
      // Use existing database connection if available
      if (db && db.getClient) {
        this.prisma = db.getClient();
      } else {
        this.prisma = new PrismaClient();
      }
    }

    if (!this.isConnected) {
      await this.connect();
    }

    return this.prisma;
  }

  /**
   * Connect to database
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (db && db.connect) {
        await db.connect();
      }
      this.isConnected = true;
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.prisma) {
        await this.prisma.$disconnect();
      }
      if (db && db.disconnect) {
        await db.disconnect();
      }
      this.isConnected = false;
    } catch (error) {
      console.error('Database disconnection error:', error);
    }
  }

  /**
   * Execute transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise<any>}
   */
  async transaction(callback) {
    const client = await this.getClient();
    return await client.$transaction(callback);
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Export singleton instance
module.exports = new DatabaseManager();

