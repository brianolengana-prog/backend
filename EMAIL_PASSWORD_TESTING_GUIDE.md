# Email/Password Authentication - Testing Guide

## 🎯 Goal
Test email/password registration and login end-to-end locally.

## ✅ What We Have

### Frontend
- ✅ **Auth Page** (`/auth`) - Has tabs for Login and Signup
- ✅ **SignupForm Component** - Fully functional
- ✅ **LoginForm Component** - Fully functional
- ✅ **useUnifiedAuth Hook** - Handles auth state
- ✅ **UnifiedAuthService** - API calls to backend

### Backend
- ✅ **New Auth Domain** - Clean architecture with DDD
- ✅ **EmailAuthStrategy** - Email/password authentication
- ✅ **New Routes** - Domain-driven auth routes
- ✅ **Feature Flag** - `USE_NEW_AUTH` for gradual rollout

## 🔧 Integration Steps

### 1. Enable New Auth Routes

Add to `.env`:
```bash
USE_NEW_AUTH=true
```

### 2. Verify API URL Configuration

The frontend uses `ENV_CONFIG.API_URL` which should point to:
- Development: `http://localhost:3001/api`
- Production: `https://backend-cv7a.onrender.com/api`

### 3. Response Format Compatibility

Frontend expects:
```json
{
  "success": true,
  "user": { ... },
  "token": "...",
  "refreshToken": "..."
}
```

Backend now returns this format ✅

## 🧪 Testing Steps

### Step 1: Start Backend

```bash
cd /home/bkg/parrot/node/backend
npm start
```

Verify:
- ✅ Server starts on port 3001
- ✅ Database connects
- ✅ New auth routes loaded (check console)

### Step 2: Start Frontend

```bash
cd /home/bkg/sjcallsheets-project
npm run dev
```

Verify:
- ✅ Frontend starts on port 5173
- ✅ Can navigate to `/auth`

### Step 3: Test Registration

1. Navigate to `http://localhost:5173/auth`
2. Click "Sign Up" tab
3. Fill in:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
4. Click "Sign Up"
5. **Expected**: Redirects to `/upload` with success toast

### Step 4: Test Login

1. Navigate to `http://localhost:5173/auth`
2. Click "Sign In" tab
3. Fill in:
   - Email: test@example.com
   - Password: password123
4. Click "Sign In"
5. **Expected**: Redirects to `/upload` with success toast

### Step 5: Test Protected Routes

1. After login, navigate to `/contacts`
2. **Expected**: Should see contacts page (authenticated)

## 🔍 Debugging

### Check Backend Logs

```bash
# Watch server logs
tail -f /tmp/server.log
```

Look for:
- `✅ Using new domain-driven auth routes`
- Registration/login attempts
- Any errors

### Check Frontend Console

Open browser DevTools → Console

Look for:
- `🔄 Registering user: ...`
- `✅ Registration successful: ...`
- Any errors

### Test API Directly

```bash
# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## ✅ Expected Behavior

### Registration Flow
1. User fills form → submits
2. Frontend calls `POST /api/auth/register`
3. Backend creates user, session, returns tokens
4. Frontend stores tokens in localStorage
5. User redirected to `/upload`
6. Toast shows "Welcome!"

### Login Flow
1. User fills form → submits
2. Frontend calls `POST /api/auth/login`
3. Backend validates credentials, returns tokens
4. Frontend stores tokens in localStorage
5. User redirected to `/upload`
6. Toast shows "Welcome back!"

## 🐛 Common Issues

### Issue: "Failed to fetch"
- **Cause**: Backend not running or wrong port
- **Fix**: Verify backend on port 3001

### Issue: "CORS error"
- **Cause**: CORS not configured for localhost:5173
- **Fix**: Check `src/app.js` CORS config

### Issue: "Invalid response from server"
- **Cause**: Response format mismatch
- **Fix**: Verify response has `token` field (not `accessToken`)

### Issue: "User already exists"
- **Cause**: User already registered
- **Fix**: Use different email or delete user from DB

## 🎯 Success Criteria

- [ ] Can register new user
- [ ] Can login with registered user
- [ ] Tokens stored in localStorage
- [ ] Can access protected routes
- [ ] Can logout
- [ ] No console errors
- [ ] No backend errors

---

**Ready to test!** Start with registration first, then login. 🚀

