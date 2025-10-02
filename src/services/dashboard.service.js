const usageService = require('./usage.service');
const subscriptionService = require('./subscription.service');
const stripeService = require('./stripe.service');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class DashboardService {
  /**
   * Get comprehensive dashboard data for a user
   * All data is derived from the extraction workflow
   */
  async getDashboardData(userId) {
    try {
      console.log(`📊 Getting dashboard data for user: ${userId}`);

      // Get extraction-based metrics from the database
      const extractionMetrics = await this.getExtractionMetrics(userId);
      
      // Get usage information (tied to extractions)
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

      // Combine all data with extraction focus
      const dashboardData = {
        // Usage metrics (derived from extractions)
        usage: {
          uploadsUsed: usage.uploadsUsed,
          uploadsLimit: usage.uploadsLimit,
          canUpload: usage.canUpload,
          reason: usage.reason,
          totalContacts: extractionMetrics.totalContacts,
          totalJobs: extractionMetrics.totalJobs,
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
        
        // Extraction-based metrics
        metrics: {
          totalContacts: extractionMetrics.totalContacts,
          totalJobs: extractionMetrics.totalJobs,
          successfulExtractions: extractionMetrics.successfulExtractions,
          failedExtractions: extractionMetrics.failedExtractions,
          averageContactsPerJob: extractionMetrics.averageContactsPerJob,
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
          canViewContacts: extractionMetrics.totalContacts > 0
        }
      };

      console.log(`✅ Dashboard data prepared for user ${userId}:`, {
        uploads: `${usage.uploadsUsed}/${usage.uploadsLimit}`,
        plan: usage.planName,
        contacts: extractionMetrics.totalContacts,
        jobs: extractionMetrics.totalJobs,
        successRate: extractionMetrics.successRate
      });

      return dashboardData;
    } catch (error) {
      console.error('❌ Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get extraction-based metrics for a user
   * This is the core method that ties all dashboard data to the extraction workflow
   */
  async getExtractionMetrics(userId) {
    try {
      console.log(`📊 Getting extraction metrics for user: ${userId}`);

      // Get all jobs for the user
      const jobs = await prisma.job.findMany({
        where: { userId },
        include: {
          contacts: true,
          production: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate metrics from extraction jobs
      const totalJobs = jobs.length;
      const successfulJobs = jobs.filter(job => job.status === 'completed' && job.contacts.length > 0);
      const failedJobs = jobs.filter(job => job.status === 'failed' || job.status === 'error');
      
      const totalContacts = jobs.reduce((sum, job) => sum + job.contacts.length, 0);
      const successfulExtractions = successfulJobs.length;
      const failedExtractions = failedJobs.length;
      
      const averageContactsPerJob = totalJobs > 0 ? Math.round(totalContacts / totalJobs * 100) / 100 : 0;
      const successRate = totalJobs > 0 ? Math.round((successfulExtractions / totalJobs) * 100) : 0;

      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentJobs = jobs.filter(job => job.createdAt >= sevenDaysAgo);
      const recentContacts = recentJobs.reduce((sum, job) => sum + job.contacts.length, 0);

      // Get contacts by role
      const contactsByRole = await prisma.contact.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      });

      // Get contacts by production
      const contactsByProduction = await prisma.contact.groupBy({
        by: ['productionId'],
        where: { userId },
        _count: { productionId: true }
      });

      const metrics = {
        totalJobs,
        totalContacts,
        successfulExtractions,
        failedExtractions,
        averageContactsPerJob,
        successRate,
        recentJobs: recentJobs.length,
        recentContacts,
        contactsByRole: contactsByRole.map(item => ({
          role: item.role || 'Unknown',
          count: item._count.role
        })),
        contactsByProduction: contactsByProduction.map(item => ({
          productionId: item.productionId,
          count: item._count.productionId
        })),
        lastExtractionDate: jobs.length > 0 ? jobs[0].createdAt : null
      };

      console.log(`✅ Extraction metrics for user ${userId}:`, {
        jobs: totalJobs,
        contacts: totalContacts,
        successRate: `${successRate}%`,
        avgContactsPerJob: averageContactsPerJob
      });

      return metrics;
    } catch (error) {
      console.error('❌ Error getting extraction metrics:', error);
      // Return default values if there's an error
      return {
        totalJobs: 0,
        totalContacts: 0,
        successfulExtractions: 0,
        failedExtractions: 0,
        averageContactsPerJob: 0,
        successRate: 0,
        recentJobs: 0,
        recentContacts: 0,
        contactsByRole: [],
        contactsByProduction: [],
        lastExtractionDate: null
      };
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
   * Get recent activity based on extraction jobs
   */
  async getRecentActivity(userId) {
    try {
      console.log(`📈 Getting recent activity for user: ${userId}`);

      // Get recent jobs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentJobs = await prisma.job.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        include: {
          contacts: true,
          production: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Convert jobs to activity items
      const activities = recentJobs.map(job => {
        let message = '';
        let type = 'upload';
        let status = 'success';

        if (job.status === 'completed') {
          if (job.contacts.length > 0) {
            message = `${job.contacts.length} contact${job.contacts.length === 1 ? '' : 's'} extracted from ${job.fileName || 'call sheet'}`;
            type = 'contacts';
          } else {
            message = `Call sheet processed but no contacts found`;
            type = 'processing';
            status = 'warning';
          }
        } else if (job.status === 'failed' || job.status === 'error') {
          message = `Extraction failed for ${job.fileName || 'call sheet'}`;
          type = 'error';
          status = 'error';
        } else if (job.status === 'processing') {
          message = `Processing ${job.fileName || 'call sheet'}...`;
          type = 'processing';
          status = 'processing';
        } else {
          message = `Call sheet uploaded: ${job.fileName || 'Unknown file'}`;
          type = 'upload';
        }

        return {
          id: job.id,
          type,
          message,
          timestamp: job.createdAt,
          status,
          jobId: job.id,
          fileName: job.fileName,
          contactsCount: job.contacts.length
        };
      });

      console.log(`✅ Recent activity for user ${userId}: ${activities.length} activities`);
      return activities;
    } catch (error) {
      console.error('❌ Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Get performance metrics based on extraction jobs
   */
  async getPerformanceMetrics(userId) {
    try {
      console.log(`📊 Getting performance metrics for user: ${userId}`);

      // Get all jobs for the user
      const jobs = await prisma.job.findMany({
        where: { userId },
        include: {
          contacts: true
        },
        orderBy: { createdAt: 'desc' }
      });

      if (jobs.length === 0) {
        return {
          successRate: 0,
          averageProcessingTime: 0,
          totalTimeSaved: 0,
          efficiency: 0,
          accuracy: 0,
          totalJobs: 0,
          totalContacts: 0
        };
      }

      // Calculate metrics from actual job data
      const totalJobs = jobs.length;
      const successfulJobs = jobs.filter(job => job.status === 'completed' && job.contacts.length > 0);
      const failedJobs = jobs.filter(job => job.status === 'failed' || job.status === 'error');
      
      const successRate = totalJobs > 0 ? Math.round((successfulJobs.length / totalJobs) * 100 * 10) / 10 : 0;
      
      // Calculate average processing time (if we have timing data)
      const jobsWithTiming = jobs.filter(job => job.startedAt && job.completedAt);
      const averageProcessingTime = jobsWithTiming.length > 0 
        ? jobsWithTiming.reduce((sum, job) => {
            const duration = new Date(job.completedAt) - new Date(job.startedAt);
            return sum + (duration / 1000 / 60); // Convert to minutes
          }, 0) / jobsWithTiming.length
        : 2.5; // Default estimate

      // Estimate time saved (assuming manual extraction takes 5 minutes per contact)
      const totalContacts = jobs.reduce((sum, job) => sum + job.contacts.length, 0);
      const manualTimePerContact = 5; // minutes
      const totalTimeSaved = totalContacts * manualTimePerContact;

      // Calculate efficiency (successful extractions vs total attempts)
      const efficiency = totalJobs > 0 ? Math.round((successfulJobs.length / totalJobs) * 100 * 10) / 10 : 0;

      // Estimate accuracy based on successful extractions with contacts
      const jobsWithContacts = jobs.filter(job => job.contacts.length > 0);
      const accuracy = totalJobs > 0 ? Math.round((jobsWithContacts.length / totalJobs) * 100 * 10) / 10 : 0;

      const metrics = {
        successRate,
        averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
        totalTimeSaved: Math.round(totalTimeSaved),
        efficiency,
        accuracy,
        totalJobs,
        totalContacts,
        successfulJobs: successfulJobs.length,
        failedJobs: failedJobs.length
      };

      console.log(`✅ Performance metrics for user ${userId}:`, {
        successRate: `${successRate}%`,
        avgTime: `${averageProcessingTime.toFixed(1)}min`,
        timeSaved: `${totalTimeSaved}min`,
        efficiency: `${efficiency}%`
      });

      return metrics;
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return {
        successRate: 0,
        averageProcessingTime: 0,
        totalTimeSaved: 0,
        efficiency: 0,
        accuracy: 0,
        totalJobs: 0,
        totalContacts: 0
      };
    }
  }
}

module.exports = new DashboardService();
