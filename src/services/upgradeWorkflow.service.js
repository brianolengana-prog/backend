/**
 * Upgrade Workflow Service
 * 
 * Handles upgrade workflows and plan transitions
 * - Check upgrade eligibility
 * - Handle plan transitions
 * - Manage upgrade prompts
 * - Track upgrade analytics
 */

const { PrismaClient } = require('@prisma/client');
const subscriptionService = require('./subscription.service');
const usageService = require('./usage.service');

class UpgradeWorkflowService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Check if user needs to upgrade
   */
  async checkUpgradeNeeded(userId) {
    try {
      console.log(`🔍 Checking upgrade needs for user: ${userId}`);
      
      const usage = await usageService.getCurrentUsage(userId);
      const subscription = await subscriptionService.getCurrentSubscription(userId);
      
      // Check if user is on free plan and has reached limits
      if (subscription.planId === 'free' && !usage.canUpload) {
        return {
          needsUpgrade: true,
          reason: 'free_limit_reached',
          message: 'You have reached your free plan limit. Upgrade to continue uploading.',
          currentPlan: subscription.plan,
          suggestedPlans: this.getSuggestedPlans(subscription.planId),
          upgradeUrl: '/pricing?upgrade=true'
        };
      }
      
      // Check if user is near limit (80% usage)
      const usagePercentage = (usage.uploadsUsed / usage.uploadsLimit) * 100;
      if (usagePercentage >= 80 && usagePercentage < 100) {
        return {
          needsUpgrade: false,
          warning: true,
          reason: 'approaching_limit',
          message: `You've used ${usage.uploadsUsed} of ${usage.uploadsLimit} uploads this month. Consider upgrading for more capacity.`,
          currentPlan: subscription.plan,
          suggestedPlans: this.getSuggestedPlans(subscription.planId),
          upgradeUrl: '/pricing?warning=true'
        };
      }
      
      return {
        needsUpgrade: false,
        warning: false,
        currentPlan: subscription.plan,
        usage: usage
      };
      
    } catch (error) {
      console.error('❌ Error checking upgrade needs:', error);
      throw error;
    }
  }

  /**
   * Get suggested upgrade plans
   */
  getSuggestedPlans(currentPlanId) {
    const planHierarchy = {
      'free': ['starter', 'professional'],
      'starter': ['professional'],
      'professional': [] // No upgrades from professional
    };
    
    const suggested = planHierarchy[currentPlanId] || [];
    
    return suggested.map(planId => ({
      id: planId,
      name: this.getPlanDisplayName(planId),
      features: this.getPlanFeatures(planId),
      benefits: this.getPlanBenefits(planId)
    }));
  }

  /**
   * Get plan display name
   */
  getPlanDisplayName(planId) {
    const names = {
      'free': 'Free Plan',
      'starter': 'Starter Plan',
      'professional': 'Professional Plan'
    };
    return names[planId] || 'Unknown Plan';
  }

  /**
   * Get plan features
   */
  getPlanFeatures(planId) {
    const features = {
      'starter': [
        '50 uploads per month',
        'Advanced extraction',
        'Priority support',
        'CSV export'
      ],
      'professional': [
        'Unlimited uploads',
        'AI-powered extraction',
        'Priority support',
        'All export formats',
        'API access',
        'Custom integrations'
      ]
    };
    return features[planId] || [];
  }

  /**
   * Get plan benefits
   */
  getPlanBenefits(planId) {
    const benefits = {
      'starter': [
        '5x more uploads than free',
        'Better accuracy',
        'Faster processing'
      ],
      'professional': [
        'Unlimited capacity',
        'Best accuracy',
        'Fastest processing',
        'Enterprise features'
      ]
    };
    return benefits[planId] || [];
  }

  /**
   * Handle upgrade prompt response
   */
  async handleUpgradePrompt(userId, action, planId = null) {
    try {
      console.log(`🔄 Handling upgrade prompt for user: ${userId}, action: ${action}, plan: ${planId}`);
      
      switch (action) {
        case 'upgrade_now':
          return {
            success: true,
            redirectUrl: `/pricing?plan=${planId}&upgrade=true`,
            message: 'Redirecting to upgrade page...'
          };
          
        case 'dismiss':
          // Log dismissal for analytics
          await this.logUpgradeEvent(userId, 'prompt_dismissed', { planId });
          return {
            success: true,
            message: 'Upgrade prompt dismissed'
          };
          
        case 'remind_later':
          // Set reminder for later
          await this.setUpgradeReminder(userId, planId);
          return {
            success: true,
            message: 'We\'ll remind you about upgrading later'
          };
          
        default:
          throw new Error('Invalid upgrade action');
      }
    } catch (error) {
      console.error('❌ Error handling upgrade prompt:', error);
      throw error;
    }
  }

  /**
   * Log upgrade events for analytics
   */
  async logUpgradeEvent(userId, event, metadata = {}) {
    try {
      await this.prisma.upgradeEvent.create({
        data: {
          userId,
          event,
          metadata: JSON.stringify(metadata),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('❌ Error logging upgrade event:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Set upgrade reminder
   */
  async setUpgradeReminder(userId, planId) {
    try {
      const reminderTime = new Date();
      reminderTime.setHours(reminderTime.getHours() + 24); // Remind in 24 hours
      
      await this.prisma.upgradeReminder.create({
        data: {
          userId,
          planId,
          reminderTime,
          status: 'pending'
        }
      });
    } catch (error) {
      console.error('❌ Error setting upgrade reminder:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get upgrade analytics
   */
  async getUpgradeAnalytics(userId) {
    try {
      const events = await this.prisma.upgradeEvent.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
      
      return {
        totalEvents: events.length,
        recentEvents: events.map(event => ({
          event: event.event,
          timestamp: event.timestamp,
          metadata: JSON.parse(event.metadata || '{}')
        }))
      };
    } catch (error) {
      console.error('❌ Error getting upgrade analytics:', error);
      return { totalEvents: 0, recentEvents: [] };
    }
  }

  /**
   * Check if user should see upgrade prompt
   */
  async shouldShowUpgradePrompt(userId) {
    try {
      // Check if user has recently dismissed upgrade prompt
      const recentDismissal = await this.prisma.upgradeEvent.findFirst({
        where: {
          userId,
          event: 'prompt_dismissed',
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });
      
      if (recentDismissal) {
        return false; // Don't show if recently dismissed
      }
      
      // Check upgrade needs
      const upgradeCheck = await this.checkUpgradeNeeded(userId);
      return upgradeCheck.needsUpgrade || upgradeCheck.warning;
      
    } catch (error) {
      console.error('❌ Error checking upgrade prompt:', error);
      return false;
    }
  }

  /**
   * Get upgrade prompt data
   */
  async getUpgradePromptData(userId) {
    try {
      const upgradeCheck = await this.checkUpgradeNeeded(userId);
      
      if (!upgradeCheck.needsUpgrade && !upgradeCheck.warning) {
        return null; // No prompt needed
      }
      
      return {
        type: upgradeCheck.needsUpgrade ? 'blocking' : 'warning',
        title: upgradeCheck.needsUpgrade ? 'Upgrade Required' : 'Consider Upgrading',
        message: upgradeCheck.message,
        currentPlan: upgradeCheck.currentPlan,
        suggestedPlans: upgradeCheck.suggestedPlans,
        upgradeUrl: upgradeCheck.upgradeUrl,
        actions: [
          { id: 'upgrade_now', label: 'Upgrade Now', primary: true },
          { id: 'remind_later', label: 'Remind Me Later' },
          { id: 'dismiss', label: 'Dismiss' }
        ]
      };
      
    } catch (error) {
      console.error('❌ Error getting upgrade prompt data:', error);
      return null;
    }
  }
}

module.exports = new UpgradeWorkflowService();
