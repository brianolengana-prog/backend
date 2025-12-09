# Phase 1: Webhook Security + Idempotency Implementation

## ✅ Implementation Complete

This document describes the enterprise-grade webhook idempotency and security implementation.

## 📋 What Was Implemented

### 1. Database Schema
- **Table:** `webhook_events`
- **Features:**
  - Idempotency key (unique constraint)
  - Event ID (unique constraint)
  - Processing status tracking
  - Retry count and max retries
  - Error message storage
  - Raw payload storage (JSONB)
  - Metadata extraction
  - IP address and user agent tracking
  - Comprehensive indexes for performance

### 2. Core Components

#### Entities
- `WebhookEvent` - Domain entity with business logic methods

#### DTOs
- `CreateWebhookEventDto` - Input validation for creating events
- `UpdateWebhookEventDto` - Input validation for updating events
- `WebhookProcessingResultDto` - Response structure

#### Repository
- `WebhookEventRepository` - Data access layer with:
  - Transaction support
  - Row-level locking (`SELECT FOR UPDATE SKIP LOCKED`)
  - Idempotency key lookup
  - Event status management

#### Services
- `WebhookIdempotencyService` - Core idempotency logic:
  - Transaction-safe processing
  - Duplicate detection
  - Retry logic
  - Dead letter queue support

- `WebhookAuditService` - Comprehensive audit logging:
  - Structured logging
  - Event metadata extraction
  - Validation failure logging
  - Signature failure logging

- `WebhookProcessorService` - Main orchestration service:
  - Signature verification
  - Replay protection (5-minute window)
  - Event processing coordination
  - Error handling

### 3. Security Features

✅ **Idempotency Protection**
- Prevents duplicate webhook processing
- Uses database-level unique constraints
- Row-level locking prevents race conditions

✅ **Replay Protection**
- Rejects events older than 5 minutes
- Prevents replay attacks

✅ **Signature Verification**
- Validates Stripe webhook signatures
- Rejects invalid signatures immediately

✅ **Transaction Safety**
- Uses PostgreSQL transactions (Serializable isolation)
- Atomic operations prevent partial state

✅ **Audit Logging**
- All webhook events logged
- Structured logging format
- Error tracking

## 🚀 Usage

### Running the Migration

```bash
cd /home/bkg/parrot/node/backend
npx prisma migrate deploy
# Or for development:
npx prisma migrate dev
```

### Webhook Endpoint

The webhook endpoint is now at:
- **POST** `/api/stripe/webhook`

It automatically:
1. Verifies Stripe signature
2. Checks for duplicate events (idempotency)
3. Processes event in transaction
4. Logs audit trail
5. Returns appropriate response

### Status Endpoint

Check webhook processing status:
- **GET** `/api/stripe/webhook/status/:eventId`

## 📊 Database Schema

```sql
CREATE TABLE "webhook_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "idempotency_key" VARCHAR(255) UNIQUE NOT NULL,
    "event_id" VARCHAR(255) UNIQUE NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMPTZ(6),
    "processing_time_ms" INTEGER,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "status" webhook_event_status NOT NULL DEFAULT 'PENDING',
    "raw_payload" JSONB,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security Best Practices Implemented

1. **Idempotency Keys**: `eventId_eventType` format ensures uniqueness
2. **Row-Level Locking**: `SELECT FOR UPDATE SKIP LOCKED` prevents race conditions
3. **Transaction Isolation**: Serializable isolation level ensures consistency
4. **Replay Protection**: 5-minute window prevents old event replay
5. **Audit Trail**: Complete logging of all webhook processing
6. **Error Handling**: Proper error classification and retry logic

## 📈 Performance Optimizations

- Indexed on `idempotency_key`, `event_id`, `event_type`
- Indexed on `processed` and `status` for query performance
- Indexed on `created_at` for time-based queries
- `SKIP LOCKED` prevents blocking on concurrent requests

## 🧪 Testing Recommendations

1. **Idempotency Test**: Send same webhook twice, verify only processed once
2. **Concurrency Test**: Send same webhook from multiple sources simultaneously
3. **Replay Test**: Send old webhook (>5 minutes), verify rejection
4. **Retry Test**: Simulate failure, verify retry logic
5. **Transaction Test**: Simulate database failure mid-processing

## 📝 Next Steps (Phase 2)

- [ ] Add retry job scheduler
- [ ] Implement dead letter queue processing
- [ ] Add webhook event dashboard
- [ ] Implement rate limiting
- [ ] Add IP whitelisting
- [ ] Set up monitoring/alerting

## 🔧 Configuration

Ensure these environment variables are set:
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret
- `DATABASE_URL` - PostgreSQL connection string

## 📚 Code Structure

```
src/modules/webhooks/
├── entities/
│   └── webhook-event.entity.ts
├── dto/
│   └── webhook-event.dto.ts
├── repositories/
│   └── webhook-event.repository.ts
├── services/
│   ├── webhook-idempotency.service.ts
│   ├── webhook-audit.service.ts
│   └── webhook-processor.service.ts
└── index.ts
```

## ✅ Checklist

- [x] Database migration created
- [x] Prisma schema updated
- [x] Entity classes created
- [x] DTOs with validation
- [x] Repository with transaction support
- [x] Idempotency service
- [x] Audit service
- [x] Webhook processor service
- [x] Route updated to use new services
- [x] Replay protection implemented
- [x] Error handling implemented
- [x] Documentation created

