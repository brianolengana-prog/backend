/**
 * Dead Letter Queue Service
 * Manages failed webhook events that cannot be processed
 * 
 * @module Webhooks
 */

import { PrismaClient, Prisma } from '@prisma/client';
import Stripe from 'stripe';

export interface CreateDLQEntryDto {
  webhookEventId: string;
  eventId: string;
  eventType: string;
  errorCategory: string;
  errorMessage: string;
  finalAttempt: number;
  rawPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface DLQEntry {
  id: string;
  webhookEventId: string;
  eventId: string;
  eventType: string;
  errorCategory: string;
  errorMessage: string;
  finalAttempt: number;
  resolved: boolean;
  createdAt: Date;
}

export class DeadLetterQueueService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Add entry to dead letter queue
   */
  async addToDLQ(data: CreateDLQEntryDto): Promise<DLQEntry> {
    const entry = await this.prisma.deadLetterQueue.create({
      data: {
        webhookEventId: data.webhookEventId,
        eventId: data.eventId,
        eventType: data.eventType,
        errorCategory: data.errorCategory,
        errorMessage: data.errorMessage,
        finalAttempt: data.finalAttempt,
        rawPayload: data.rawPayload as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      select: {
        id: true,
        webhookEventId: true,
        eventId: true,
        eventType: true,
        errorCategory: true,
        errorMessage: true,
        finalAttempt: true,
        resolved: true,
        createdAt: true,
      },
    });

    console.error('📮 [DLQ] Added to dead letter queue:', {
      id: entry.id,
      eventId: entry.eventId,
      eventType: entry.eventType,
      errorCategory: entry.errorCategory,
      finalAttempt: entry.finalAttempt,
    });

    return entry;
  }

  /**
   * Get unresolved DLQ entries
   */
  async getUnresolvedEntries(limit = 50): Promise<DLQEntry[]> {
    const entries = await this.prisma.deadLetterQueue.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        webhookEventId: true,
        eventId: true,
        eventType: true,
        errorCategory: true,
        errorMessage: true,
        finalAttempt: true,
        resolved: true,
        createdAt: true,
      },
    });

    return entries;
  }

  /**
   * Get DLQ entry by ID
   */
  async getEntry(id: string) {
    return this.prisma.deadLetterQueue.findUnique({
      where: { id },
      include: {
        webhookEvent: true,
      },
    });
  }

  /**
   * Get DLQ statistics
   */
  async getStatistics(): Promise<{
    total: number;
    unresolved: number;
    resolved: number;
    byCategory: Record<string, number>;
    byEventType: Record<string, number>;
  }> {
    const [total, unresolved, resolved, byCategory, byEventType] = await Promise.all([
      this.prisma.deadLetterQueue.count(),
      this.prisma.deadLetterQueue.count({ where: { resolved: false } }),
      this.prisma.deadLetterQueue.count({ where: { resolved: true } }),
      this.prisma.deadLetterQueue.groupBy({
        by: ['errorCategory'],
        _count: true,
      }),
      this.prisma.deadLetterQueue.groupBy({
        by: ['eventType'],
        _count: true,
      }),
    ]);

    return {
      total,
      unresolved,
      resolved,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.errorCategory] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byEventType: byEventType.reduce((acc, item) => {
        acc[item.eventType] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Resolve DLQ entry (manual intervention)
   */
  async resolveEntry(
    id: string,
    resolvedBy: string,
    resolutionNotes?: string
  ): Promise<void> {
    await this.prisma.deadLetterQueue.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
      },
    });

    console.log('✅ [DLQ] Entry resolved:', { id, resolvedBy });
  }

  /**
   * Retry DLQ entry (manual retry)
   */
  async retryEntry(
    id: string,
    processor: (event: Stripe.Event) => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    const entry = await this.getEntry(id);

    if (!entry) {
      return { success: false, error: 'DLQ entry not found' };
    }

    if (!entry.rawPayload) {
      return { success: false, error: 'Raw payload not available' };
    }

    try {
      const event = entry.rawPayload as unknown as Stripe.Event;
      await processor(event);

      // Mark as resolved if successful
      await this.resolveEntry(id, 'system', 'Retry successful');

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete resolved entries older than specified days
   */
  async cleanupResolvedEntries(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.deadLetterQueue.deleteMany({
      where: {
        resolved: true,
        resolvedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`🧹 [DLQ] Cleaned up ${result.count} resolved entries older than ${olderThanDays} days`);

    return result.count;
  }
}

