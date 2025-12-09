/**
 * Webhook Audit Service
 * Provides comprehensive audit logging for webhook events
 * 
 * @module Webhooks
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

export interface AuditLogEntry {
  action: string;
  eventId: string;
  eventType: string;
  status: 'success' | 'failure' | 'duplicate' | 'retry';
  processingTimeMs: number;
  metadata?: Record<string, unknown>;
  error?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class WebhookAuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log webhook event processing
   */
  async logWebhookProcessing(
    event: Stripe.Event,
    result: {
      success: boolean;
      duplicate: boolean;
      processingTimeMs: number;
      error?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      action: 'webhook_processed',
      eventId: event.id,
      eventType: event.type,
      status: result.duplicate
        ? 'duplicate'
        : result.success
        ? 'success'
        : 'failure',
      processingTimeMs: result.processingTimeMs,
      metadata: this.extractEventMetadata(event),
      error: result.error,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    };

    // Log to console with structured format
    this.logToConsole(logEntry);

    // In production, you might also want to:
    // - Send to external logging service (Datadog, CloudWatch, etc.)
    // - Store in separate audit table
    // - Send to monitoring/alerting system
  }

  /**
   * Log webhook validation failure
   */
  async logValidationFailure(
    eventId: string | null,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      action: 'webhook_validation_failed',
      eventId: eventId || 'unknown',
      eventType: 'unknown',
      status: 'failure',
      processingTimeMs: 0,
      error: reason,
      ipAddress,
      timestamp: new Date(),
    };

    this.logToConsole(logEntry);
  }

  /**
   * Log webhook signature verification failure
   */
  async logSignatureFailure(
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      action: 'webhook_signature_failed',
      eventId: 'unknown',
      eventType: 'unknown',
      status: 'failure',
      processingTimeMs: 0,
      error: reason,
      ipAddress,
      timestamp: new Date(),
    };

    this.logToConsole(logEntry);
  }

  /**
   * Extract metadata from Stripe event for logging
   */
  private extractEventMetadata(event: Stripe.Event): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      apiVersion: event.api_version,
      created: event.created,
      livemode: event.livemode,
    };

    const obj = event.data.object as Record<string, unknown>;

    // Extract relevant IDs
    if (obj.customer) {
      metadata.customerId = obj.customer;
    }

    if (obj.id && typeof obj.id === 'string') {
      if (obj.id.startsWith('sub_')) {
        metadata.subscriptionId = obj.id;
      } else if (obj.id.startsWith('in_')) {
        metadata.invoiceId = obj.id;
      }
    }

    // Extract user ID from metadata
    if (obj.metadata && typeof obj.metadata === 'object') {
      const eventMetadata = obj.metadata as Record<string, unknown>;
      if (eventMetadata.userId) {
        metadata.userId = eventMetadata.userId;
      }
    }

    return metadata;
  }

  /**
   * Log to console with structured format
   * In production, replace with proper logging library (Winston, Pino, etc.)
   */
  private logToConsole(entry: AuditLogEntry): void {
    const logLevel = entry.status === 'success' ? 'INFO' : 'ERROR';
    const logMessage = {
      level: logLevel,
      action: entry.action,
      eventId: entry.eventId,
      eventType: entry.eventType,
      status: entry.status,
      processingTimeMs: entry.processingTimeMs,
      timestamp: entry.timestamp.toISOString(),
      ...(entry.error && { error: entry.error }),
      ...(entry.metadata && { metadata: entry.metadata }),
      ...(entry.ipAddress && { ipAddress: entry.ipAddress }),
    };

    if (entry.status === 'success') {
      console.log('📝 [WEBHOOK_AUDIT]', JSON.stringify(logMessage));
    } else {
      console.error('❌ [WEBHOOK_AUDIT]', JSON.stringify(logMessage));
    }
  }

  /**
   * Get audit logs for an event
   * This would query your audit log storage (database, external service, etc.)
   */
  async getAuditLogs(eventId: string): Promise<AuditLogEntry[]> {
    // Implementation depends on where you store audit logs
    // For now, return empty array - implement based on your logging strategy
    return [];
  }
}

