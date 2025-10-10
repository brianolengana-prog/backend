# Prisma Migration Fix Guide

## 🐛 The Error

```
Error: P3018
Migration name: 20251008124648_add_file_hash_duplication
Database error: ERROR: relation "Job" does not exist
```

## 🔍 The Problem

The migration file was using `"Job"` (capitalized - Prisma model name) instead of `"jobs"` (lowercase - actual PostgreSQL table name).

In Prisma, the model is called `Job` but it maps to the database table `jobs` via:
```prisma
model Job {
  // ...
  @@map("jobs")
}
```

## ✅ The Fix Applied

I've corrected the migration file:

**File**: `prisma/migrations/20251008124648_add_file_hash_duplication/migration.sql`

**Changed all instances**:
- `"Job"` → `"jobs"` ✅

The migration now correctly references the actual table name.

---

## 🚀 How to Apply the Fix

### Option 1: Reset and Re-run Migrations (Clean Slate)

```bash
cd /home/bkg/parrot/node/backend

# Reset database (WARNING: Deletes all data!)
npx prisma migrate reset --force

# This will:
# 1. Drop all tables
# 2. Re-run all migrations (including the fixed one)
# 3. Regenerate Prisma client
```

### Option 2: Mark Migration as Applied (If Already Partially Applied)

```bash
cd /home/bkg/parrot/node/backend

# Mark the problematic migration as resolved
npx prisma migrate resolve --applied 20251008124648_add_file_hash_duplication

# Then run any pending migrations
npx prisma migrate deploy
```

### Option 3: Manual SQL Fix (Safest for Production)

If you want to keep existing data, run this SQL manually:

```sql
-- Add columns if they don't exist
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "file_hash" VARCHAR(64);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS "jobs_user_id_file_hash_idx" ON "jobs"("user_id", "file_hash");
CREATE INDEX IF NOT EXISTS "jobs_user_id_status_created_at_idx" ON "jobs"("user_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "jobs_file_hash_created_at_idx" ON "jobs"("file_hash", "created_at" DESC);

-- Mark migration as applied
-- (Then use Option 2 above)
```

---

## 🧪 Verify the Fix

After running the migration, verify it worked:

```bash
# Check if columns exist
npx prisma db execute --stdin <<SQL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('file_hash', 'file_size');
SQL

# Should return:
# file_hash | character varying
# file_size | integer
```

---

## 📋 Step-by-Step Instructions

1. **Navigate to backend directory**:
   ```bash
   cd /home/bkg/parrot/node/backend
   ```

2. **Verify the migration file is fixed**:
   ```bash
   cat prisma/migrations/20251008124648_add_file_hash_duplication/migration.sql
   # Should say "jobs" not "Job"
   ```

3. **Reset and re-run migrations**:
   ```bash
   npx prisma migrate reset --force
   ```

4. **Verify success**:
   ```bash
   npx prisma migrate status
   # Should show all migrations applied
   ```

5. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

---

## ⚠️ Important Notes

### For Development:
- ✅ Safe to use `migrate reset` (will delete all data)
- ✅ Fresh start with all tables created correctly

### For Production:
- ❌ **DO NOT** use `migrate reset` (deletes all data!)
- ✅ Use Option 2 or 3 above
- ✅ Backup database first

---

## 🎯 After Migration is Fixed

Once migrations are successful, you can:

1. **Test the extraction fixes**:
   - Upload Sept 2025 Call Sheet.pdf
   - Should get 22 contacts (not 0)

2. **Verify database persistence**:
   - Check `jobs` table has records
   - Check `contacts` table has 22 records

---

## 📝 Summary

**What I Fixed**:
- ✅ Changed `"Job"` to `"jobs"` in migration file
- ✅ All 8 references corrected

**What You Need to Do**:
1. Run `npx prisma migrate reset --force` in `/home/bkg/parrot/node/backend`
2. Re-upload the PDF to test extraction
3. Verify 22 contacts are saved

**Expected Result**:
- Migration completes successfully
- Database tables created with `file_hash` and `file_size` columns
- Extraction works and saves 22 contacts

---

**Status**: ✅ **Migration file fixed**  
**Next**: Run migration reset to apply changes




