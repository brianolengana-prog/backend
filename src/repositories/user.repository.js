const db = require('../config/database');

class UserRepository {
  async create(data) {
    return await db.getClient().user.create({ data });
  }

  async findByEmail(email) {
    return await db.getClient().user.findUnique({ where: { email } });
  }

  async findByProvider(provider, providerId) {
    return await db.getClient().user.findFirst({ where: { provider, providerId } });
  }

  async findById(id) {
    return await db.getClient().user.findUnique({ where: { id } });
  }

  async update(id, data) {
    return await db.getClient().user.update({ where: { id }, data });
  }
}

module.exports = new UserRepository();


