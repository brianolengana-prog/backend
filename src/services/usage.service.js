const { PrismaClient } = require('@prisma/client');
const { startOfMonth, endOfMonth } = require('date-fns');

const prisma = new PrismaClient();

class UsageService {
  /**
   * Get current usage for a user
   */
  async getCurrentUsage(userId) {
    try {
      // Get user's subscription info
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      // Get current month's usage
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const usage = await prisma.usage.findFirst({
        where: {
          userId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });

      // Get total contacts and jobs
      const totalContacts = await prisma.contact.count({
        where: { userId }
      });

      const totalJobs = await prisma.job.count({
        where: { userId }
      });

      // Determine plan limits
      const planLimits = this.getPlanLimits(subscription?.planId || 'free');
      
      // Calculate uploads used this month
      const uploadsUsed = usage?.uploadsThisMonth || 0;
      const canUpload = uploadsUsed < planLimits.uploadsPerMonth;

      return {
        uploadsUsed,
        uploadsLimit: planLimits.uploadsPerMonth,
        planId: subscription?.planId || 'free',
        planName: this.getPlanDisplayName(subscription?.planId || 'free'),
        canUpload,
        reason: !canUpload ? `You have reached your ${planLimits.uploadsPerMonth} upload limit for this month` : undefined,
        totalContacts,
        totalJobs
      };
    } catch (error) {
      console.error('Error getting current usage:', error);
      throw error;
    }
  }

  /**
   * Record a new upload
   */
  async recordUpload(userId, contactsCount = 0) {
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Get or create usage record for this month
      let usage = await prisma.usage.findFirst({
        where: {
          userId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        }
      });

      if (usage) {
        // Update existing usage
        usage = await prisma.usage.update({
          where: { id: usage.id },
          data: {
            uploadsThisMonth: usage.uploadsThisMonth + 1,
            totalContacts: usage.totalContacts + contactsCount
          }
        });
      } else {
        // Create new usage record
        usage = await prisma.usage.create({
          data: {
            userId,
            uploadsThisMonth: 1,
            totalContacts: contactsCount,
            createdAt: now
          }
        });
      }

      return usage;
    } catch (error) {
      console.error('Error recording upload:', error);
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
      console.error('Error checking upload permission:', error);
      return false;
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(userId, startDate, endDate) {
    try {
      const usage = await prisma.usage.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const totalUploads = usage.reduce((sum, u) => sum + u.uploadsThisMonth, 0);
      const totalContacts = usage.reduce((sum, u) => sum + u.totalContacts, 0);

      return {
        totalUploads,
        totalContacts,
        periods: usage.length
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }
}

module.exports = new UsageService();

