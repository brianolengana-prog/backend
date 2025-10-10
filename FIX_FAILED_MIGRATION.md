# Fix Failed Migration - Complete Guide

## 🐛 Current Error

```
The `add_file_hash_deduplication` migration started at 2025-10-08 21:54:06.519678 UTC failed
```

## 🎯 What This Means

Prisma tried to apply the migration but it failed (probably because of the "Job" vs "jobs" issue). Now it's stuck in a failed state and blocking all future migrations.

---

## ✅ Solution Options

### Option 1: Mark as Rolled Back (Safest)

This tells Prisma the migration failed and needs to be re-applied:

```bash
cd /home/bkg/parrot/node/backend

# Mark the failed migration as rolled back
npx prisma migrate resolve --rolled-back add_file_hash_deduplication

# Now try to apply it again
npx prisma migrate deploy
```

### Option 2: Mark as Applied (If Columns Already Exist)

If the columns were partially created, mark it as applied:

```bash
# First, check if columns exist
npx prisma db execute --stdin <<SQL
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('file_hash', 'file_size');
SQL

# If columns exist, mark migration as applied
npx prisma migrate resolve --applied add_file_hash_deduplication

# Then deploy remaining migrations
npx prisma migrate deploy
```

### Option 3: Delete Failed Migration and Recreate (Clean Slate)

```bash
cd /home/bkg/parrot/node/backend

# 1. Delete the failed migration folder
rm -rf prisma/migrations/add_file_hash_deduplication

# 2. Mark the timestamped migration as applied (since we fixed it)
npx prisma migrate resolve --applied 20251008124648_add_file_hash_duplication

# 3. Apply remaining migrations
npx prisma migrate deploy
```

### Option 4: Complete Reset (For Development Only)

**⚠️ WARNING: This deletes ALL data!**

```bash
# Drop the entire database and start fresh
npx prisma migrate reset --force --skip-seed

# This will:
# 1. Drop all tables
# 2. Re-run all migrations from scratch
# 3. Use the FIXED migration files
```

---

## 🚀 Recommended Approach (Step-by-Step)

### Step 1: Check Database State

```bash
cd /home/bkg/parrot/node/backend

# Check if file_hash and file_size columns exist
npx prisma db execute --stdin <<SQL
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs'
ORDER BY ordinal_position;
SQL
```

### Step 2: Based on Results

**If columns DON'T exist**:
```bash
# Mark as rolled back and re-apply
npx prisma migrate resolve --rolled-back add_file_hash_deduplication
npx prisma migrate deploy
```

**If columns DO exist**:
```bash
# Mark as applied
npx prisma migrate resolve --applied add_file_hash_deduplication
npx prisma migrate deploy
```

### Step 3: Verify Success

```bash
# Check migration status
npx prisma migrate status

# Should show: "Database schema is up to date!"
```

### Step 4: Generate Client

```bash
# Regenerate Prisma client with latest schema
npx prisma generate
```

---

## 🎯 Quick Fix (One Command)

If you're in development and don't care about existing data:

```bash
cd /home/bkg/parrot/node/backend && npx prisma migrate reset --force --skip-seed && npx prisma generate
```

This will:
- ✅ Drop all tables
- ✅ Re-run all migrations (with our fixes)
- ✅ Generate Prisma client
- ✅ Start fresh

---

## 📋 What About the Dashboard Cache?

**Good question!** If you delete all migrations and reset the database:

### What Gets Deleted:
- ❌ All jobs
- ❌ All contacts
- ❌ All users (if in same database)
- ❌ All subscriptions
- ❌ All usage data

### What Stays:
- ✅ Frontend IndexedDB cache (dashboard data)
- ✅ Frontend React Query cache
- ✅ Extraction cache (ExtractionCache.ts)

### What Happens to Dashboard:

1. **First load after reset**: Shows cached data from IndexedDB (if available)
2. **Background fetch**: Tries to get fresh data from API
3. **API returns**: Empty/default data (since DB is empty)
4. **Dashboard updates**: Shows 0 contacts, 0 jobs (correct!)

The cache will automatically update with the new (empty) state.

---

## 🧪 Testing After Migration Fix

```bash
# 1. Fix migrations
npx prisma migrate reset --force --skip-seed

# 2. Verify schema
npx prisma db execute --stdin <<SQL
\d jobs
SQL

# 3. Start server
npm run dev

# 4. Upload test PDF
# Expected: 22 contacts extracted and saved

# 5. Query database
npx prisma db execute --stdin <<SQL
SELECT COUNT(*) FROM jobs;
SELECT COUNT(*) FROM contacts;
SQL
```

---

## ✅ Recommended Action

For development (safe to delete data):

```bash
cd /home/bkg/parrot/node/backend
npx prisma migrate reset --force --skip-seed
npx prisma generate
```

Then restart your server and test!

---

**Priority**: 🔥 **Fix migrations first, then test extraction**  
**Impact**: Migrations must be fixed before extraction fixes can work  
**Time**: 2 minutes to fix, 5 minutes to test




