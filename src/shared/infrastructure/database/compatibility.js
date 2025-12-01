/**
 * Compatibility Layer
 * Allows gradual migration without breaking existing code
 * 
 * This provides backward compatibility for existing code that uses
 * direct Prisma imports or the old database config
 */

const databaseManager = require('./database.manager');

// Export Prisma client for backward compatibility
module.exports = {
  /**
   * Get Prisma client (backward compatible)
   */
  async getClient() {
    return await databaseManager.getClient();
  },
  
  /**
   * Connect to database (backward compatible)
   */
  async connect() {
    return await databaseManager.connect();
  },
  
  /**
   * Disconnect from database (backward compatible)
   */
  async disconnect() {
    return await databaseManager.disconnect();
  },
  
  /**
   * Execute transaction (backward compatible)
   */
  async transaction(callback) {
    return await databaseManager.transaction(callback);
  }
};

