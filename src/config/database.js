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
    await this.client.$connect();
    this.connected = true;
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


