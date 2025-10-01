const db = require('../config/database');

class SubscriptionRepository {
  async create(data) {
    return await db.getClient().subscription.create({ data });
  }

  async findByUserId(userId) {
    return await db.getClient().subscription.findFirst({ where: { userId } });
  }

  async findByStripeCustomerId(stripeCustomerId) {
    return await db.getClient().subscription.findFirst({ where: { stripeCustomerId } });
  }

  async findByStripeSubscriptionId(stripeSubscriptionId) {
    return await db.getClient().subscription.findUnique({ where: { stripeSubscriptionId } });
  }

  async update(id, data) {
    return await db.getClient().subscription.update({ where: { id }, data });
  }

  async delete(id) {
    return await db.getClient().subscription.delete({ where: { id } });
  }
}

module.exports = new SubscriptionRepository();
