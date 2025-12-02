# Port Mismatch Fix

## 🔍 Issue Found

**Backend is running on port 3000**, but **frontend is trying to connect to port 3001**!

---

## ✅ Quick Fix

You have two options:

### Option 1: Update Frontend to Use Port 3000 (Easiest)

```bash
# In sjcallsheets-project directory
cd /home/bkg/sjcallsheets-project

# Create .env.local file
echo "VITE_API_URL=http://localhost:3000" > .env.local

# Restart frontend dev server
```

---

### Option 2: Update Backend to Use Port 3001

```bash
# In backend directory
cd /home/bkg/parrot/node/backend

# Create/update .env file
echo "PORT=3001" >> .env

# Restart backend
npm start
```

---

## 🎯 Recommended: Use Port 3000

Since backend is already running on 3000, just update frontend:

```bash
cd /home/bkg/sjcallsheets-project
echo "VITE_API_URL=http://localhost:3000" > .env.local
```

Then restart your frontend dev server!

---

*Fix the port mismatch and CORS will work! 🚀*

