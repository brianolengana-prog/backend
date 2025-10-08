-- AlterTable: Add new columns for file deduplication
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "file_hash" VARCHAR(64);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;

-- CreateIndex: Add indexes for performance (IF NOT EXISTS for safety)
CREATE INDEX IF NOT EXISTS "jobs_user_id_file_hash_idx" ON "Job"("user_id", "file_hash");
CREATE INDEX IF NOT EXISTS "jobs_user_id_status_created_at_idx" ON "Job"("user_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "jobs_file_hash_created_at_idx" ON "Job"("file_hash", "created_at" DESC);
