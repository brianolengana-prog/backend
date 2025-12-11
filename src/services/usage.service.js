const { PrismaClient } = require('@prisma/client');
const subscriptionService = require('./subscription.service');
const notificationService = require('./notification.service');

const prisma = new PrismaClient();

class UsageService {
  /**
   * Get current usage for a user
   */
  async getCurrentUsage(userId) {
    try {
      console.log(`📊 Getting current usage for user: ${userId}`);

      // Get user's subscription info
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      
      // Get current month's usage from database
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      let usage = await prisma.usage.findUnique({
        where: {
          userId_month: {
            userId: userId,
            month: monthKey
          }
        }
      });

      // If no usage record exists for this month, create one
      if (!usage) {
        usage = await prisma.usage.create({
          data: {
            userId: userId,
            month: monthKey,
            jobsProcessed: 0,
            contactsExtracted: 0,
            apiCalls: 0
          }
        });
      }

      // Get total contacts and jobs from database
      const totalContacts = await prisma.contact.count({
        where: { userId: userId }
      });

      const totalJobs = await prisma.job.count({
        where: { userId: userId }
      });

      // Determine plan limits from subscription
      const planLimits = this.getPlanLimits(subscription.planId);
      
      // Calculate uploads used this month (jobs processed)
      const uploadsUsed = usage.jobsProcessed;
      const canUpload = uploadsUsed < planLimits.uploadsPerMonth;

      const usageInfo = {
        uploadsUsed,
        uploadsLimit: planLimits.uploadsPerMonth,
        planId: subscription.planId,
        planName: this.getPlanDisplayName(subscription.planId),
        canUpload,
        reason: !canUpload ? `You have reached your ${planLimits.uploadsPerMonth} upload limit for this month` : undefined,
        totalContacts,
        totalJobs,
        // Additional fields for frontend compatibility
        uploadsThisMonth: uploadsUsed,
        currentPlan: subscription.planId
      };

      console.log(`📊 Usage info for user ${userId}:`, usageInfo);
      return usageInfo;
    } catch (error) {
      console.error('❌ Error getting current usage:', error);
      // Return default free plan usage on error
      return {
        uploadsUsed: 0,
        uploadsLimit: 1,
        planId: 'free',
        planName: 'Free Plan',
        canUpload: true,
        totalContacts: 0,
        totalJobs: 0
      };
    }
  }

  /**
   * Record a new upload (job processing)
   */
  async recordUpload(userId, contactsCount = 0) {
    try {
      console.log(`📊 Recording upload for user: ${userId}, contacts: ${contactsCount}`);

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Get or create usage record for this month
      let usage = await prisma.usage.findUnique({
        where: {
          userId_month: {
            userId: userId,
            month: monthKey
          }
        }
      });
      
      if (usage) {
        // Update existing usage
        usage = await prisma.usage.update({
          where: {
            userId_month: {
              userId: userId,
              month: monthKey
            }
          },
          data: {
            jobsProcessed: usage.jobsProcessed + 1,
            contactsExtracted: usage.contactsExtracted + contactsCount
          }
        });
      } else {
        // Create new usage record
        usage = await prisma.usage.create({
          data: {
            userId: userId,
            month: monthKey,
            jobsProcessed: 1,
            contactsExtracted: contactsCount,
            apiCalls: 0
          }
        });
      }

      console.log(`✅ Upload recorded for user ${userId}: ${usage.jobsProcessed} jobs this month`);
      return usage;
    } catch (error) {
      console.error('❌ Error recording upload:', error);
      throw error;
    }
  }

  /**
   * Record API call usage
   */
  async recordApiCall(userId) {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await prisma.usage.upsert({
        where: {
          userId_month: {
            userId: userId,
            month: monthKey
          }
        },
        update: {
          apiCalls: {
            increment: 1
          }
        },
        create: {
          userId: userId,
          month: monthKey,
          jobsProcessed: 0,
          contactsExtracted: 0,
          apiCalls: 1
        }
      });

      console.log(`📊 API call recorded for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error recording API call:', error);
      throw error;
    }
  }

  /**
   * Get plan limits based on plan ID
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
   * Get plan display name
   */
  getPlanDisplayName(planId) {
    const names = {
      'free': 'Free Plan',
      'starter': 'Starter Plan',
      'professional': 'Professional Plan',
      'enterprise': 'Enterprise Plan'
    };

    return names[planId] || 'Free Plan';
  }

  /**
   * Check if user can upload
   */
  async canUserUpload(userId) {
    try {
      const usage = await this.getCurrentUsage(userId);
      return usage.canUpload;
    } catch (error) {
      console.error('❌ Error checking upload permission:', error);
      return false;
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId, startDate, endDate) {
    try {
      console.log(`📊 Getting usage stats for user: ${userId} from ${startDate} to ${endDate}`);

      const usage = await prisma.usage.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const totalUploads = usage.reduce((sum, u) => sum + u.jobsProcessed, 0);
      const totalContacts = usage.reduce((sum, u) => sum + u.contactsExtracted, 0);
      const totalApiCalls = usage.reduce((sum, u) => sum + u.apiCalls, 0);

      return {
        totalUploads,
        totalContacts,
        totalApiCalls,
        periods: usage.length
      };
    } catch (error) {
      console.error('❌ Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Reset usage for a user (useful for testing or plan changes)
   */
  async resetUsage(userId) {
    try {
      console.log(`🔄 Resetting usage for user: ${userId}`);
      
      await prisma.usage.deleteMany({
        where: { userId: userId }
      });
      
      console.log(`✅ Usage reset for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error resetting usage:', error);
      throw error;
    }
  }

  /**
   * Get usage summary for dashboard
   */
  async getUsageSummary(userId) {
    try {
      const usage = await this.getCurrentUsage(userId);
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      
      return {
        ...usage,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd
        }
      };
    } catch (error) {
      console.error('❌ Error getting usage summary:', error);
      throw error;
    }
  }

  /**
   * Check usage limits and return appropriate warnings
   */
  async checkUsageLimits(userId) {
    try {
      const usage = await this.getCurrentUsage(userId);
      const warnings = [];

      // Check upload limits
      const uploadPercentage = (usage.uploadsUsed / usage.uploadsLimit) * 100;
      if (uploadPercentage >= 90 && uploadPercentage < 100) {
        warnings.push({
          type: 'warning',
          message: `You've used ${usage.uploadsUsed}/${usage.uploadsLimit} uploads this month. Consider upgrading your plan.`,
          action: 'upgrade'
        });
      } else if (uploadPercentage >= 100) {
        warnings.push({
          type: 'error',
          message: `You've reached your upload limit of ${usage.uploadsLimit} for this month.`,
          action: 'upgrade'
        });
      }

      // Check contact limits
      const planLimits = this.getPlanLimits(usage.planId);
      if (planLimits.maxContacts > 0 && usage.totalContacts >= planLimits.maxContacts) {
        warnings.push({
          type: 'warning',
          message: `You've reached your contact limit of ${planLimits.maxContacts}. Consider upgrading your plan.`,
          action: 'upgrade'
        });
      }

      return {
        usage,
        warnings,
        canUpload: usage.canUpload
      };
    } catch (error) {
      console.error('❌ Error checking usage limits:', error);
      throw error;
    }
  }

  /**
   * Get monthly usage history
   */
  async getUsageHistory(userId, months = 12) {
    try {
      const usage = await prisma.usage.findMany({
        where: { userId: userId },
        orderBy: { month: 'desc' },
        take: months
      });

      return usage.map(u => ({
        month: u.month,
        jobsProcessed: u.jobsProcessed,
        contactsExtracted: u.contactsExtracted,
        apiCalls: u.apiCalls,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      }));
    } catch (error) {
      console.error('❌ Error getting usage history:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform a specific action (upload, API call, etc.)
   */
  async canPerformAction(userId, actionType, quantity = 1) {
    try {
      // 🧪 TESTING MODE: Bypass upload limits
      // Option 1: Set environment variable DISABLE_UPLOAD_LIMITS=true
      // Option 2: Temporarily set TEMP_DISABLE_UPLOAD_LIMITS to true below
      const TEMP_DISABLE_UPLOAD_LIMITS = true; // ⚠️ TEMPORARY: Set to false to re-enable limits
      
      const disableLimits = TEMP_DISABLE_UPLOAD_LIMITS || 
                           process.env.DISABLE_UPLOAD_LIMITS === 'true' || 
                           process.env.DISABLE_UPLOAD_LIMITS === '1';
      
      if (disableLimits) {
        console.log('🧪 TESTING MODE: Upload limits disabled (temporary bypass enabled)');
        return {
          canPerform: true,
          reason: null,
          currentUsage: 0,
          limit: -1,
          remaining: -1,
          testingMode: true
        };
      }
      
      console.log(`🔍 Checking if user ${userId} can perform ${actionType} (quantity: ${quantity})`);
      
      const usage = await this.getCurrentUsage(userId);
      const planLimits = this.getPlanLimits(usage.planId);
      
      switch (actionType) {
        case 'upload':
          const canUpload = usage.uploadsUsed + quantity <= planLimits.uploadsPerMonth || planLimits.uploadsPerMonth === -1;
          return {
            canPerform: canUpload,
            reason: canUpload ? null : `You have reached your ${planLimits.uploadsPerMonth} upload limit for this month`,
            currentUsage: usage.uploadsUsed,
            limit: planLimits.uploadsPerMonth,
            remaining: planLimits.uploadsPerMonth === -1 ? -1 : Math.max(0, planLimits.uploadsPerMonth - usage.uploadsUsed)
          };
          
        case 'api_call':
          // For now, we'll allow API calls (we can add limits later)
          return {
            canPerform: true,
            reason: null,
            currentUsage: 0,
            limit: -1,
            remaining: -1
          };
          
        case 'contact_extraction':
          const canExtractContacts = planLimits.maxContacts === -1 || usage.totalContacts + quantity <= planLimits.maxContacts;
          return {
            canPerform: canExtractContacts,
            reason: canExtractContacts ? null : `You have reached your ${planLimits.maxContacts} contact limit`,
            currentUsage: usage.totalContacts,
            limit: planLimits.maxContacts,
            remaining: planLimits.maxContacts === -1 ? -1 : Math.max(0, planLimits.maxContacts - usage.totalContacts)
          };
          
        default:
          return {
            canPerform: true,
            reason: null,
            currentUsage: 0,
            limit: -1,
            remaining: -1
          };
      }
    } catch (error) {
      console.error('❌ Error checking action permission:', error);
      return {
        canPerform: false,
        reason: 'Unable to verify permissions',
        currentUsage: 0,
        limit: 0,
        remaining: 0
      };
    }
  }

  /**
   * Increment usage for a specific action
   */
  async incrementUsage(userId, actionType, quantity = 1) {
    try {
      // 🧪 TESTING MODE: Skip usage tracking when DISABLE_USAGE_TRACKING=true
      if (process.env.DISABLE_USAGE_TRACKING === 'true') {
        console.log('🧪 TESTING MODE: Usage tracking disabled');
        return { success: true, testingMode: true };
      }
      
      console.log(`📈 Incrementing usage for user ${userId}: ${actionType} (quantity: ${quantity})`);
      
      switch (actionType) {
        case 'upload':
          await this.recordUpload(userId, 0); // We'll update contact count separately
          // After recording, check thresholds and send notifications
          try {
            const usage = await this.getCurrentUsage(userId);
            await notificationService.notifyUsageThreshold(userId, {
              uploadsUsed: usage.uploadsUsed,
              uploadsLimit: usage.uploadsLimit,
              planId: usage.planId
            });
          } catch (notifyError) {
            console.warn('⚠️ Failed to send usage notification:', notifyError.message);
          }
          break;
          
        case 'api_call':
          await this.recordApiCall(userId);
          break;
          
        case 'contact_extraction':
          // This is handled when we record the upload with contact count
          break;
          
        default:
          console.log(`⚠️ Unknown action type: ${actionType}`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error incrementing usage:', error);
      throw error;
    }
  }
}

module.exports = new UsageService();