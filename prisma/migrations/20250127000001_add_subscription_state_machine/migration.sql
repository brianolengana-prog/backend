-- CreateEnum
CREATE TYPE "subscription_state" AS ENUM (
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'PENDING_CANCELLATION'
);

-- AlterTable: Update subscriptions table to use enum
ALTER TABLE "subscriptions" 
  ALTER COLUMN "status" TYPE "subscription_state" 
  USING CASE 
    WHEN "status" = 'incomplete' THEN 'INCOMPLETE'::subscription_state
    WHEN "status" = 'incomplete_expired' THEN 'INCOMPLETE_EXPIRED'::subscription_state
    WHEN "status" = 'trialing' THEN 'TRIALING'::subscription_state
    WHEN "status" = 'active' THEN 'ACTIVE'::subscription_state
    WHEN "status" = 'past_due' THEN 'PAST_DUE'::subscription_state
    WHEN "status" = 'canceled' THEN 'CANCELED'::subscription_state
    WHEN "status" = 'unpaid' THEN 'UNPAID'::subscription_state
    ELSE 'INCOMPLETE'::subscription_state
  END;

ALTER TABLE "subscriptions" 
  ALTER COLUMN "status" SET DEFAULT 'INCOMPLETE';

-- CreateTable: Subscription state transitions audit
CREATE TABLE "subscription_state_transitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "from_state" "subscription_state" NOT NULL,
    "to_state" "subscription_state" NOT NULL,
    "trigger" VARCHAR(100) NOT NULL,
    "trigger_id" VARCHAR(255),
    "reason" TEXT,
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_state_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_state_transitions_subscription_id_created_at_idx" 
  ON "subscription_state_transitions"("subscription_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "subscription_state_transitions_from_state_to_state_idx" 
  ON "subscription_state_transitions"("from_state", "to_state");

-- CreateIndex
CREATE INDEX "subscription_state_transitions_trigger_idx" 
  ON "subscription_state_transitions"("trigger");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" 
  ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_status_idx" 
  ON "subscriptions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "subscription_state_transitions" 
  ADD CONSTRAINT "subscription_state_transitions_subscription_id_fkey" 
  FOREIGN KEY ("subscription_id") 
  REFERENCES "subscriptions"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

