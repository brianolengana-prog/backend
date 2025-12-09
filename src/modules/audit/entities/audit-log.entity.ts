/**
 * Audit Log Entity
 * Domain entity for audit logs
 * 
 * @module Audit
 */

export enum AuditAction {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',

  // Webhooks
  WEBHOOK_RECEIVED = 'webhook_received',
  WEBHOOK_PROCESSED = 'webhook_processed',
  WEBHOOK_FAILED = 'webhook_failed',

  // Subscriptions
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_UPDATED = 'subscription_updated',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  PAYMENT_PROCESSED = 'payment_processed',
  PAYMENT_FAILED = 'payment_failed',

  // Data Access
  DATA_ACCESSED = 'data_accessed',
  DATA_MODIFIED = 'data_modified',
  DATA_DELETED = 'data_deleted',

  // Security
  SECURITY_VIOLATION = 'security_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  IP_BLOCKED = 'ip_blocked',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',

  // System
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGE = 'configuration_change',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditLogMetadata {
  [key: string]: unknown;
}

export class AuditLog {
  id: string;
  userId?: string;
  action: AuditAction;
  severity: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: AuditLogMetadata;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;

  constructor(partial: Partial<AuditLog>) {
    Object.assign(this, partial);
  }

  /**
   * Check if audit log is critical
   */
  isCritical(): boolean {
    return this.severity === AuditSeverity.CRITICAL;
  }

  /**
   * Check if audit log indicates failure
   */
  isFailure(): boolean {
    return !this.success || !!this.errorMessage;
  }
}

