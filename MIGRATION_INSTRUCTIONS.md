# Migration Instructions - Add stripeCustomerId to User

## Issue
Prisma migrate can't connect to the database because `DIRECT_URL` is pointing to the pooler instead of the direct connection. Prisma migrations require a direct database connection (not through the pooler).

## Quick Fix: Apply Migration Manually (Recommended)

Since this is a simple single-column addition, the easiest solution is to apply it manually:

### Step 1: Run SQL in Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run this SQL:

```sql
ALTER TABLE "public"."users" ADD COLUMN "stripe_customer_id" TEXT;
```

### Step 2: Mark Migration as Applied
After running the SQL, mark the migration as applied so Prisma knows it's done:

```bash
cd /home/bkg/parrot/node/backend
npx prisma migrate resolve --applied 20251202225131_add_stripe_customer_id_to_user
```

### Step 3: Verify
Restart your server and test that Stripe customer ID saving works without errors.

---

## Alternative Solutions

### Option 2: Fix DIRECT_URL for Future Migrations
For Supabase, `DIRECT_URL` should use the direct connection (not pooler):

1. In Supabase dashboard: **Settings → Database**
2. Find **Connection string** section
3. Copy the **Direct connection** string (not "Connection pooling")
4. Update `.env`:
   ```
   DIRECT_URL="postgresql://postgres:[PASSWORD]@[DIRECT_HOST]:5432/postgres?sslmode=require"
   ```
   Note: The direct connection typically uses a different hostname than the pooler.

5. Then run:
   ```bash
   npx prisma migrate deploy
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

