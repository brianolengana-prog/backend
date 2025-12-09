/**
 * Webhook Event DTOs
 * Data Transfer Objects for webhook processing
 * 
 * @module Webhooks
 */

import { IsString, IsOptional, IsObject, IsEnum, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { WebhookEventStatus } from '@prisma/client';

export class CreateWebhookEventDto {
  @IsString()
  idempotencyKey: string;

  @IsString()
  eventId: string;

  @IsString()
  eventType: string;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class UpdateWebhookEventDto {
  @IsOptional()
  @IsBoolean()
  processed?: boolean;

  @IsOptional()
  @IsEnum(WebhookEventStatus)
  status?: WebhookEventStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  processingTimeMs?: number;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  retryCount?: number;
}

export class WebhookProcessingResultDto {
  success: boolean;
  duplicate: boolean;
  eventId: string;
  idempotencyKey: string;
  processingTimeMs: number;
  error?: string;
}

