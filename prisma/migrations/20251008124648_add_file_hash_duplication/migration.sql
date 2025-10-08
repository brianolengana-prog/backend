-- RenameIndex
ALTER INDEX "public"."idx_jobs_file_hash_created" RENAME TO "jobs_file_hash_created_at_idx";

-- RenameIndex
ALTER INDEX "public"."idx_jobs_user_file_hash" RENAME TO "jobs_user_id_file_hash_idx";

-- RenameIndex
ALTER INDEX "public"."idx_jobs_user_status_created" RENAME TO "jobs_user_id_status_created_at_idx";
