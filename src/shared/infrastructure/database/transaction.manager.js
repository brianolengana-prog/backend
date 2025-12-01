const databaseManager = require('./database.manager');

/**
 * Transaction Manager
 * Handles database transactions with retry logic
 */
class TransactionManager {
  /**
   * Execute callback within transaction
   * @param {Function} callback - Transaction callback that receives tx client
   * @returns {Promise<any>}
   */
  async execute(callback) {
    const prisma = await databaseManager.getClient();
    return await prisma.$transaction(async (tx) => {
      return await callback(tx);
    });
  }

  /**
   * Execute with retry logic for transaction conflicts
   * @param {Function} callback - Transaction callback
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<any>}
   */
  async executeWithRetry(callback, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.execute(callback);
      } catch (error) {
        lastError = error;
        // Only retry on transaction errors (P2034 = serialization failure)
        if (error.code === 'P2034') {
          // Transaction conflict, wait and retry
          const delay = 100 * (i + 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Execute multiple operations in a single transaction
   * @param {Array<Function>} operations - Array of operation callbacks
   * @returns {Promise<Array>}
   */
  async executeBatch(operations) {
    return await this.execute(async (tx) => {
      const results = [];
      for (const operation of operations) {
        const result = await operation(tx);
        results.push(result);
      }
      return results;
    });
  }
}

module.exports = new TransactionManager();

