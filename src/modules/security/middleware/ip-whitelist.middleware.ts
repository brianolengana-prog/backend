/**
 * IP Whitelist Middleware
 * Restricts access to specific endpoints based on IP whitelist
 * 
 * @module Security
 */

import { Request, Response, NextFunction } from 'express';

export interface IPWhitelistConfig {
  allowedIPs: string[];
  allowPrivateIPs?: boolean;
  allowLocalhost?: boolean;
}

/**
 * Stripe webhook IP ranges (as of 2024)
 * These are the official Stripe IP ranges for webhooks
 */
export const STRIPE_WEBHOOK_IPS = [
  // Stripe webhook IPs (these should be updated from Stripe dashboard)
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
function getClientIP(req: Request): string {
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
function isPrivateIP(ip: string): boolean {
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
function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip === 'localhost' ||
         ip.startsWith('::ffff:127.0.0.1');
}

/**
 * IP whitelist middleware factory
 */
export function createIPWhitelistMiddleware(config: IPWhitelistConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = getClientIP(req);

    // Allow localhost if configured
    if (config.allowLocalhost && isLocalhost(clientIP)) {
      return next();
    }

    // Allow private IPs if configured
    if (config.allowPrivateIPs && isPrivateIP(clientIP)) {
      return next();
    }

    // Check if IP is in whitelist
    if (config.allowedIPs.includes(clientIP)) {
      return next();
    }

    // IP not whitelisted
    console.warn('🚫 IP whitelist blocked:', {
      ip: clientIP,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
    });

    res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'IP_NOT_WHITELISTED',
    });
  };
}

/**
 * Stripe webhook IP whitelist middleware
 */
export const stripeWebhookIPWhitelist = createIPWhitelistMiddleware({
  allowedIPs: STRIPE_WEBHOOK_IPS,
  allowPrivateIPs: process.env.NODE_ENV !== 'production', // Allow in dev
  allowLocalhost: process.env.NODE_ENV !== 'production', // Allow in dev
});

