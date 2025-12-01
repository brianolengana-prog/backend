# Database Connection Fix

## 🔍 Issue Found

**Database connection is failing!**

```
❌ Error: Can't reach database server at `aws-1-eu-north-1.pooler.supabase.com:6543`
```

This is why the server hangs - it's trying to connect to Supabase but can't reach it.

---

## ✅ Solutions

### Option 1: Check Database Server Status

1. **Verify Supabase is running**: Check your Supabase dashboard
2. **Check network connectivity**: Can you reach the server?

```bash
# Test connection
nc -zv aws-1-eu-north-1.pooler.supabase.com 6543
# or
telnet aws-1-eu-north-1.pooler.supabase.com 6543
```

---

### Option 2: Use Direct Connection (Not Pooler)

If the pooler isn't working, try the direct connection URL:

```bash
# In .env, change DATABASE_URL to use direct connection (port 5432)
# Instead of pooler (port 6543)
```

Check your Supabase dashboard for the direct connection string.

---

### Option 3: Add Connection Timeout

The server hangs because the connection times out. Let's add better error handling:

```javascript
// In src/config/database.js
async connect() {
  if (this.connected) return;
  
  // Add timeout
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database connection timeout')), 10000)
  );
  
  await Promise.race([
    this.client.$connect(),
    timeout
  ]);
  
  this.connected = true;
}
```

---

### Option 4: Test Database Connection

```bash
# Test if you can connect at all
psql "postgresql://postgres.ypnwgyrdovjyxkgszwbd:V3T1M1TmquFqeXsz@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

**If this fails**: Database credentials or network issue!

---

## 🚨 Quick Workaround: Skip Database for Testing

If you just want to test CORS without database:

1. Comment out database connection temporarily
2. Or use a local PostgreSQL instance
3. Or fix the Supabase connection

---

## ✅ Recommended Action

1. **Check Supabase Dashboard**: Is your database active?
2. **Verify Connection String**: Is it correct?
3. **Try Direct Connection**: Use port 5432 instead of 6543
4. **Check Network**: Can you reach the server?

---

*Fix the database connection and the server will start! 🚀*

