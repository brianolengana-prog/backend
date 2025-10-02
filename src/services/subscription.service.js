const Stripe = require('stripe');
const stripeService = require('./stripe.service');

class SubscriptionService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Get current user's subscription
   */
  async getCurrentSubscription(userId) {
    try {
      // For now, return a mock subscription since we don't have a database
      // In production, this would query the database for the user's subscription
      // and then sync with Stripe if needed
      
      // Get plans for the plan details
      const plansResult = await stripeService.getPlans();
      const plans = plansResult.plans || [];
      const freePlan = plans.find(p => p.id === 'free') || {
        id: 'free',
        name: 'Free',
        price: 0,
        interval: 'month',
        uploadsPerMonth: 1,
        maxContacts: 10,
        aiProcessingMinutes: 5,
        storageGB: 1,
        apiCallsPerMonth: 100,
        supportLevel: 'Basic'
      };

      return {
        id: 'sub_mock_' + userId,
        userId: userId,
        planId: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelAtPeriodEnd: false,
        plan: freePlan
      };
    } catch (error) {
      console.error('Error getting current subscription:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(userId, planId, paymentMethodId, trialDays) {
    try {
      // Get plan details
      const plans = await this.getPlans();
      const plan = plans.find(p => p.id === planId);
      
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      // Handle free plan
      if (plan.id === 'free') {
        return {
          id: 'sub_mock_' + userId,
          userId: userId,
          planId: 'free',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          cancelAtPeriodEnd: false,
          plan: plan
        };
      }

      // For paid plans, create Stripe subscription
      // This is a simplified version - in production you'd handle Stripe customer creation
      return {
        id: 'sub_stripe_' + userId,
        userId: userId,
        planId: planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        plan: plan,
        clientSecret: 'pi_mock_client_secret'
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(userId, planId) {
    try {
      const plans = await this.getPlans();
      const plan = plans.find(p => p.id === planId);
      
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      return {
        id: 'sub_mock_' + userId,
        userId: userId,
        planId: planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        plan: plan
      };
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    try {
      return {
        id: 'sub_mock_' + userId,
        userId: userId,
        planId: 'free',
        status: 'canceled',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        canceledAt: new Date()
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(userId) {
    try {
      return {
        id: 'sub_mock_' + userId,
        userId: userId,
        planId: 'starter',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        canceledAt: null
      };
    } catch (error) {
      console.error('Error resuming subscription:', error);
      throw error;
    }
  }

  /**
   * Get usage information
   */
  async getUserUsage(userId) {
    try {
      return {
        userId: userId,
        uploadsUsed: 0,
        uploadsLimit: 1,
        aiMinutesUsed: 0,
        aiMinutesLimit: 5,
        apiCalls: 0,
        apiCallsLimit: 100,
        storageUsed: 0.1,
        storageLimit: 1
      };
    } catch (error) {
      console.error('Error getting user usage:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform an action
   */
  async checkUsage(userId, action) {
    try {
      const usage = await this.getUserUsage(userId);
      const subscription = await this.getCurrentSubscription(userId);
      const plan = subscription.plan;

      let canPerform = false;
      let reason = '';

      switch (action) {
        case 'upload':
          canPerform = usage.uploadsUsed < usage.uploadsLimit;
          reason = canPerform ? '' : 'Upload limit reached for this month';
          break;
        case 'ai_processing':
          canPerform = usage.aiMinutesUsed < usage.aiMinutesLimit;
          reason = canPerform ? '' : 'AI processing limit reached for this month';
          break;
        case 'api_call':
          canPerform = usage.apiCalls < plan.apiCallsPerMonth;
          reason = canPerform ? '' : 'API call limit reached for this month';
          break;
        default:
          canPerform = false;
          reason = 'Unknown action';
      }

      return {
        canPerform,
        reason,
        usage: canPerform ? usage : null
      };
    } catch (error) {
      console.error('Error checking usage:', error);
      throw error;
    }
  }

  /**
   * Get billing information
   */
  async getBillingInfo(userId) {
    try {
      return {
        id: 'cus_mock_' + userId,
        email: 'user@example.com',
        name: 'Mock User',
        address: null,
        paymentMethod: null
      };
    } catch (error) {
      console.error('Error getting billing info:', error);
      throw error;
    }
  }

  /**
   * Get invoices
   */
  async getInvoices(userId) {
    try {
      return [];
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  }

  /**
   * Get available plans
   */
  async getPlans() {
    try {
      const result = await stripeService.getPlans();
      return result.plans || [];
    } catch (error) {
      console.error('Error getting plans:', error);
      // Return default plans as fallback
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
  }
}

module.exports = new SubscriptionService();
