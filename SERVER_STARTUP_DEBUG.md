# Server Startup Debug Guide

## 🔍 Issue: Server Starts but Doesn't Show "Listening" Message

If you see all initialization messages but **no "Clean backend listening on 3001"**, the server likely crashed during startup.

---

## ✅ Quick Check

### Step 1: Check if Server is Actually Running

```bash
# Check if process is running
ps aux | grep "node.*server.js" | grep -v grep

# Check if port 3001 is listening
netstat -tuln | grep 3001
# or
ss -tuln | grep 3001
```

---

### Step 2: Run Server with Error Output

```bash
cd /home/bkg/parrot/node/backend
node src/server.js
```

**Look for**:
- Any error messages after initialization
- Database connection errors
- Missing environment variables

---

### Step 3: Check Environment Variables

```bash
cd /home/bkg/parrot/node/backend
# Check required env vars
grep -E "DATABASE_URL|JWT_SECRET|FRONTEND_URL" .env
```

**Required**:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

---

## 🚨 Common Issues

### Issue 1: Database Connection Fails Silently

**Check**:
```bash
node -e "require('./src/config/database').connect().then(() => console.log('OK')).catch(e => console.error(e))"
```

**Fix**: Ensure `DATABASE_URL` is correct in `.env`

---

### Issue 2: Missing Environment Variables

**Check**:
```bash
node -e "require('./src/config/env')"
```

**If it throws an error**: Missing required env vars!

---

### Issue 3: Port Already in Use

**Check**:
```bash
lsof -i :3001
```

**Fix**: Kill the process or change PORT in `.env`

---

## 🔧 Quick Fix

### Test Server Startup Step by Step

```bash
cd /home/bkg/parrot/node/backend

# 1. Check env vars load
node -e "console.log('PORT:', require('./src/config/env').PORT)"

# 2. Check database connects
node -e "require('./src/config/database').connect().then(() => { console.log('DB OK'); process.exit(0); }).catch(e => { console.error('DB Error:', e); process.exit(1); })"

# 3. Start server and watch for errors
node src/server.js
```

---

## ✅ Expected Output

When server starts correctly, you should see:

```
⚠️  Email service not configured...
✅ mammoth library loaded successfully
✅ All extraction libraries initialized successfully
✅ Refactored extraction service initialized
✅ Subscription renewal job started          ← Should see this!
Clean backend listening on 3001              ← Should see this!
```

**If you don't see the last two messages**, the server crashed!

---

## 🎯 Next Steps

1. Run `node src/server.js` and watch for errors
2. Check all environment variables are set
3. Verify database connection works
4. Check for port conflicts

---

*Check the error messages to find what's preventing startup! 🚀*

