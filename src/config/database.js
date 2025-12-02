const { PrismaClient } = require('@prisma/client');

class Database {
  constructor() {
    this.client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error'] : ['error']
    });
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    
    try {
      console.log('🔄 Attempting database connection...');
      await this.client.$connect();
      this.connected = true;
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('❌ Error details:', {
        name: error.name,
        code: error.code,
        meta: error.meta
      });
      throw error;
    }
  }

  async disconnect() {
    if (!this.connected) return;
    await this.client.$disconnect();
    this.connected = false;
  }

  getClient() {
    return this.client;
  }
}

module.exports = new Database();


