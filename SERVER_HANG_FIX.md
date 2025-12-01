# Server Hanging Fix - Database Connection Issue

## 🔍 Problem Identified

The server starts but **hangs during database connection** - it never reaches the "Clean backend listening on 3001" message.

---

## ✅ Quick Diagnosis

The server is stuck at `await db.connect()` in `src/server.js:10`.

---

## 🔧 Solutions

### Solution 1: Check Database Connection

```bash
cd /home/bkg/parrot/node/backend

# Test database connection directly
node -e "
const db = require('./src/config/database');
db.connect()
  .then(() => {
    console.log('✅ Database connected successfully');
    process.exit(0);
  })
  .catch(e => {
    console.error('❌ Database connection failed:', e.message);
    process.exit(1);
  });
"
```

**If this hangs or fails**: Database connection issue!

---

### Solution 2: Check Environment Variables

```bash
cd /home/bkg/parrot/node/backend

# Check DATABASE_URL is set
grep DATABASE_URL .env

# Verify it's a valid connection string
echo $DATABASE_URL
```

---

### Solution 3: Add Connection Timeout

The database connection might be hanging indefinitely. You can add a timeout:

```javascript
// In src/server.js, modify the start function:
async function start() {
  try {
    // Add timeout to database connection
    const dbConnectPromise = db.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    );
    
    await Promise.race([dbConnectPromise, timeoutPromise]);
    
    // Rest of the code...
  }
}
```

---

### Solution 4: Check Database Server

Make sure your database is:
- ✅ Running
- ✅ Accessible
- ✅ `DATABASE_URL` is correct

---

## 🚀 Quick Test

```bash
cd /home/bkg/parrot/node/backend

# Test DB connection with timeout
timeout 5 node -e "
const db = require('./src/config/database');
db.connect()
  .then(() => console.log('✅ Connected'))
  .catch(e => console.error('❌ Error:', e.message))
  .finally(() => process.exit(0));
"
```

**If it times out**: Database is not reachable!

---

*The server is hanging on database connection - check your DATABASE_URL! 🚀*

