/**
 * Webhooks Module
 * Enterprise-grade webhook processing with idempotency, state machine, retry, and DLQ
 * 
 * @module Webhooks
 */

// Entities
export { WebhookEvent } from './entities/webhook-event.entity';
export type { WebhookEventMetadata } from './entities/webhook-event.entity';

// DTOs
export { CreateWebhookEventDto, UpdateWebhookEventDto, WebhookProcessingResultDto } from './dto/webhook-event.dto';

// Repositories
export { WebhookEventRepository } from './repositories/webhook-event.repository';

// Services
export { WebhookIdempotencyService } from './services/webhook-idempotency.service';
export type { ProcessWebhookOptions, ProcessWebhookResult } from './services/webhook-idempotency.service';

export { WebhookAuditService } from './services/webhook-audit.service';
export type { AuditLogEntry } from './services/webhook-audit.service';

export { WebhookProcessorService } from './services/webhook-processor.service';
export type { ProcessWebhookRequest, ProcessWebhookResponse } from './services/webhook-processor.service';

export { WebhookErrorClassifierService } from './services/webhook-error-classifier.service';
export { ErrorCategory } from './services/webhook-error-classifier.service';
export type { ClassifiedError } from './services/webhook-error-classifier.service';

export { WebhookRetryService } from './services/webhook-retry.service';
export type { RetryConfig, RetryJobData } from './services/webhook-retry.service';

export { DeadLetterQueueService } from './services/dead-letter-queue.service';
export type { CreateDLQEntryDto, DLQEntry } from './services/dead-letter-queue.service';
