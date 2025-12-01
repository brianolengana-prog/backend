-- Add performance indexes for contacts table
-- These indexes optimize the paginated queries with filtering and sorting

-- IMPORTANT: Enable pg_trgm extension FIRST before creating trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Basic indexes for filtering and foreign keys
CREATE INDEX IF NOT EXISTS "contacts_userId_idx" ON "contacts"("user_id");
CREATE INDEX IF NOT EXISTS "contacts_jobId_idx" ON "contacts"("job_id");
CREATE INDEX IF NOT EXISTS "contacts_role_idx" ON "contacts"("role");

-- Composite indexes for common query patterns (speeds up pagination)
CREATE INDEX IF NOT EXISTS "contacts_userId_createdAt_idx" ON "contacts"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "contacts_userId_role_idx" ON "contacts"("user_id", "role");
CREATE INDEX IF NOT EXISTS "contacts_userId_jobId_idx" ON "contacts"("user_id", "job_id");

-- Index for name sorting
CREATE INDEX IF NOT EXISTS "contacts_name_idx" ON "contacts"("name");

-- Text search indexes for fast ILIKE searches (now that pg_trgm is enabled)
-- Only create if columns are not null, otherwise PostgreSQL will complain
CREATE INDEX IF NOT EXISTS "contacts_name_text_idx" ON "contacts" USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS "contacts_email_text_idx" ON "contacts" USING gin(email gin_trgm_ops) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS "contacts_company_text_idx" ON "contacts" USING gin(company gin_trgm_ops) WHERE company IS NOT NULL;

-- Add comments to explain the optimization
COMMENT ON INDEX "contacts_userId_createdAt_idx" IS 'Optimizes paginated queries sorted by creation date';
COMMENT ON INDEX "contacts_name_text_idx" IS 'Optimizes text search on contact names using trigram matching';

