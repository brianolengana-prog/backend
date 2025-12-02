# Auth Domain Testing Guide

## 🧪 Quick Start

### 1. Run Unit Tests

```bash
# Run all auth domain tests
npm test src/domains/auth

# Run specific test file
npm test src/domains/auth/__tests__/value-objects/Email.test.js
```

### 2. Enable New Auth Routes

Add to `.env`:
```bash
USE_NEW_AUTH=true
```

### 3. Test Endpoints

```bash
# Start server
npm start

# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test health endpoint
curl http://localhost:3001/api/auth/health
```

## 📋 Test Checklist

- [ ] Unit tests pass
- [ ] Registration works
- [ ] Login works
- [ ] Google OAuth works (if configured)
- [ ] Token validation works
- [ ] Error handling works
- [ ] Backward compatibility maintained

## 🔄 Rollback

If issues occur, disable feature flag:
```bash
USE_NEW_AUTH=false
```

The server will automatically use legacy routes.

