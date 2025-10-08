-- Migration: Add file deduplication support
-- Adds file_hash and file_size columns to jobs table
-- Adds indexes for efficient deduplication queries

-- Add fileHash column
ALTER TABLE jobs ADD COLUMN file_hash VARCHAR(64);

-- Add fileSize column
ALTER TABLE jobs ADD COLUMN file_size INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN jobs.file_hash IS 'SHA-256 hash of file content for deduplication';
COMMENT ON COLUMN jobs.file_size IS 'File size in bytes';

-- Create indexes for efficient lookups
CREATE INDEX idx_jobs_user_file_hash ON jobs(user_id, file_hash);
CREATE INDEX idx_jobs_user_status_created ON jobs(user_id, status, created_at DESC);
CREATE INDEX idx_jobs_file_hash_created ON jobs(file_hash, created_at DESC);

-- Note: These indexes will significantly improve deduplication query performance
-- - idx_jobs_user_file_hash: Fast lookup for user's file hash
-- - idx_jobs_user_status_created: Efficient filtering by status and recent uploads
-- - idx_jobs_file_hash_created: Quick check for any duplicate files across all users

