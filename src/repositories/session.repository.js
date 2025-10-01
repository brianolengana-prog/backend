const db = require('../config/database');

class SessionRepository {
  async create(data) {
    return await db.getClient().session.create({ data });
  }

  async findByRefreshToken(refreshToken) {
    return await db.getClient().session.findUnique({ where: { refreshToken } });
  }

  async findActiveByUserId(userId) {
    return await db.getClient().session.findMany({ where: { userId, isActive: true } });
  }

  async deactivateById(id) {
    return await db.getClient().session.update({ where: { id }, data: { isActive: false } });
  }

  async deactivateByUserId(userId) {
    return await db.getClient().session.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
  }

  async rotate(sessionId, { accessToken, refreshToken, expiresAt }) {
    return await db.getClient().session.update({
      where: { id: sessionId },
      data: { accessToken, refreshToken, expiresAt, updatedAt: new Date() }
    });
  }
}

module.exports = new SessionRepository();


