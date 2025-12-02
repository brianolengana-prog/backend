# Database Connection Fix - Complete Solution

## 🔍 Problem Identified

Prisma can't connect to Supabase database. The connection string may be missing SSL parameters or the database might need different configuration.

---

## ✅ Solution: Fix Connection String

### Step 1: Check Current Connection String

Your `.env` currently has:
```
DATABASE_URL="postgresql://...@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### Step 2: Add SSL Parameters

For Supabase, you need to add SSL mode. Update your `.env`:

```bash
# Connection Pooling (for queries)
DATABASE_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"

# Direct Connection (for migrations)
DIRECT_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

**Key additions**:
- `&sslmode=require` - Required for Supabase connections

---

## 🔧 Alternative: Test with Direct Connection First

If pooler doesn't work, try using DIRECT_URL for both:

```bash
# Try direct connection first
DATABASE_URL="postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

---

## ✅ What I've Fixed

1. ✅ **Added connection timeout** - Server won't hang forever
2. ✅ **Added retry logic** - Will try 3 times with exponential backoff
3. ✅ **Better error messages** - Clear error logging
4. ✅ **Connection testing** - Verifies connection works

---

## 🚀 Next Steps

### Step 1: Update Connection String

Add `&sslmode=require` to your DATABASE_URL in `.env`:

```bash
cd /home/bkg/parrot/node/backend
# Edit .env and add &sslmode=require to DATABASE_URL
```

### Step 2: Test Connection

```bash
node -e "
const db = require('./src/config/database');
db.connect(5000).then(() => {
  console.log('✅ Connected!');
  return db.testConnection();
}).then(result => {
  console.log('Test:', result ? 'PASSED' : 'FAILED');
  process.exit(result ? 0 : 1);
}).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
"
```

### Step 3: Start Server

```bash
npm start
```

**Should now see**:
```
✅ Database connected successfully
✅ Database connection verified
✅ Subscription renewal job started
✅ Clean backend listening on 3001
```

---

*The fix adds timeout, retry logic, and better error handling! 🚀*
