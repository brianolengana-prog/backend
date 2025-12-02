# Local vs Production Database Connection

## ✅ Good News: If Production Works, Database is Fine!

Since your **deployed version works with the same variables**, this means:
- ✅ Database is active and accessible
- ✅ Connection string is correct
- ✅ Credentials are valid

The issue is **local environment configuration**, not the database!

---

## 🔍 Common Local vs Production Differences

### 1. Environment Variables Not Loading

**Production**: Environment variables set by platform (Render, etc.)  
**Local**: Must load from `.env` file

**Check**:
```bash
cd /home/bkg/parrot/node/backend
node -e "require('dotenv').config(); console.log('DB URL:', process.env.DATABASE_URL ? 'LOADED' : 'NOT LOADED');"
```

---

### 2. SSL/TLS Configuration

**Production**: Platform may handle SSL automatically  
**Local**: May need explicit SSL parameters

**Fix**: Add `sslmode=require` to connection string:
```bash
# Check if already added
grep sslmode .env

# If not, add it
sed -i 's|pgbouncer=true|pgbouncer=true\&sslmode=require|' .env
```

---

### 3. Network/Firewall Issues

**Production**: Platform has network access  
**Local**: Your network might block the connection

**Test**:
```bash
# Test network connectivity
nc -zv aws-1-eu-north-1.pooler.supabase.com 6543
```

---

### 4. Prisma Client Not Generated

**Production**: Build process generates Prisma client  
**Local**: Must run `npx prisma generate`

**Fix**:
```bash
cd /home/bkg/parrot/node/backend
npx prisma generate
```

---

### 5. Different Node.js Versions

**Check**:
```bash
node --version
```

Production might use a different Node version that handles SSL differently.

---

## 🎯 Quick Diagnostic

Run this to see what's different:

```bash
cd /home/bkg/parrot/node/backend

# 1. Check if .env loads
node -e "require('dotenv').config(); console.log('✅ Env loaded'); console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (' + process.env.DATABASE_URL.length + ' chars)' : 'NOT SET');"

# 2. Test Prisma connection
node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const client = new PrismaClient();
client.\$connect()
  .then(() => {
    console.log('✅ Prisma connected!');
    return client.\$disconnect();
  })
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e.code || 'UNKNOWN', '-', e.message);
    process.exit(1);
  });
"
```

---

## ✅ Most Likely Fix

Since production works, try:

### 1. Regenerate Prisma Client

```bash
cd /home/bkg/parrot/node/backend
npx prisma generate
```

### 2. Test Connection with Production Connection String Format

Check if your production connection string has different parameters and copy that format.

### 3. Add Connection Timeout (Already Done)

The updated `database.js` now has timeout and retry logic - this should help!

---

*The database works in production, so it's just a local config issue! 🚀*

