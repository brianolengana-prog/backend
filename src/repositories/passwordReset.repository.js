const db = require('../config/database');

class PasswordResetRepository {
  async create(data) {
    return await db.getClient().passwordResetToken.create({ data });
  }

  async findByToken(token) {
    return await db.getClient().passwordResetToken.findUnique({ where: { token } });
  }

  async markUsed(id) {
    return await db.getClient().passwordResetToken.update({ where: { id }, data: { used: true } });
  }
}

module.exports = new PasswordResetRepository();


