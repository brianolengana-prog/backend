const Stripe = require('stripe');
const stripeService = require('./stripe.service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
      console.log(`📊 Getting current subscription for user: ${userId}`);

      // Get subscription from database
      const subscription = await prisma.subscription.findFirst({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' }
      });

      // Get plans for the plan details
      const plansResult = await stripeService.getPlans();
      const plans = plansResult.plans || [];
      
      if (subscription) {
        // Find the plan details
        const planDetails = plans.find(p => p.id === subscription.priceId) || 
                           plans.find(p => p.id === 'free') || {
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
          id: subscription.id,
          userId: userId,
          planId: subscription.priceId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: planDetails
        };
      } else {
        // No subscription found, return free plan
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
          id: 'sub_free_' + userId,
          userId: userId,
          planId: 'free',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          cancelAtPeriodEnd: false,
          plan: freePlan
        };
      }
    } catch (error) {
      console.error('❌ Error getting current subscription:', error);
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

      // Handle free plan - create in database
      if (plan.id === 'free') {
        const subscription = await prisma.subscription.create({
          data: {
            userId: userId,
            priceId: 'free',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            cancelAtPeriodEnd: false
          }
        });

        return {
          id: subscription.id,
          userId: userId,
          planId: 'free',
          status: 'active',
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: false,
          plan: plan
        };
      }

      // For paid plans, create Stripe subscription
      // This is a simplified version - in production you'd handle Stripe customer creation
      const subscription = await prisma.subscription.create({
        data: {
          userId: userId,
          priceId: planId,
          status: 'pending',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          cancelAtPeriodEnd: false
        }
      });

      return {
        id: subscription.id,
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
      console.log(`🔄 Updating subscription for user: ${userId} to plan: ${planId}`);
      
      const plans = await this.getPlans();
      const plan = plans.find(p => p.id === planId);
      
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      // Update existing subscription in database
      const subscription = await prisma.subscription.updateMany({
        where: { userId },
        data: {
          priceId: planId,
          updatedAt: new Date()
        }
      });

      // Get the updated subscription
      const updatedSubscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        id: updatedSubscription.id,
        userId: userId,
        planId: planId,
        status: updatedSubscription.status,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        plan: plan
      };
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, immediately = false) {
    try {
      console.log(`❌ Canceling subscription for user: ${userId}, immediately: ${immediately}`);
      
      // Get current subscription
      const currentSubscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!currentSubscription) {
        throw new Error('No active subscription found');
      }

      // If it's a Stripe subscription, cancel it on Stripe
      if (currentSubscription.stripeSubscriptionId) {
        try {
          if (immediately) {
            // Cancel immediately
            await this.stripe.subscriptions.cancel(currentSubscription.stripeSubscriptionId);
          } else {
            // Cancel at period end
            await this.stripe.subscriptions.update(currentSubscription.stripeSubscriptionId, {
              cancel_at_period_end: true
            });
          }
        } catch (stripeError) {
          console.error('❌ Stripe cancellation error:', stripeError);
          // Continue with database update even if Stripe fails
        }
      }

      // Update subscription in database
      const subscription = await prisma.subscription.updateMany({
        where: { userId },
        data: {
          status: immediately ? 'canceled' : 'active',
          cancelAtPeriodEnd: !immediately,
          canceledAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Get the updated subscription
      const updatedSubscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        id: updatedSubscription.id,
        userId: userId,
        planId: updatedSubscription.priceId,
        status: updatedSubscription.status,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        canceledAt: updatedSubscription.canceledAt,
        message: immediately 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at the end of the current period'
      };
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Resume subscription
   */
  async resumeSubscription(userId) {
    try {
      console.log(`▶️ Resuming subscription for user: ${userId}`);
      
      // Update subscription to active status
      const subscription = await prisma.subscription.updateMany({
        where: { userId },
        data: {
          status: 'active',
          cancelAtPeriodEnd: false,
          canceledAt: null,
          updatedAt: new Date()
        }
      });

      // Get the updated subscription
      const updatedSubscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        id: updatedSubscription.id,
        userId: userId,
        planId: updatedSubscription.priceId,
        status: 'active',
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null
      };
    } catch (error) {
      console.error('❌ Error resuming subscription:', error);
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
      console.log(`💳 Getting billing info for user: ${userId}`);
      
      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get Stripe customer if exists
      const stripeCustomer = await this.getStripeCustomer(userId);
      
      return {
        id: stripeCustomer?.id || `cus_${userId}`,
        email: user.email,
        name: user.name,
        address: stripeCustomer?.address || null,
        paymentMethod: stripeCustomer?.default_source || null
      };
    } catch (error) {
      console.error('❌ Error getting billing info:', error);
      throw error;
    }
  }

  /**
   * Get Stripe customer for user
   */
  async getStripeCustomer(userId) {
    try {
      // Get user's subscription to find Stripe customer ID
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      if (!subscription?.stripeCustomerId) {
        return null;
      }

      // Get customer from Stripe
      const customer = await this.stripe.customers.retrieve(subscription.stripeCustomerId);
      return customer;
    } catch (error) {
      console.error('❌ Error getting Stripe customer:', error);
      return null;
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
