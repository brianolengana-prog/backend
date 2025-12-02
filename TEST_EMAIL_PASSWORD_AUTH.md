# Test Email/Password Authentication - Step by Step

## 🎯 Quick Test Guide

### Prerequisites
- ✅ Backend running on `localhost:3001`
- ✅ Frontend running on `localhost:5173`
- ✅ Database connected
- ✅ `USE_NEW_AUTH=true` in backend `.env`

### Step 1: Verify Backend is Ready

```bash
cd /home/bkg/parrot/node/backend
npm start
```

**Expected output:**
```
✅ Using new domain-driven auth routes
✅ Clean backend listening on 3001
```

### Step 2: Test Registration Endpoint

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"testuser@example.com","password":"password123"}' \
  | jq .
```

**Expected response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "email": "testuser@example.com",
    "name": "Test User",
    ...
  },
  "token": "...",
  "refreshToken": "...",
  "session": { ... }
}
```

### Step 3: Test Login Endpoint

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"password123"}' \
  | jq .
```

**Expected response:**
```json
{
  "success": true,
  "user": { ... },
  "token": "...",
  "refreshToken": "..."
}
```

### Step 4: Test in Frontend

1. Navigate to `http://localhost:5173/auth`
2. Click "Sign Up" tab
3. Fill form and submit
4. **Expected**: Redirect to `/upload`

### Step 5: Verify Token Storage

Open browser DevTools → Application → Local Storage

**Expected:**
- `auth_token`: JWT token
- `refresh_token`: Refresh token
- `token_expiry`: Expiration timestamp

## 🔍 Troubleshooting

### If registration fails:
- Check backend logs for errors
- Verify database connection
- Check email format (must be valid)

### If login fails:
- Verify user was created
- Check password matches
- Check for account lock (too many attempts)

### If frontend can't connect:
- Verify `ENV_CONFIG.API_URL` is `http://localhost:3001/api`
- Check CORS configuration
- Verify backend is running

## ✅ Success Indicators

- ✅ Registration creates user in database
- ✅ Login returns valid tokens
- ✅ Tokens stored in localStorage
- ✅ Protected routes accessible
- ✅ User can logout

---

**Ready to test!** Start with the curl commands first, then test in the frontend. 🚀

