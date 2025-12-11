/**
 * Notification Service (backend)
 * Writes notifications into public.notifications (Supabase) using service role key.
 * Minimal, robust, and testable. If env is missing, it logs and no-ops.
 */

const fetch = global.fetch || require('node-fetch')
const { v4: uuidv4 } = require('uuid')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

class NotificationService {
  isConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  }

  async createNotification({
    userId,
    type,
    title,
    message,
    priority = 'medium',
    actionUrl,
    actionLabel,
    metadata = {}
  }) {
    if (!this.isConfigured()) {
      console.warn('⚠️ NotificationService not configured (SUPABASE env missing)')
      return
    }
    if (!userId) {
      console.warn('⚠️ NotificationService: missing userId')
      return
    }

    const payload = {
      id: uuidv4(),
      user_id: userId,
      type,
      title,
      message,
      priority,
      action_url: actionUrl,
      action_label: actionLabel,
      metadata,
      read: false
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('❌ Failed to create notification', response.status, text)
      }
    } catch (error) {
      console.error('❌ NotificationService error:', error)
    }
  }

  async notifyUsageThreshold(userId, usage) {
    if (!usage || !usage.uploadsLimit || usage.uploadsLimit <= 0) return
    const { uploadsUsed, uploadsLimit, planId } = usage
    const pct = (uploadsUsed / uploadsLimit) * 100

    if (pct >= 90 && pct < 100) {
      await this.createNotification({
        userId,
        type: 'usage',
        title: 'Upload Limit Warning',
        message: `You have used ${uploadsUsed} of ${uploadsLimit} uploads this month (${Math.round(pct)}%).`,
        priority: 'medium',
        actionUrl: '/billing',
        actionLabel: 'View Plan',
        metadata: { uploadsUsed, uploadsLimit, percentage: pct, planId }
      })
    } else if (pct >= 100) {
      await this.createNotification({
        userId,
        type: 'usage',
        title: 'Upload Limit Reached',
        message: `You reached your monthly upload limit of ${uploadsLimit}. Upgrade to continue processing.`,
        priority: 'high',
        actionUrl: '/billing',
        actionLabel: 'Upgrade Plan',
        metadata: { uploadsUsed, uploadsLimit, percentage: pct, planId }
      })
    }
  }

  async notifyExtractionComplete(userId, { jobId, fileName, contactsFound = 0, processingTime = 0, method = 'auto' }) {
    await this.createNotification({
      userId,
      type: 'extraction',
      title: 'Extraction Complete',
      message: `Processed ${fileName || 'call sheet'} with ${contactsFound} contacts.`,
      priority: 'low',
      actionUrl: jobId ? `/contacts?jobId=${jobId}` : '/contacts',
      actionLabel: 'View Contacts',
      metadata: { jobId, fileName, contactsFound, processingTime, method }
    })
  }

  async notifyExtractionFailed(userId, { jobId, fileName, errorMessage }) {
    await this.createNotification({
      userId,
      type: 'extraction',
      title: 'Extraction Failed',
      message: errorMessage || `Failed to process ${fileName || 'call sheet'}. Please try again.`,
      priority: 'medium',
      actionUrl: '/upload',
      actionLabel: 'Retry Upload',
      metadata: { jobId, fileName, errorMessage }
    })
  }

  async notifySubscriptionStatus(userId, { status, planId, renewalDate }) {
    if (!status) return
    if (status === 'active') {
      await this.createNotification({
        userId,
        type: 'billing',
        title: 'Subscription Activated',
        message: `Your ${planId || 'subscription'} is now active.`,
        priority: 'medium',
        actionUrl: '/billing',
        actionLabel: 'Manage Plan',
        metadata: { planId, renewalDate }
      })
    } else if (status === 'canceled' || status === 'canceled_at_period_end') {
      await this.createNotification({
        userId,
        type: 'billing',
        title: 'Subscription Canceled',
        message: `Your ${planId || 'subscription'} is canceled. Access until ${renewalDate ? new Date(renewalDate).toLocaleDateString() : 'end of period'}.`,
        priority: 'high',
        actionUrl: '/billing',
        actionLabel: 'Reactivate',
        metadata: { planId, renewalDate, status }
      })
    }
  }
}

module.exports = new NotificationService()




