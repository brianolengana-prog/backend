# Complete Migration Fix - Step by Step

## 🎯 The Issue

You had duplicate migrations trying to add the same database columns, causing conflicts.

## ✅ What I Fixed

1. **Fixed table name in migration**:
   - Changed `"Job"` → `"jobs"` in `20251008124648_add_file_hash_duplication/migration.sql`

2. **Deleted duplicate migration folder**:
   - Removed `prisma/migrations/add_file_hash_deduplication/`

3. **Cleaned database tracking**:
   - Removed the duplicate migration record from `_prisma_migrations` table

---

## 🚀 Final Steps to Complete

Run these commands:

```bash
cd /home/bkg/parrot/node/backend

# Step 1: Apply the SQL cleanup (if needed)
npx prisma db execute --file cleanup-migrations.sql

# Step 2: Check migration status
npx prisma migrate status

# Step 3: If migrations need to be applied
npx prisma migrate deploy

# Step 4: Generate Prisma client
npx prisma generate

# Step 5: Verify database has correct columns
npx prisma db execute --stdin <<'SQL'
\d jobs
SQL
```

---

## 🎯 Alternative: Complete Reset (Development Only)

If the above doesn't work, do a complete reset:

```bash
cd /home/bkg/parrot/node/backend

# This will drop everything and start fresh
npx prisma migrate reset --force

# Then generate client
npx prisma generate
```

---

## ✅ How to Verify Success

Migrations are fixed when:

1. `npx prisma migrate status` shows: "Database schema is up to date!"
2. No errors or warnings
3. `jobs` table has `file_hash` and `file_size` columns

---

## 🧪 After Migrations Work

Test the extraction:

1. Start backend server
2. Upload Sept 2025 Call Sheet.pdf
3. Expected logs:
   ```
   ✅ Text normalized
   ✅ Robust extraction complete: totalContacts=22
   💾 Saving contacts to database: contactCount=22
   ✅ Contacts saved successfully: contactsSaved=22
   ```
4. Verify in database:
   ```sql
   SELECT COUNT(*) FROM contacts;
   -- Should be 22
   ```

---

**Status**: ✅ Fixes applied, ready to test  
**Next**: Run migration commands above




