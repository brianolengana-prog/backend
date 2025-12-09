/**
 * IP Whitelist Middleware (JavaScript version for Express)
 * Restricts access to specific endpoints based on IP whitelist
 * 
 * @module Security
 */

/**
 * Stripe webhook IP ranges (as of 2024)
 * These are the official Stripe IP ranges for webhooks
 * Update from: https://stripe.com/docs/ips
 */
const STRIPE_WEBHOOK_IPS = [
  '3.18.12.63',
  '3.130.192.231',
  '13.235.14.237',
  '18.211.135.69',
  '35.154.171.200',
  '52.15.183.38',
  '54.187.174.169',
  '54.187.205.235',
  '54.187.216.72',
  '54.241.31.99',
  '54.241.31.102',
  '54.241.34.107',
];

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }

  // Check for real IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // Fallback to connection remote address
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Check if IP is in private range
 */
function isPrivateIP(ip) {
  // IPv4 private ranges
  if (ip.startsWith('10.') || 
      ip.startsWith('172.16.') || 
      ip.startsWith('192.168.') ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('::ffff:127.0.0.1')) {
    return true;
  }
  return false;
}

/**
 * Check if IP is localhost
 */
function isLocalhost(ip) {
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === 'localhost' ||
         ip.startsWith('::ffff:127.0.0.1');
}

/**
 * Stripe webhook IP whitelist middleware
 * Logs blocked IPs to audit log if available
 */
function stripeWebhookIPWhitelist(req, res, next) {
  const clientIP = getClientIP(req);
  const isProduction = process.env.NODE_ENV === 'production';

  // Allow localhost in development
  if (!isProduction && isLocalhost(clientIP)) {
    return next();
  }

  // Allow private IPs in development
  if (!isProduction && isPrivateIP(clientIP)) {
    return next();
  }

  // Check if IP is in Stripe whitelist
  if (STRIPE_WEBHOOK_IPS.includes(clientIP)) {
    return next();
  }

  // IP not whitelisted - log to audit if available
  console.warn('🚫 Stripe webhook blocked - IP not whitelisted:', {
    ip: clientIP,
    path: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
  });

  // Try to log to audit service (non-blocking)
  try {
    const { PrismaClient } = require('@prisma/client');
    const { AuditLogService } = require('../../audit/services/audit-log.service');
    const { AuditAction, AuditSeverity } = require('../../audit/entities/audit-log.entity');
    const prisma = new PrismaClient();
    const auditService = new AuditLogService(prisma);
    
    auditService.logSecurity(
      AuditAction.IP_BLOCKED,
      AuditSeverity.HIGH,
      undefined,
      clientIP,
      req.headers['user-agent'],
      { reason: 'IP not in Stripe whitelist', endpoint: '/api/stripe/webhook' }
    ).catch(err => console.error('Failed to log to audit:', err));
  } catch (e) {
    // Audit service not available - continue anyway
  }

  res.status(403).json({
    success: false,
    error: 'Access denied',
    code: 'IP_NOT_WHITELISTED',
  });
}

module.exports = {
  STRIPE_WEBHOOK_IPS,
  stripeWebhookIPWhitelist,
  getClientIP,
  isPrivateIP,
  isLocalhost,
};

