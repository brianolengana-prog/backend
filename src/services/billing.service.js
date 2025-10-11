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

  async getCustomerByUserId(userId) {
    // Get customer info from our database first
    const subscription = await subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      return {
        hasSubscription: false,
        plan: 'free',
        status: 'inactive'
      };
    }

    // Get fresh data from Stripe
    const customer = await this.stripe.customers.retrieve(subscription.stripeCustomerId);
    const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

    return {
      hasSubscription: true,
      plan: subscription.priceId,
      status: subscription.status,
      subscriptionId: subscription.stripeSubscriptionId,
      currentPeriodEnd: Math.floor(subscription.currentPeriodEnd.getTime() / 1000),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name
      },
      subscription: {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        current_period_end: stripeSubscription.current_period_end,
        current_period_start: stripeSubscription.current_period_start,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        plan: {
          id: subscription.priceId,
          name: this.getPlanName(subscription.priceId),
          amount: this.getPlanAmount(subscription.priceId),
          currency: 'usd',
          interval: 'month'
        }
      }
    };
  }

  getPlanName(priceId) {
    const names = {
      'free': 'Free Plan',
      'starter': 'Starter Plan',
      'professional': 'Professional Plan'
    };
    return names[priceId] || 'Free Plan';
  }

  getPlanAmount(priceId) {
    const amounts = {
      'free': 0,
      'starter': 2900,
      'professional': 9900
    };
    return amounts[priceId] || 0;
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
    // Return predefined plans synced with Stripe
    return [
      {
        id: 'free',
        stripeProductId: 'prod_SzeaT10bDht5qR',
        name: 'Free Trial',
        price: 0,
        interval: 'month',
        stripePriceId: 'price_1S3fHn6NEzYIXIMoL50vVpQr',
        uploadsPerMonth: 1,
        maxContacts: 10,
        aiProcessingMinutes: 5,
        storageGB: 1,
        apiCallsPerMonth: 100,
        supportLevel: 'Basic',
        isPopular: false,
        description: 'Try Callsheet Converter risk-free. Upload your first callsheet, extract key details, and export instantly—no commitment required.'
      },
      {
        id: 'starter',
        stripeProductId: 'prod_SzeZQiRTo7PuHd',
        name: 'Starter Plan',
        price: 2999, // $29.99 in cents (matches Stripe)
        interval: 'month',
        stripePriceId: 'price_1S3fG16NEzYIXIModekCNdYT',
        uploadsPerMonth: 50,
        maxContacts: 500,
        aiProcessingMinutes: 60,
        storageGB: 10,
        apiCallsPerMonth: 1000,
        supportLevel: 'Priority',
        isPopular: true,
        description: 'Get started with effortless callsheet conversions. Upload a file, extract key contacts and roles instantly, and export to CSV or Excel.'
      },
      {
        id: 'professional',
        stripeProductId: 'prod_SzecxaOOVTnLdy',
        name: 'Professional Plan',
        price: 7999, // $79.99 in cents (UPDATED to match Stripe!)
        interval: 'month',
        stripePriceId: 'price_1S3fJQ6NEzYIXIMorYYqfFpW',
        uploadsPerMonth: 200,
        maxContacts: 2000,
        aiProcessingMinutes: 300,
        storageGB: 50,
        apiCallsPerMonth: 5000,
        supportLevel: '24/7',
        isPopular: false,
        description: 'Designed for growing teams and busy professionals, this plan offers unlimited conversions, advanced data extraction, and full CSV/Excel exports.'
      }
    ];
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
