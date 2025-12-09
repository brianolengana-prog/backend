/**
 * Audit Log Repository
 * Data access layer for audit logs
 * 
 * @module Audit
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { AuditLog, AuditAction, AuditSeverity } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  userId?: string;
  action: AuditAction;
  severity: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create audit log entry
   */
  async create(data: CreateAuditLogDto): Promise<AuditLog> {
    const result = await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        severity: data.severity,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata as Prisma.InputJsonValue,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });

    return new AuditLog(result);
  }

  /**
   * Find audit logs by query
   */
  async findMany(query: AuditLogQuery): Promise<AuditLog[]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const results = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });

    return results.map((r) => new AuditLog(r));
  }

  /**
   * Get audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    const result = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    return result ? new AuditLog(result) : null;
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byAction: Record<string, number>;
    bySeverity: Record<string, number>;
    failures: number;
    successes: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
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
      }, {} as Record<string, number>),
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {} as Record<string, number>),
      failures,
      successes,
    };
  }
}

