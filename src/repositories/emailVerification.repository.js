const db = require('../config/database');

class EmailVerificationRepository {
  async create(data) {
    return await db.getClient().emailVerificationToken.create({ data });
  }

  async findByToken(token) {
    return await db.getClient().emailVerificationToken.findUnique({ where: { token } });
  }

  async markUsed(id) {
    return await db.getClient().emailVerificationToken.update({ where: { id }, data: { used: true } });
  }
}

module.exports = new EmailVerificationRepository();


