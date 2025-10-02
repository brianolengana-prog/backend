const Stripe = require('stripe');

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create a checkout session for subscription signup
   */
  async createCheckoutSession(params) {
    try {
      const { priceId, successUrl, cancelUrl, customerEmail, metadata = {} } = params;

      if (!priceId) {
        throw new Error('Price ID is required');
      }

      // Validate that the price ID exists in Stripe
      try {
        const price = await this.stripe.prices.retrieve(priceId);
        if (!price.active) {
          throw new Error('Price ID is not active. Please refresh the page and try again.');
        }
        console.log(`✅ Validated price ID: ${priceId} for product: ${price.product}`);
      } catch (priceError) {
        console.error('❌ Invalid price ID:', priceId, priceError.message);
        throw new Error('Invalid price ID. Please refresh the page and try again.');
      }

      // Create or retrieve Stripe customer
      let customer;
      const existingCustomers = await this.stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        console.log(`✅ Found existing customer: ${customer.id}`);
      } else {
        customer = await this.stripe.customers.create({
          email: customerEmail,
          metadata: metadata
        });
        console.log(`✅ Created new customer: ${customer.id}`);
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            userId: metadata.userId || '',
            planId: metadata.planId || '',
            ...metadata
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        customer_update: {
          address: 'auto',
          name: 'auto'
        }
      });

      console.log(`✅ Created checkout session: ${session.id}`);
      return {
        success: true,
        sessionId: session.id,
        url: session.url,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: customer.email,
        metadata: session.metadata
      };
    } catch (error) {
      console.error('❌ Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a customer portal session for managing subscriptions
   */
  async createCustomerPortalSession(customerId, returnUrl) {
    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      console.log(`✅ Created customer portal session: ${session.id}`);
      return {
        success: true,
        url: session.url
      };
    } catch (error) {
      console.error('❌ Error creating customer portal session:', error);
      throw error;
    }
  }

  /**
   * Get customer information and subscription
   */
  async getCustomerInfo(customerId) {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      
      if (!customer) {
        return {
          success: true,
          hasSubscription: false,
          plan: 'free',
          status: 'inactive'
        };
      }

      // Get subscription from Stripe
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return {
          success: true,
          hasSubscription: false,
          plan: 'free',
          status: 'inactive',
          customer: {
            id: customer.id,
            email: customer.email,
            name: customer.name
          }
        };
      }

      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0].price.id;

      return {
        success: true,
        hasSubscription: true,
        plan: this.getPlanFromPriceId(priceId),
        status: subscription.status,
        subscriptionId: subscription.id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        }
      };
    } catch (error) {
      console.error('❌ Error getting customer info:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      let subscription;
      
      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
        console.log(`✅ Subscription ${subscriptionId} canceled immediately by user`);
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
        console.log(`✅ Subscription ${subscriptionId} will be cancelled at period end by user`);
      }

      return {
        success: true,
        message: immediately 
          ? 'Subscription has been canceled immediately'
          : 'Subscription will be canceled at the end of the current period',
        subscription: {
          id: subscription.id,
          status: subscription.status,
          canceled_at: subscription.canceled_at,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end
        }
      };
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription (change plan)
   */
  async updateSubscription(subscriptionId, newPriceId) {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const currentItemId = subscription.items.data[0].id;

      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: currentItemId,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });

      console.log(`✅ Updated subscription ${subscriptionId} to price ${newPriceId}`);

      return {
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodStart: updatedSubscription.current_period_start,
          currentPeriodEnd: updatedSubscription.current_period_end,
          cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
        }
      };
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(customerId) {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit: 50
      });

      const history = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        description: invoice.description || 'Subscription Payment',
        invoice_pdf: invoice.invoice_pdf
      }));

      return {
        success: true,
        history
      };
    } catch (error) {
      console.error('❌ Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Get failed payments
   */
  async getFailedPayments(customerId) {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        status: 'open',
        limit: 50
      });

      const failedPayments = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        description: invoice.description || 'Subscription Payment',
        failureReason: invoice.last_finalization_error?.message,
        failureCode: invoice.last_finalization_error?.code,
        created: invoice.created,
        dueDate: invoice.due_date,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf
      }));

      return {
        success: true,
        failedPayments
      };
    } catch (error) {
      console.error('❌ Error getting failed payments:', error);
      throw error;
    }
  }

  /**
   * Retry failed payment
   */
  async retryPayment(invoiceId) {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      
      if (invoice.status === 'paid') {
        throw new Error('Invoice is already paid');
      }

      const updatedInvoice = await this.stripe.invoices.pay(invoiceId);

      return {
        success: true,
        invoice: {
          id: updatedInvoice.id,
          hostedInvoiceUrl: updatedInvoice.hosted_invoice_url,
          amountPaid: updatedInvoice.amount_paid
        }
      };
    } catch (error) {
      console.error('❌ Error retrying payment:', error);
      throw error;
    }
  }

  /**
   * Get available plans
   */
  async getPlans() {
    try {
      const prices = await this.stripe.prices.list({
        active: true,
        type: 'recurring',
        expand: ['data.product']
      });

      const plans = prices.data.map(price => {
        const product = price.product;
        return {
          id: product.metadata?.planId || product.id,
          name: product.name,
          price: price.unit_amount,
          interval: price.recurring.interval,
          stripePriceId: price.id,
          uploadsPerMonth: parseInt(product.metadata?.uploadsPerMonth || '1'),
          maxContacts: parseInt(product.metadata?.maxContacts || '10'),
          aiProcessingMinutes: parseInt(product.metadata?.aiProcessingMinutes || '5'),
          storageGB: parseInt(product.metadata?.storageGB || '1'),
          apiCallsPerMonth: parseInt(product.metadata?.apiCallsPerMonth || '100'),
          supportLevel: product.metadata?.supportLevel || 'Basic',
          isPopular: product.metadata?.isPopular === 'true',
          description: product.description || 'Perfect for trying out the service'
        };
      });

      // If no Stripe products exist, return default plans
      if (plans.length === 0) {
        return this.getDefaultPlans();
      }

      return {
        success: true,
        plans
      };
    } catch (error) {
      console.error('❌ Error getting plans:', error);
      // Return default plans as fallback
      return {
        success: true,
        plans: this.getDefaultPlans()
      };
    }
  }

  /**
   * Get default plans when Stripe products don't exist
   */
  getDefaultPlans() {
    return [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        stripePriceId: null,
        uploadsPerMonth: 1,
        maxContacts: 10,
        aiProcessingMinutes: 5,
        storageGB: 1,
        apiCallsPerMonth: 100,
        supportLevel: 'Basic',
        isPopular: false,
        description: 'Perfect for trying out the service'
      },
      {
        id: 'starter',
        name: 'Starter',
        price: 2900, // $29.00 in cents
        interval: 'month',
        stripePriceId: 'price_starter_monthly',
        uploadsPerMonth: 50,
        maxContacts: 500,
        aiProcessingMinutes: 60,
        storageGB: 10,
        apiCallsPerMonth: 1000,
        supportLevel: 'Priority',
        isPopular: true,
        description: 'Most popular for professionals'
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 9900, // $99.00 in cents
        interval: 'month',
        stripePriceId: 'price_professional_monthly',
        uploadsPerMonth: 200,
        maxContacts: 2000,
        aiProcessingMinutes: 300,
        storageGB: 50,
        apiCallsPerMonth: 5000,
        supportLevel: '24/7',
        isPopular: false,
        description: 'For growing teams and organizations'
      }
    ];
  }

  /**
   * Map price ID to plan name
   */
  getPlanFromPriceId(priceId) {
    const planMap = {
      'price_starter_monthly': 'starter',
      'price_professional_monthly': 'professional',
      'price_enterprise_monthly': 'enterprise'
    };
    return planMap[priceId] || 'free';
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle subscription updated webhook
   */
  async handleSubscriptionUpdated(subscription) {
    console.log(`📝 Subscription updated: ${subscription.id}`);
    // In a real implementation, you would update your database here
    // For now, we'll just log the event
  }

  /**
   * Handle subscription deleted webhook
   */
  async handleSubscriptionDeleted(subscription) {
    console.log(`🗑️ Subscription deleted: ${subscription.id}`);
    // In a real implementation, you would update your database here
    // For now, we'll just log the event
  }

  /**
   * Handle payment succeeded webhook
   */
  async handlePaymentSucceeded(invoice) {
    console.log(`💰 Payment succeeded: ${invoice.id}`);
    // In a real implementation, you would update your database here
    // For now, we'll just log the event
  }

  /**
   * Handle payment failed webhook
   */
  async handlePaymentFailed(invoice) {
    console.log(`❌ Payment failed: ${invoice.id}`);
    // In a real implementation, you would update your database here
    // For now, we'll just log the event
  }
}

module.exports = new StripeService();
