const usageService = require('./usage.service');
const subscriptionService = require('./subscription.service');
const stripeService = require('./stripe.service');

class DashboardService {
  /**
   * Get comprehensive dashboard data for a user
   */
  async getDashboardData(userId) {
    try {
      console.log(`📊 Getting dashboard data for user: ${userId}`);

      // Get usage information
      const usage = await usageService.getCurrentUsage(userId);
      
      // Get subscription information
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      
      // Get Stripe customer info for billing status
      let stripeInfo = null;
      try {
        stripeInfo = await stripeService.getCustomerInfo(userId);
      } catch (error) {
        console.log('⚠️ Could not get Stripe info, using subscription service data');
      }

      // Combine all data
      const dashboardData = {
        // Usage metrics
        usage: {
          uploadsUsed: usage.uploadsUsed,
          uploadsLimit: usage.uploadsLimit,
          canUpload: usage.canUpload,
          reason: usage.reason,
          totalContacts: usage.totalContacts,
          totalJobs: usage.totalJobs,
          planId: usage.planId,
          planName: usage.planName
        },
        
        // Subscription info
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: subscription.plan
        },
        
        // Stripe billing info
        billing: stripeInfo ? {
          hasSubscription: stripeInfo.hasSubscription,
          plan: stripeInfo.plan,
          status: stripeInfo.status,
          subscriptionId: stripeInfo.subscriptionId,
          currentPeriodEnd: stripeInfo.currentPeriodEnd,
          cancelAtPeriodEnd: stripeInfo.cancelAtPeriodEnd
        } : null,
        
        // Quick stats for metrics cards
        metrics: {
          totalContacts: usage.totalContacts,
          totalJobs: usage.totalJobs,
          uploadsUsed: usage.uploadsUsed,
          uploadsLimit: usage.uploadsLimit,
          planName: usage.planName,
          planId: usage.planId
        },
        
        // Plan information
        planInfo: {
          id: subscription.planId,
          name: subscription.plan.name,
          price: subscription.plan.price,
          interval: subscription.plan.interval,
          features: this.getPlanFeatures(subscription.planId),
          limits: this.getPlanLimits(subscription.planId)
        },
        
        // Quick actions availability
        actions: {
          canUpload: usage.canUpload,
          canUpgrade: usage.planId === 'free' || usage.uploadsUsed >= usage.uploadsLimit * 0.8,
          canManageBilling: stripeInfo && stripeInfo.hasSubscription,
          canViewContacts: usage.totalContacts > 0
        }
      };

      console.log(`✅ Dashboard data prepared for user ${userId}:`, {
        uploads: `${usage.uploadsUsed}/${usage.uploadsLimit}`,
        plan: usage.planName,
        contacts: usage.totalContacts,
        jobs: usage.totalJobs
      });

      return dashboardData;
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get plan features for display
   */
  getPlanFeatures(planId) {
    const features = {
      'free': [
        '1 upload per month',
        'Up to 10 contacts',
        'Basic AI processing',
        '1GB storage',
        'Community support'
      ],
      'starter': [
        '50 uploads per month',
        'Up to 500 contacts',
        'Advanced AI processing',
        '10GB storage',
        'Priority support',
        'API access'
      ],
      'professional': [
        '200 uploads per month',
        'Up to 2,000 contacts',
        'Premium AI processing',
        '50GB storage',
        '24/7 support',
        'Advanced API access',
        'Custom integrations'
      ],
      'enterprise': [
        'Unlimited uploads',
        'Unlimited contacts',
        'Enterprise AI processing',
        '500GB storage',
        'Dedicated support',
        'Full API access',
        'Custom integrations',
        'SSO support'
      ]
    };

    return features[planId] || features['free'];
  }

  /**
   * Get plan limits for display
   */
  getPlanLimits(planId) {
    const limits = {
      'free': {
        uploadsPerMonth: 1,
        maxContacts: 10,
        aiProcessingMinutes: 5,
        storageGB: 1,
        apiCallsPerMonth: 100,
        supportLevel: 'Basic'
      },
      'starter': {
        uploadsPerMonth: 50,
        maxContacts: 500,
        aiProcessingMinutes: 60,
        storageGB: 10,
        apiCallsPerMonth: 1000,
        supportLevel: 'Priority'
      },
      'professional': {
        uploadsPerMonth: 200,
        maxContacts: 2000,
        aiProcessingMinutes: 300,
        storageGB: 50,
        apiCallsPerMonth: 5000,
        supportLevel: '24/7'
      },
      'enterprise': {
        uploadsPerMonth: -1, // Unlimited
        maxContacts: -1, // Unlimited
        aiProcessingMinutes: -1, // Unlimited
        storageGB: 500,
        apiCallsPerMonth: -1, // Unlimited
        supportLevel: 'Dedicated'
      }
    };

    return limits[planId] || limits['free'];
  }

  /**
   * Get usage warnings and recommendations
   */
  async getUsageWarnings(userId) {
    try {
      const limits = await usageService.checkUsageLimits(userId);
      return {
        warnings: limits.warnings,
        canUpload: limits.canUpload,
        usage: limits.usage
      };
    } catch (error) {
      console.error('❌ Error getting usage warnings:', error);
      return {
        warnings: [],
        canUpload: true,
        usage: null
      };
    }
  }

  /**
   * Get recent activity (mock data for now)
   */
  async getRecentActivity(userId) {
    try {
      // In production, this would come from a database
      const activities = [
        {
          id: '1',
          type: 'upload',
          message: 'Call sheet uploaded successfully',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          status: 'success'
        },
        {
          id: '2',
          type: 'processing',
          message: 'AI processing completed',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          status: 'success'
        },
        {
          id: '3',
          type: 'contacts',
          message: '25 contacts extracted',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          status: 'success'
        }
      ];

      return activities;
    } catch (error) {
      console.error('❌ Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Get performance metrics (mock data for now)
   */
  async getPerformanceMetrics(userId) {
    try {
      const usage = await usageService.getCurrentUsage(userId);
      
      return {
        successRate: 95.5,
        averageProcessingTime: 2.3, // minutes
        totalTimeSaved: 45, // minutes
        efficiency: 87.2,
        accuracy: 94.8
      };
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return {
        successRate: 0,
        averageProcessingTime: 0,
        totalTimeSaved: 0,
        efficiency: 0,
        accuracy: 0
      };
    }
  }
}

module.exports = new DashboardService();
