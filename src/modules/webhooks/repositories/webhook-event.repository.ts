/**
 * Webhook Event Repository
 * Data access layer for webhook events with transaction support
 * 
 * @module Webhooks
 */

import { PrismaClient, WebhookEventStatus, Prisma } from '@prisma/client';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { CreateWebhookEventDto, UpdateWebhookEventDto } from '../dto/webhook-event.dto';

export class WebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find webhook event by idempotency key
   * Uses SELECT FOR UPDATE to prevent race conditions
   */
  async findByIdempotencyKey(
    idempotencyKey: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent | null> {
    const client = tx || this.prisma;
    
    // Use Prisma's queryRaw with proper typing
    const result = await client.$queryRawUnsafe<Array<{
      id: string;
      idempotency_key: string;
      event_id: string;
      event_type: string;
      processed: boolean;
      processed_at: Date | null;
      processing_time_ms: number | null;
      error_message: string | null;
      retry_count: number;
      max_retries: number;
      status: string;
      raw_payload: unknown;
      metadata: unknown;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
      updated_at: Date;
    }>>(
      `SELECT * FROM webhook_events 
       WHERE idempotency_key = $1 
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      idempotencyKey
    );

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return new WebhookEvent({
      id: row.id,
      idempotencyKey: row.idempotency_key,
      eventId: row.event_id,
      eventType: row.event_type,
      processed: row.processed,
      processedAt: row.processed_at || undefined,
      processingTimeMs: row.processing_time_ms || undefined,
      errorMessage: row.error_message || undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      status: row.status as WebhookEventStatus,
      rawPayload: row.raw_payload as Record<string, unknown> | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * Find webhook event by Stripe event ID
   */
  async findByEventId(
    eventId: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent | null> {
    const client = tx || this.prisma;
    
    const result = await client.webhookEvent.findUnique({
      where: { eventId },
    });

    if (!result) {
      return null;
    }

    return new WebhookEvent(result);
  }

  /**
   * Create webhook event with transaction support
   */
  async create(
    data: CreateWebhookEventDto,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    const client = tx || this.prisma;
    
    const result = await client.webhookEvent.create({
      data: {
        idempotencyKey: data.idempotencyKey,
        eventId: data.eventId,
        eventType: data.eventType,
        rawPayload: data.rawPayload as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: WebhookEventStatus.PENDING,
      },
    });

    return new WebhookEvent(result);
  }

  /**
   * Update webhook event with transaction support
   */
  async update(
    id: string,
    data: UpdateWebhookEventDto,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    const client = tx || this.prisma;
    
    const result = await client.webhookEvent.update({
      where: { id },
      data: {
        processed: data.processed,
        status: data.status,
        processingTimeMs: data.processingTimeMs,
        errorMessage: data.errorMessage,
        retryCount: data.retryCount,
        processedAt: data.processed ? new Date() : undefined,
      },
    });

    return new WebhookEvent(result);
  }

  /**
   * Mark event as processing
   */
  async markAsProcessing(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    return this.update(
      id,
      {
        status: WebhookEventStatus.PROCESSING,
        processed: false,
      },
      tx
    );
  }

  /**
   * Mark event as completed
   */
  async markAsCompleted(
    id: string,
    processingTimeMs: number,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    return this.update(
      id,
      {
        processed: true,
        status: WebhookEventStatus.COMPLETED,
        processingTimeMs,
        processedAt: new Date(),
      },
      tx
    );
  }

  /**
   * Mark event as failed
   */
  async markAsFailed(
    id: string,
    errorMessage: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    return this.update(
      id,
      {
        status: WebhookEventStatus.FAILED,
        errorMessage,
        processed: false,
      },
      tx
    );
  }

  /**
   * Increment retry count
   */
  async incrementRetry(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent> {
    const event = await this.findById(id, tx);
    if (!event) {
      throw new Error(`Webhook event ${id} not found`);
    }

    const newRetryCount = event.retryCount + 1;
    const status =
      newRetryCount >= event.maxRetries
        ? WebhookEventStatus.DEAD_LETTER
        : WebhookEventStatus.RETRYING;

    return this.update(
      id,
      {
        retryCount: newRetryCount,
        status,
      },
      tx
    );
  }

  /**
   * Find by ID
   */
  async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<WebhookEvent | null> {
    const client = tx || this.prisma;
    
    const result = await client.webhookEvent.findUnique({
      where: { id },
    });

    if (!result) {
      return null;
    }

    return new WebhookEvent(result);
  }

  /**
   * Get events that need retry
   */
  async findEventsForRetry(limit = 10): Promise<WebhookEvent[]> {
    // Use raw query for complex condition
    const results = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      idempotency_key: string;
      event_id: string;
      event_type: string;
      processed: boolean;
      processed_at: Date | null;
      processing_time_ms: number | null;
      error_message: string | null;
      retry_count: number;
      max_retries: number;
      status: string;
      raw_payload: unknown;
      metadata: unknown;
      ip_address: string | null;
      user_agent: string | null;
      created_at: Date;
      updated_at: Date;
    }>>(
      `SELECT * FROM webhook_events 
       WHERE status = 'FAILED' 
         AND retry_count < max_retries
         AND created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY created_at ASC
       LIMIT $1`,
      limit
    );

    return results.map((row) => new WebhookEvent({
      id: row.id,
      idempotencyKey: row.idempotency_key,
      eventId: row.event_id,
      eventType: row.event_type,
      processed: row.processed,
      processedAt: row.processed_at || undefined,
      processingTimeMs: row.processing_time_ms || undefined,
      errorMessage: row.error_message || undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      status: row.status as WebhookEventStatus,
      rawPayload: row.raw_payload as Record<string, unknown> | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

