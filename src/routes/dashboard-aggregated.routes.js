/**
 * Aggregated Dashboard Routes
 * Single endpoint for all dashboard data (performance optimization)
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/database').getClient();
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/dashboard/all
 * Returns all dashboard data in a single request
 * - User subscription info
 * - Usage stats
 * - Contact stats
 * - Recent activity
 * - Recent contacts (limited)
 * - Recent jobs (limited)
 */
router.get('/all', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    logger.info('📊 Fetching aggregated dashboard data', { userId });
    
    const startTime = Date.now();
    
    // Run all queries in parallel for maximum performance
    const [
      subscription,
      usage,
      contactStats,
      recentContacts,
      recentJobs,
      recentActivity
    ] = await Promise.all([
      // Subscription info
      getSubscriptionInfo(userId),
      
      // Usage stats
      getUsageStats(userId),
      
      // Contact stats
      getContactStats(userId),
      
      // Recent contacts (last 50)
      prisma.contact.findMany({
        where: { userId },
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          company: true,
          jobId: true,
          createdAt: true
        }
      }),
      
      // Recent jobs (last 20)
      prisma.job.findMany({
        where: { userId },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          fileName: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              contacts: true
            }
          }
        }
      }),
      
      // Recent activity
      getRecentActivity(userId)
    ]);
    
    const processingTime = Date.now() - startTime;
    
    logger.info('✅ Aggregated dashboard data fetched', {
      userId,
      processingTime: `${processingTime}ms`,
      contactsCount: recentContacts.length,
      jobsCount: recentJobs.length
    });
    
    res.json({
      success: true,
      data: {
        subscription,
        usage,
        stats: contactStats,
        contacts: recentContacts,
        jobs: recentJobs,
        recentActivity
      },
      meta: {
        fetchTime: processingTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('❌ Error fetching aggregated dashboard data', {
      userId: req.user.userId,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get subscription info
 */
async function getSubscriptionInfo(userId) {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      select: {
        status: true,
        priceId: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true
      }
    });
    
    return subscription || {
      status: 'free',
      priceId: 'free',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false
    };
  } catch (error) {
    logger.warn('⚠️ Error fetching subscription', { userId, error: error.message });
    return null;
  }
}

/**
 * Get usage stats
 */
async function getUsageStats(userId) {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const usage = await prisma.usage.findUnique({
      where: {
        userId_month: {
          userId,
          month: currentMonth
        }
      },
      select: {
        jobsProcessed: true,
        contactsExtracted: true,
        apiCalls: true
      }
    });
    
    return usage || {
      jobsProcessed: 0,
      contactsExtracted: 0,
      apiCalls: 0
    };
  } catch (error) {
    logger.warn('⚠️ Error fetching usage stats', { userId, error: error.message });
    return {
      jobsProcessed: 0,
      contactsExtracted: 0,
      apiCalls: 0
    };
  }
}

/**
 * Get contact stats
 */
async function getContactStats(userId) {
  try {
    const [
      totalContacts,
      recentContacts,
      jobsWithContacts,
      contactsWithEmail,
      contactsWithPhone
    ] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      
      prisma.contact.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      }),
      
      prisma.job.count({
        where: {
          userId,
          contacts: {
            some: {}
          }
        }
      }),
      
      prisma.contact.count({
        where: {
          userId,
          email: {
            not: null
          }
        }
      }),
      
      prisma.contact.count({
        where: {
          userId,
          phone: {
            not: null
          }
        }
      })
    ]);
    
    return {
      totalContacts,
      recentContacts,
      jobsWithContacts,
      avgContactsPerJob: jobsWithContacts > 0 ? Math.round(totalContacts / jobsWithContacts) : 0,
      withEmail: contactsWithEmail,
      withPhone: contactsWithPhone,
      completeness: totalContacts > 0 
        ? Math.round(((contactsWithEmail + contactsWithPhone) / (totalContacts * 2)) * 100)
        : 0
    };
  } catch (error) {
    logger.warn('⚠️ Error fetching contact stats', { userId, error: error.message });
    return {
      totalContacts: 0,
      recentContacts: 0,
      jobsWithContacts: 0,
      avgContactsPerJob: 0,
      withEmail: 0,
      withPhone: 0,
      completeness: 0
    };
  }
}

/**
 * Get recent activity
 */
async function getRecentActivity(userId) {
  try {
    const recentJobs = await prisma.job.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileName: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            contacts: true
          }
        }
      }
    });
    
    const activities = recentJobs.map(job => {
      let message = '';
      let type = 'upload';
      let status = 'success';
      const contactsCount = job._count.contacts;
      
      if (job.status === 'COMPLETED') {
        if (contactsCount > 0) {
          message = `${contactsCount} contact${contactsCount === 1 ? '' : 's'} extracted from ${job.fileName || 'call sheet'}`;
          type = 'contacts';
        } else {
          message = `Call sheet processed but no contacts found`;
          type = 'processing';
          status = 'warning';
        }
      } else if (job.status === 'FAILED') {
        message = `Extraction failed for ${job.fileName || 'call sheet'}`;
        type = 'error';
        status = 'error';
      } else if (job.status === 'PROCESSING') {
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
    
    return activities;
  } catch (error) {
    logger.warn('⚠️ Error fetching recent activity', { userId, error: error.message });
    return [];
  }
}

module.exports = router;

