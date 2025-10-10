-- Clean up duplicate migration from _prisma_migrations table
-- This resolves the "migration file not found" error

-- Show current migrations
SELECT migration_name, started_at, finished_at, applied_steps_count 
FROM _prisma_migrations 
ORDER BY started_at DESC;

-- Delete the duplicate/problematic migration
DELETE FROM _prisma_migrations 
WHERE migration_name = 'add_file_hash_deduplication';

-- Show remaining migrations
SELECT migration_name, started_at, finished_at, applied_steps_count 
FROM _prisma_migrations 
ORDER BY started_at DESC;




