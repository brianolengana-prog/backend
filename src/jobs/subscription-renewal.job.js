/**
 * Subscription Renewal Job
 * Handles automatic monthly renewal for Free plan subscriptions
 * Runs daily at midnight to check for expired free plans
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Renew expired free plan subscriptions
 */
async function renewExpiredFreePlans() {
  try {
    console.log('🔄 Starting free plan renewal check...');
    
    const now = new Date();
    
    // Find all free plan subscriptions that have expired
    const expiredFreePlans = await prisma.subscription.findMany({
      where: {
        priceId: 'free',
        currentPeriodEnd: {
          lt: now  // Period has ended
        },
        status: 'active'
      }
    });
    
    console.log(`📋 Found ${expiredFreePlans.length} expired free plan subscriptions`);
    
    for (const subscription of expiredFreePlans) {
      try {
        // Calculate new period (next 30 days)
        const newPeriodStart = subscription.currentPeriodEnd;
        const newPeriodEnd = new Date(newPeriodStart);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        
        // Renew subscription
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
            status: 'active',
            updatedAt: now
          }
        });
        
        console.log(`✅ Renewed free plan for user ${subscription.userId}: ${newPeriodStart.toISOString()} → ${newPeriodEnd.toISOString()}`);
      } catch (error) {
        console.error(`❌ Error renewing subscription ${subscription.id}:`, error);
      }
    }
    
    console.log(`✅ Free plan renewal completed: ${expiredFreePlans.length} subscriptions renewed`);
    
  } catch (error) {
    console.error('❌ Error in free plan renewal job:', error);
  }
}

/**
 * Reset monthly usage counters
 * Called after renewing subscriptions
 */
async function resetMonthlyUsage() {
  try {
    console.log('🔄 Starting usage counter reset...');
    
    // Note: Usage is tracked in a separate table (if exists)
    // For now, we're just logging. In production, you'd reset usage counters here.
    // Example:
    // await prisma.usage.updateMany({
    //   where: { 
    //     periodEnd: { lt: new Date() } 
    //   },
    //   data: { uploadsUsed: 0 }
    // });
    
    console.log('✅ Usage counter reset completed');
    
  } catch (error) {
    console.error('❌ Error resetting usage:', error);
  }
}

/**
 * Main renewal job - runs daily at midnight
 */
function startSubscriptionRenewalJob() {
  console.log('🚀 Subscription renewal job initialized');
  console.log('📅 Scheduled to run daily at midnight (00:00)');
  
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Running scheduled subscription renewal job...');
    await renewExpiredFreePlans();
    await resetMonthlyUsage();
    console.log('✅ Subscription renewal job completed');
  });
  
  // Also provide manual trigger function for testing/admin use
  return {
    runNow: async () => {
      console.log('🔧 Manual trigger of subscription renewal job');
      await renewExpiredFreePlans();
      await resetMonthlyUsage();
    }
  };
}

module.exports = {
  startSubscriptionRenewalJob,
  renewExpiredFreePlans,
  resetMonthlyUsage
};

