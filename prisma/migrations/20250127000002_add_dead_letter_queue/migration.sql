-- CreateTable: Dead Letter Queue
CREATE TABLE "dead_letter_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_event_id" UUID NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "error_category" VARCHAR(50) NOT NULL,
    "error_message" TEXT NOT NULL,
    "final_attempt" INTEGER NOT NULL,
    "raw_payload" JSONB,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" VARCHAR(255),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dead_letter_queue_webhook_event_id_key" ON "dead_letter_queue"("webhook_event_id");

-- CreateIndex
CREATE INDEX "dead_letter_queue_event_type_idx" ON "dead_letter_queue"("event_type");

-- CreateIndex
CREATE INDEX "dead_letter_queue_error_category_idx" ON "dead_letter_queue"("error_category");

-- CreateIndex
CREATE INDEX "dead_letter_queue_resolved_created_at_idx" ON "dead_letter_queue"("resolved", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dead_letter_queue_created_at_idx" ON "dead_letter_queue"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "dead_letter_queue" 
  ADD CONSTRAINT "dead_letter_queue_webhook_event_id_fkey" 
  FOREIGN KEY ("webhook_event_id") 
  REFERENCES "webhook_events"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

