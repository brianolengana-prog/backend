const { PrismaClient } = require('@prisma/client');

class Database {
  constructor() {
    // Lazy initialization - don't create PrismaClient until needed
    this._client = null;
    this.connected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
  }

  /**
   * Get Prisma client instance (lazy initialization)
   * @returns {PrismaClient}
   */
  getClient() {
    if (!this._client) {
      this._client = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error'] 
          : ['error'],
        errorFormat: 'pretty',
      });
    }
    return this._client;
  }

  /**
   * Connect to database with timeout and retry logic
   * @param {number} timeoutMs - Connection timeout in milliseconds
   * @returns {Promise<void>}
   */
  async connect(timeoutMs = 10000) {
    if (this.connected) {
      console.log('Database already connected');
      return;
    }

    // Add timeout to prevent hanging
    const connectPromise = this._connectWithRetry();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Database connection timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      this.connected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed', {
        error: error.message,
        attempts: this.connectionAttempts,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Internal connection method with retry logic
   * @private
   */
  async _connectWithRetry() {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      this.connectionAttempts = attempt;
      
      try {
        console.log(`Attempting database connection (${attempt}/${this.maxRetries})...`);
        await this.getClient().$connect();
        console.log(`✅ Database connection successful on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`Database connection attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Database connection failed after all retries');
  }

  /**
   * Disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected || !this._client) return;
    
    try {
      await this.getClient().$disconnect();
      this.connected = false;
      this._client = null;
      console.log('✅ Database disconnected');
    } catch (error) {
      console.error('Error disconnecting from database', { error: error.message });
      throw error;
    }
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      await this.getClient().$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database connection test failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }
}

module.exports = new Database();


