const Stripe = require('stripe');
const subscriptionRepository = require('../repositories/subscription.repository');

class BillingService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async createCheckoutSession(userId, priceId) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
      metadata: { userId }
    });
    return session;
  }

  async createCustomerPortalSession(customerId) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`
    });
    return session;
  }

  async getCustomer(customerId) {
    return await this.stripe.customers.retrieve(customerId);
  }

  async getSubscription(subscriptionId) {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId) {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  async updateSubscription(subscriptionId, priceId) {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return await this.stripe.subscriptions.update(subscriptionId, {
      items: [{ id: subscription.items.data[0].id, price: priceId }],
      proration_behavior: 'create_prorations'
    });
  }

  async getBillingHistory(customerId) {
    const invoices = await this.stripe.invoices.list({ customer: customerId, limit: 100 });
    return invoices.data;
  }

  async getPaymentMethods(customerId) {
    const paymentMethods = await this.stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    return paymentMethods.data;
  }

  async createOrUpdateSubscription(subscriptionData) {
    const existing = await subscriptionRepository.findByStripeSubscriptionId(subscriptionData.stripeSubscriptionId);
    if (existing) {
      return await subscriptionRepository.update(existing.id, subscriptionData);
    }
    return await subscriptionRepository.create(subscriptionData);
  }

  async getPlans() {
    const prices = await this.stripe.prices.list({ active: true, expand: ['data.product'] });
    return prices.data.map(price => ({
      id: price.id,
      name: price.product.name,
      description: price.product.description,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
      intervalCount: price.recurring?.interval_count
    }));
  }

  async handleWebhook(payload, signature) {
    const event = this.stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        await this.createOrUpdateSubscription({
          userId: subscription.metadata.userId,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0].price.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });
        break;
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const existing = await subscriptionRepository.findByStripeSubscriptionId(deletedSubscription.id);
        if (existing) {
          await subscriptionRepository.delete(existing.id);
        }
        break;
    }
    
    return { received: true };
  }
}

module.exports = new BillingService();
