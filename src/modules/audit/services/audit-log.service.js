/**
 * Audit Log Service (JavaScript version for Express)
 * Centralized audit logging service
 * 
 * @module Audit
 */

const { PrismaClient } = require('@prisma/client');
const { LogSanitizerService } = require('../../security/services/log-sanitizer.service');

// Import enums (will need to be converted to strings for JS)
const AuditAction = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  WEBHOOK_RECEIVED: 'webhook_received',
  WEBHOOK_PROCESSED: 'webhook_processed',
  WEBHOOK_FAILED: 'webhook_failed',
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPDATED: 'subscription_updated',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  PAYMENT_PROCESSED: 'payment_processed',
  PAYMENT_FAILED: 'payment_failed',
  DATA_ACCESSED: 'data_accessed',
  DATA_MODIFIED: 'data_modified',
  DATA_DELETED: 'data_deleted',
  SECURITY_VIOLATION: 'security_violation',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  IP_BLOCKED: 'ip_blocked',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SYSTEM_ERROR: 'system_error',
  CONFIGURATION_CHANGE: 'configuration_change',
};

const AuditSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

class AuditLogRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create(data) {
    const result = await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        severity: data.severity,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });

    return result;
  }

  async findMany(query) {
    const where = {};

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.severity) where.severity = query.severity;
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });
  }

  async getStatistics(startDate, endDate) {
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, failures, successes, byAction, bySeverity] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({ where: { ...where, success: false } }),
      this.prisma.auditLog.count({ where: { ...where, success: true } }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      byAction: byAction.reduce((acc, item) => {
        acc[item.action] = item._count;
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {}),
      failures,
      successes,
    };
  }
}

class AuditLogService {
  constructor(prisma) {
    this.prisma = prisma;
    this.repository = new AuditLogRepository(prisma);
    this.sanitizer = new LogSanitizerService();
  }

  async log(data) {
    // Sanitize metadata
    const sanitizedMetadata = data.metadata
      ? this.sanitizer.sanitizeObject(data.metadata, {
          removeSensitiveFields: false,
          maskSensitiveFields: true,
        })
      : undefined;

    // Create audit log
    const auditLog = await this.repository.create({
      ...data,
      metadata: sanitizedMetadata,
    });

    // Log to console (sanitized)
    this.logToConsole(auditLog);

    return auditLog;
  }

  async logAuth(action, userId, success, ipAddress, userAgent, errorMessage) {
    return this.log({
      userId,
      action,
      severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      resourceType: 'user',
      resourceId: userId,
      ipAddress,
      userAgent,
      success,
      errorMessage,
    });
  }

  async logWebhook(action, eventId, eventType, success, ipAddress, userAgent, errorMessage, metadata) {
    return this.log({
      action,
      severity: success ? AuditSeverity.LOW : AuditSeverity.HIGH,
      resourceType: 'webhook',
      resourceId: eventId,
      ipAddress,
      userAgent,
      metadata: {
        eventType,
        ...metadata,
      },
      success,
      errorMessage,
    });
  }

  async logSecurity(action, severity, userId, ipAddress, userAgent, metadata) {
    return this.log({
      userId,
      action,
      severity,
      resourceType: 'security',
      ipAddress,
      userAgent,
      metadata,
      success: false,
    });
  }

  async logSubscription(action, subscriptionId, userId, success, metadata) {
    return this.log({
      userId,
      action,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'subscription',
      resourceId: subscriptionId,
      metadata,
      success,
    });
  }

  async query(query) {
    return this.repository.findMany(query);
  }

  async getStatistics(startDate, endDate) {
    return this.repository.getStatistics(startDate, endDate);
  }

  logToConsole(auditLog) {
    const isCritical = auditLog.severity === AuditSeverity.CRITICAL;
    const isFailure = !auditLog.success || auditLog.errorMessage;
    const logLevel = isCritical ? 'ERROR' : isFailure ? 'WARN' : 'INFO';

    const logMessage = {
      level: logLevel,
      action: auditLog.action,
      severity: auditLog.severity,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      success: auditLog.success,
      timestamp: auditLog.createdAt.toISOString(),
      ...(auditLog.userId && { userId: auditLog.userId }),
      ...(auditLog.ipAddress && { ipAddress: auditLog.ipAddress }),
      ...(auditLog.errorMessage && { error: auditLog.errorMessage }),
      ...(auditLog.metadata && { metadata: auditLog.metadata }),
    };

    if (logLevel === 'ERROR') {
      console.error('📋 [AUDIT]', JSON.stringify(logMessage));
    } else if (logLevel === 'WARN') {
      console.warn('📋 [AUDIT]', JSON.stringify(logMessage));
    } else {
      console.log('📋 [AUDIT]', JSON.stringify(logMessage));
    }
  }
}

module.exports = {
  AuditLogService,
  AuditAction,
  AuditSeverity,
};

