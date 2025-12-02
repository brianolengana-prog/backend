# Migration Instructions - Add stripeCustomerId to User

## Issue
Prisma migrate can't connect to the database because it's trying to use `DIRECT_URL` which may not be configured correctly for Supabase.

## Solution Options

### Option 1: Apply Migration Manually (Recommended for Production)
Since the migration SQL is already generated, you can apply it directly to your database:

```sql
-- Run this SQL directly in your Supabase SQL editor or database client
ALTER TABLE "public"."users" ADD COLUMN "stripe_customer_id" TEXT;
```

### Option 2: Fix DIRECT_URL
For Supabase, `DIRECT_URL` should be the direct connection string (not the pooler).

**Current setup:**
- `DATABASE_URL` = Connection pooler (works for server)
- `DIRECT_URL` = Should be direct connection (for migrations)

**To fix:**
1. In Supabase dashboard, go to Settings → Database
2. Copy the "Connection string" (not "Connection pooling")
3. Update `.env`:
   ```
   DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require"
   ```
   (Replace `[PASSWORD]` and `[HOST]` with your actual values)

4. Then run:
   ```bash
   npx prisma migrate deploy
   ```

### Option 3: Use prisma migrate dev (Development Only)
If you're in development and want Prisma to handle the migration:

```bash
# This will apply the migration and regenerate Prisma client
npx prisma migrate dev
```

**Note:** This requires database access and will mark the migration as applied.

### Option 4: Skip Migration (If Column Already Exists)
If the `stripe_customer_id` column already exists in your database, you can:

1. Mark the migration as applied without running it:
   ```bash
   npx prisma migrate resolve --applied 20251202225131_add_stripe_customer_id_to_user
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

## Verification
After applying the migration, verify it worked:

```bash
# Check if Prisma can see the field
npx prisma studio
# Or
npx prisma db pull
```

## Current Migration SQL
The migration file contains:
```sql
ALTER TABLE "public"."users" ADD COLUMN "stripe_customer_id" TEXT;
```

This is safe to run manually if needed.

