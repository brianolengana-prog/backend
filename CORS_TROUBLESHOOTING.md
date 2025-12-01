# CORS Troubleshooting Guide

## ❌ Error: "Failed to fetch" or CORS Error

This usually means the **backend isn't running** or **not reachable**.

---

## 🔍 Quick Checks

### 1. Is Backend Running?

```bash
# Check if backend is running on port 3001
curl http://localhost:3001/api/health

# Should return: {"status":"OK"}
```

**If it fails**: Backend isn't running!

---

### 2. Check Backend Port

```bash
# Check what port backend is using
grep PORT /home/bkg/parrot/node/backend/.env
# or
cat /home/bkg/parrot/node/backend/src/server.js | grep PORT
```

**Expected**: Port 3001

---

### 3. Start Backend

```bash
cd /home/bkg/parrot/node/backend
npm start
```

**Look for**: 
```
Clean backend listening on 3001
```

---

## 🎯 CORS Configuration

Your backend **already allows localhost**:

```javascript
// From src/app.js
if (origin && origin.startsWith('http://localhost:')) {
  return callback(null, true);  // ✅ Allows ANY localhost port
}
```

So CORS should work automatically!

---

## 🚨 Common Issues

### Issue 1: Backend Not Running

**Symptom**: `Failed to fetch`

**Fix**:
```bash
cd /home/bkg/parrot/node/backend
npm start
```

---

### Issue 2: Wrong Port

**Symptom**: Backend running but frontend can't connect

**Check**:
```bash
# Backend should be on port 3001
curl http://localhost:3001/api/health

# Frontend should connect to localhost:3001
# Check: src/config/env.ts should have localhost:3001
```

---

### Issue 3: Backend Started but Crashed

**Check logs**:
```bash
cd /home/bkg/parrot/node/backend
npm start
# Look for errors in console
```

**Common errors**:
- Database connection failed
- Missing environment variables
- Port already in use

---

### Issue 4: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3001`

**Fix**:
```bash
# Find process using port 3001
lsof -i :3001
# or
netstat -tuln | grep 3001

# Kill it
kill -9 <PID>

# Or use different port (update .env)
PORT=3002 npm start
```

---

## ✅ Testing Steps

### Step 1: Start Backend

```bash
cd /home/bkg/parrot/node/backend
npm start
```

**Expected output**:
```
Clean backend listening on 3001
✅ All extraction libraries initialized successfully
```

---

### Step 2: Test Backend Directly

```bash
curl http://localhost:3001/api/health
```

**Expected**: `{"status":"OK"}`

---

### Step 3: Test from Frontend

```bash
# In browser console or DebugAuth page
fetch('http://localhost:3001/api/health')
  .then(r => r.json())
  .then(console.log)
```

**Expected**: `{status: "OK"}`

---

## 🔧 Quick Fixes

### Fix 1: Restart Backend

```bash
# Stop backend (Ctrl+C)
# Then restart
cd /home/bkg/parrot/node/backend
npm start
```

---

### Fix 2: Check Environment Variables

```bash
cd /home/bkg/parrot/node/backend
# Make sure .env exists and has:
# PORT=3001
# DATABASE_URL=...
```

---

### Fix 3: Verify CORS Config

The backend already allows localhost automatically:
- ✅ `http://localhost:*` (any port)
- ✅ `http://localhost:5173` (Vite default)
- ✅ `http://localhost:3000` (alternative)

**No changes needed!**

---

## 🎯 Complete Checklist

- [ ] Backend is running (`npm start` in backend directory)
- [ ] Backend responds to `http://localhost:3001/api/health`
- [ ] Frontend is running (`npm run dev` in frontend directory)
- [ ] Frontend URL is `http://localhost:5173` (or similar)
- [ ] No errors in backend console
- [ ] No errors in frontend console
- [ ] Browser network tab shows requests going to `localhost:3001`

---

## 🚀 Quick Test Command

```bash
# Terminal 1: Start Backend
cd /home/bkg/parrot/node/backend && npm start

# Terminal 2: Test Health Endpoint
curl http://localhost:3001/api/health

# Should return: {"status":"OK"}
```

---

*Most likely issue: Backend isn't running! Start it with `npm start` in the backend directory.* 🚀

