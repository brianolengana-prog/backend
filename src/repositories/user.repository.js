const db = require('../config/database');

class UserRepository {
  async create(data) {
    try {
      await db.connect(); // Ensure connection is established
      return await db.getClient().user.create({ data });
    } catch (error) {
      console.error('Database error in create:', error);
      throw error;
    }
  }

  async findByEmail(email) {
    try {
      await db.connect(); // Ensure connection is established
      return await db.getClient().user.findUnique({ where: { email } });
    } catch (error) {
      console.error('Database error in findByEmail:', error);
      throw error;
    }
  }

  async findByProvider(provider, providerId) {
    try {
      await db.connect(); // Ensure connection is established
      return await db.getClient().user.findFirst({ where: { provider, providerId } });
    } catch (error) {
      console.error('Database error in findByProvider:', error);
      throw error;
    }
  }

  async findById(id) {
    return await db.getClient().user.findUnique({ where: { id } });
  }

  async update(id, data) {
    return await db.getClient().user.update({ where: { id }, data });
  }
}

module.exports = new UserRepository();


