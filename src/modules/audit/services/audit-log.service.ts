/**
 * Audit Log Service
 * Centralized audit logging service
 * 
 * @module Audit
 */

import { PrismaClient } from '@prisma/client';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditLog, AuditAction, AuditSeverity } from '../entities/audit-log.entity';
import { LogSanitizerService } from '../../security/services/log-sanitizer.service';
import type { CreateAuditLogDto, AuditLogQuery } from '../repositories/audit-log.repository';

export class AuditLogService {
  private repository: AuditLogRepository;
  private sanitizer: LogSanitizerService;

  constructor(private readonly prisma: PrismaClient) {
    this.repository = new AuditLogRepository(prisma);
    this.sanitizer = new LogSanitizerService();
  }

  /**
   * Log audit event
   */
  async log(data: CreateAuditLogDto): Promise<AuditLog> {
    // Sanitize metadata to remove sensitive data
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

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction.LOGIN | AuditAction.LOGOUT | AuditAction.REGISTER,
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<AuditLog> {
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

  /**
   * Log webhook event
   */
  async logWebhook(
    action: AuditAction.WEBHOOK_RECEIVED | AuditAction.WEBHOOK_PROCESSED | AuditAction.WEBHOOK_FAILED,
    eventId: string,
    eventType: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLog> {
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

  /**
   * Log security event
   */
  async logSecurity(
    action: AuditAction.SECURITY_VIOLATION | AuditAction.RATE_LIMIT_EXCEEDED | AuditAction.IP_BLOCKED | AuditAction.UNAUTHORIZED_ACCESS,
    severity: AuditSeverity,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>
  ): Promise<AuditLog> {
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

  /**
   * Log subscription event
   */
  async logSubscription(
    action: AuditAction.SUBSCRIPTION_CREATED | AuditAction.SUBSCRIPTION_UPDATED | AuditAction.SUBSCRIPTION_CANCELED,
    subscriptionId: string,
    userId: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<AuditLog> {
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

  /**
   * Query audit logs
   */
  async query(query: AuditLogQuery): Promise<AuditLog[]> {
    return this.repository.findMany(query);
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    return this.repository.getStatistics(startDate, endDate);
  }

  /**
   * Log to console (sanitized)
   */
  private logToConsole(auditLog: AuditLog): void {
    const logLevel = auditLog.isCritical()
      ? 'ERROR'
      : auditLog.isFailure()
      ? 'WARN'
      : 'INFO';

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

