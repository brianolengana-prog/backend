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

      // Save customer ID to user if not already saved
      if (metadata.userId && !existingCustomers.data.length) {
        try {
          const userRepository = require('../repositories/user.repository');
          await userRepository.update(metadata.userId, { stripeCustomerId: customer.id });
          console.log(`✅ Saved Stripe customer ID ${customer.id} to user ${metadata.userId}`);
        } catch (dbError) {
          console.error('❌ Error saving customer ID to user:', dbError);
          // Continue anyway, the checkout session was created
        }
      }

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
        
        // Map Stripe product IDs to our simple IDs
        let simpleId = 'free';
        let uploadsPerMonth = 1;
        let maxContacts = 10;
        let supportLevel = 'Basic';
        let isPopular = false;
        
        if (product.id === 'prod_SzeaT10bDht5qR') {
          // Free Trial
          simpleId = 'free';
          uploadsPerMonth = 1;
          maxContacts = 10;
          supportLevel = 'Basic';
          isPopular = false;
        } else if (product.id === 'prod_SzeZQiRTo7PuHd') {
          // Starter Plan
          simpleId = 'starter';
          uploadsPerMonth = 50;
          maxContacts = 500;
          supportLevel = 'Priority';
          isPopular = true;
        } else if (product.id === 'prod_SzecxaOOVTnLdy') {
          // Professional Plan
          simpleId = 'professional';
          uploadsPerMonth = 200;
          maxContacts = 2000;
          supportLevel = '24/7';
          isPopular = false;
        }
        
        // Set defaults based on plan (since Stripe metadata is not set)
        let aiProcessingMinutes = 5;
        let storageGB = 1;
        let apiCallsPerMonth = 100;
        
        if (simpleId === 'starter') {
          aiProcessingMinutes = 60;
          storageGB = 10;
          apiCallsPerMonth = 1000;
        } else if (simpleId === 'professional') {
          aiProcessingMinutes = 300;
          storageGB = 50;
          apiCallsPerMonth = 5000;
        }
        
        // Override with Stripe metadata if available
        if (product.metadata?.aiProcessingMinutes) aiProcessingMinutes = parseInt(product.metadata.aiProcessingMinutes);
        if (product.metadata?.storageGB) storageGB = parseInt(product.metadata.storageGB);
        if (product.metadata?.apiCallsPerMonth) apiCallsPerMonth = parseInt(product.metadata.apiCallsPerMonth);
        
        // Get features from Stripe product metadata or use defaults
        const features = this.getFeaturesFromMetadata(product.metadata) || this.getDefaultFeatures(simpleId);
        
        return {
          id: simpleId,
          stripeProductId: product.id,
          name: product.name,
          price: price.unit_amount,
          interval: price.recurring.interval,
          stripePriceId: price.id,
          uploadsPerMonth,
          maxContacts,
          aiProcessingMinutes,
          storageGB,
          apiCallsPerMonth,
          supportLevel,
          isPopular,
          description: product.description || 'Perfect for trying out the service',
          features: features
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
   * Extract features from Stripe product metadata
   */
  getFeaturesFromMetadata(metadata) {
    if (!metadata) return [];
    
    // Look for features in metadata
    const features = [];
    
    // Check for features stored as JSON string
    if (metadata.features) {
      try {
        const parsedFeatures = JSON.parse(metadata.features);
        if (Array.isArray(parsedFeatures)) {
          return parsedFeatures;
        }
      } catch (e) {
        console.warn('Failed to parse features JSON:', e);
      }
    }
    
    // Check for features stored as comma-separated string
    if (metadata.featuresList) {
      return metadata.featuresList.split(',').map(f => f.trim()).filter(f => f.length > 0);
    }
    
    // Check for individual feature fields
    const featureFields = [
      'feature1', 'feature2', 'feature3', 'feature4', 'feature5',
      'feature6', 'feature7', 'feature8', 'feature9', 'feature10'
    ];
    
    featureFields.forEach(field => {
      if (metadata[field] && metadata[field].trim()) {
        features.push(metadata[field].trim());
      }
    });
    
    return features;
  }

  /**
   * Get default plans when Stripe products don't exist
   */
  getDefaultPlans() {
    const plans = [
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
        price: 7999, // $79.99 in cents (matches Stripe)
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

    // Add features to each plan (using default features for fallback)
    return plans.map(plan => ({
      ...plan,
      features: this.getDefaultFeatures(plan.id)
    }));
  }

  /**
   * Get default features for fallback plans (synced with frontend config)
   */
  getDefaultFeatures(planId) {
    const defaultFeatures = {
      'free': [
        '1 upload per month',
        'Up to 10 contacts',
        'Basic extraction',
        'CSV export',
        'Email support',
        'No credit card required',
      ],
      'starter': [
        '50 uploads per month',
        'Up to 500 contacts',
        'Advanced AI extraction',
        'Multiple export formats',
        'Priority processing',
        'Email support',
        'Secure file handling'
      ],
      'professional': [
        '200 uploads per month',
        'Up to 2000 contacts',
        'Premium AI extraction',
        'All export formats',
        'Advanced analytics',
        'Priority support 24/7',
      ]
    };
    
    return defaultFeatures[planId] || [];
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
   * Handle subscription created/updated webhook
   */
  async handleSubscriptionUpdated(subscription) {
    console.log(`📝 Subscription updated: ${subscription.id}`);
    
    try {
      // Get customer ID from subscription
      const customerId = subscription.customer;
      const userId = subscription.metadata?.userId;
      
      if (userId && customerId) {
        // Update user with Stripe customer ID if not already set
        const userRepository = require('../repositories/user.repository');
        const user = await userRepository.findById(userId);
        
        if (user && !user.stripeCustomerId) {
          await userRepository.update(userId, { stripeCustomerId: customerId });
          console.log(`✅ Updated user ${userId} with Stripe customer ID ${customerId}`);
        }
        
        // Create or update subscription record in database
        const subscriptionRepository = require('../repositories/subscription.repository');
        const existingSubscription = await subscriptionRepository.findByStripeSubscriptionId(subscription.id);
        
        if (existingSubscription) {
          // Update existing subscription
          await subscriptionRepository.update(existingSubscription.id, {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date()
          });
          console.log(`✅ Updated subscription record for user ${userId}`);
        } else {
          // Create new subscription record
          await subscriptionRepository.create({
            userId: userId,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            priceId: subscription.items.data[0].price.id,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          });
          console.log(`✅ Created subscription record for user ${userId}`);
        }
      }
    } catch (error) {
      console.error('❌ Error handling subscription webhook:', error);
    }
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
