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
        // First, try to get the Stripe customer ID from the user's subscription
        const userSubscription = await prisma.subscription.findFirst({
          where: { userId },
          select: { stripeCustomerId: true }
        });
        
        if (userSubscription?.stripeCustomerId) {
          stripeInfo = await stripeService.getCustomerInfo(userSubscription.stripeCustomerId);
        } else {
          console.log('⚠️ No Stripe customer ID found for user, using subscription service data');
        }
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
   * OPTIMIZED: Uses aggregation and _count instead of loading all data
   */
  async getExtractionMetrics(userId) {
    try {
      console.log(`📊 Getting extraction metrics for user: ${userId}`);

      // ✅ OPTIMIZATION: Use Promise.all to run queries in parallel
      const [
        totalJobs,
        totalContacts,
        validContacts,
        completedJobsCount,
        failedJobsCount,
        recentJobsData
      ] = await Promise.all([
        // Count total jobs
        prisma.job.count({ where: { userId } }),
        
        // Count total contacts (all contacts)
        prisma.contact.count({ where: { userId } }),
        
        // ✅ FIX: Count only valid contacts (with email OR phone) - matches Contacts page filter
        // This matches the requireContact=true filter used in ContactRepository
        prisma.contact.count({
          where: {
            userId,
            OR: [
              { email: { not: null, not: '', contains: '@' } },
              { phone: { not: null, not: '' } }
            ]
          }
        }),
        
        // Count successful jobs
        prisma.job.count({
          where: {
            userId,
            status: 'COMPLETED'  // ✅ FIX: Use uppercase to match Prisma enum
          }
        }),
        
        // Count failed jobs
        prisma.job.count({
          where: {
            userId,
            status: 'FAILED'  // ✅ FIX: Use uppercase enum value
          }
        }),
        
        // Get recent jobs (last 30 days) with just count of contacts
        prisma.job.findMany({
          where: {
            userId,
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
            }
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            _count: {
              select: { contacts: true }
            }
          }
        })
      ]);

      // Calculate metrics from aggregated data
      const successfulExtractions = completedJobsCount;
      const failedExtractions = failedJobsCount;

      // ✅ FIX: Use validContacts for averages (matches Contacts page behavior)
      const averageContactsPerJob = totalJobs > 0 ? Math.round((validContacts / totalJobs) * 100) / 100 : 0;
      const successRate = totalJobs > 0 ? Math.round((successfulExtractions / totalJobs) * 100) : 0;

      // Calculate recent activity from recentJobsData
      const recentJobs = recentJobsData.length;
      const recentContacts = recentJobsData.reduce((sum, job) => sum + job._count.contacts, 0);

      // ✅ OPTIMIZATION: Get contacts by role using groupBy (no full contact load)
      const contactsByRole = await prisma.contact.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      });

      // Get last extraction date (most recent job)
      const lastJob = await prisma.job.findFirst({
        where: { userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' }
      });

      const metrics = {
        totalJobs,
        totalContacts: validContacts, // ✅ FIX: Use validContacts instead of totalContacts (matches Contacts page)
        validContacts, // Keep for reference
        successfulExtractions,
        failedExtractions,
        averageContactsPerJob,
        successRate,
        recentJobs,
        recentContacts,
        contactsByRole: contactsByRole.map(item => ({
          role: item.role || 'Unknown',
          count: item._count.role
        })),
        lastExtractionDate: lastJob?.createdAt || null
      };

      console.log(`✅ Extraction metrics for user ${userId}:`, {
        jobs: totalJobs,
        contacts: validContacts, // ✅ FIX: Log valid contacts count
        totalContactsRaw: totalContacts, // Keep raw count for debugging
        successRate: `${successRate}%`,
        avgContactsPerJob: averageContactsPerJob
      });

      return metrics;
    } catch (error) {
      console.error('❌ Error getting extraction metrics:', error);
      // Return default values if there's an error
      return {
        totalJobs: 0,
        totalContacts: 0, // ✅ FIX: This is now validContacts count
        validContacts: 0,
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
   * OPTIMIZED: Only loads job metadata and contact count, not full contacts
   */
  async getRecentActivity(userId) {
    try {
      console.log(`📈 Getting recent activity for user: ${userId}`);

      // Get recent jobs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // ✅ OPTIMIZATION: Only select needed fields and use _count for contacts
      const recentJobs = await prisma.job.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        select: {
          id: true,
          status: true,
          fileName: true,
          createdAt: true,
          _count: {
            select: { contacts: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Convert jobs to activity items
      const activities = recentJobs.map(job => {
        let message = '';
        let type = 'upload';
        let status = 'success';
        const contactsCount = job._count.contacts;

        if (job.status === 'COMPLETED') {  // ✅ FIX: Uppercase enum
          if (contactsCount > 0) {
            message = `${contactsCount} contact${contactsCount === 1 ? '' : 's'} extracted from ${job.fileName || 'call sheet'}`;
            type = 'contacts';
          } else {
            message = `Call sheet processed but no contacts found`;
            type = 'processing';
            status = 'warning';
          }
        } else if (job.status === 'FAILED') {  // ✅ FIX: Uppercase enum
          message = `Extraction failed for ${job.fileName || 'call sheet'}`;
          type = 'error';
          status = 'error';
        } else if (job.status === 'PROCESSING') {  // ✅ FIX: Uppercase enum
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
          contactsCount
        };
      });

      console.log(`✅ Recent activity for user ${userId}: ${activities.length} activities`);
      return activities;
    } catch (error) {
      console.error('❌ Error getting recent activity:', error);
      return [];
    }
  }

}

module.exports = new DashboardService();
