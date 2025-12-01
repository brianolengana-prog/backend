# 🚨 Urgent Database Fix - "Tenant or user not found"

## Problem Confirmed

Your Supabase database project is **inactive or deleted**. The connection string points to a database that no longer exists.

**Error:** `FATAL: Tenant or user not found`

## Quick Fix (5 minutes)

### Option 1: Create New Supabase Database (Recommended)

1. **Go to Supabase:** https://supabase.com/dashboard
2. **Create New Project:**
   - Click "New Project"
   - Fill in project details
   - Wait ~2 minutes for setup
3. **Get Connection Strings:**
   - Go to **Settings → Database**
   - Copy **Connection Pooling** URL → `DATABASE_URL`
   - Copy **Direct Connection** URL → `DIRECT_URL`
4. **Enable Extensions:**
   - Go to **SQL Editor**
   - Run:
     ```sql
     CREATE EXTENSION IF NOT EXISTS pg_trgm;
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
     ```
5. **Update `.env` file:**
   ```bash
   cd /home/bkg/parrot/node/backend
   # Edit .env and replace DATABASE_URL and DIRECT_URL
   ```
6. **Test Connection:**
   ```bash
   node scripts/test-database-connection.js
   ```
7. **Run Migrations:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Option 2: Use Neon (Serverless - Faster Setup)

1. **Go to Neon:** https://neon.tech
2. **Create Project** (takes ~30 seconds)
3. **Copy Connection String** from dashboard
4. **Enable Extensions** in SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
5. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DB]?sslmode=require"
   DIRECT_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DB]?sslmode=require"
   ```
6. **Test & Migrate:**
   ```bash
   node scripts/test-database-connection.js
   npx prisma generate
   npx prisma db push
   ```

## Current Connection String (INACTIVE)

Your current `.env` has:
```
DATABASE_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:****@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
```

**This database no longer exists.** You need to replace it with a new connection string.

## Testing Your New Database

After updating `.env`:

```bash
# Test connection
node scripts/test-database-connection.js

# If successful, run migrations
npx prisma generate
npx prisma db push

# Start server
npm start
```

## What Happens Next

1. ✅ Get new database connection string
2. ✅ Update `.env` file
3. ✅ Enable extensions (pg_trgm, uuid-ossp)
4. ✅ Test connection
5. ✅ Run migrations to create tables
6. ✅ Start your backend server

## Need Help?

- See `DATABASE_SETUP_GUIDE.md` for detailed instructions
- Run `node scripts/test-database-connection.js` to diagnose issues
- Check Prisma logs for detailed error messages

