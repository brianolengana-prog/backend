# Unverified Login Policy

## ✅ Current Status

**Backend already allows unverified users to login!** ✅

The `EmailAuthStrategy.login()` method does **NOT** check for email verification status. It only checks:
- ✅ User exists
- ✅ Account is not locked
- ✅ Password is correct

---

## 🎯 Policy

**Users can login even without email verification.**

Email verification is **optional** and can be enforced later on specific routes/features if needed.

---

## 📋 Implementation

### Backend (Already Working)

The login flow in `EmailAuthStrategy.login()`:
1. Validates credentials
2. Checks account lock status
3. Verifies password
4. **Does NOT check `emailVerified` status**
5. Creates session and returns success

### Frontend Routes

Most routes use:
```tsx
<ProtectedRoute>
  {/* Route content */}
</ProtectedRoute>
```

By default, `requireEmailVerification={false}`, so unverified users can access.

### Optional Enforcement

If you want to require verification for specific routes later:

```tsx
<ProtectedRoute requireEmailVerification={true}>
  {/* This route requires verification */}
</ProtectedRoute>
```

---

## 🔔 User Experience

Unverified users can:
- ✅ Login and access the application
- ✅ Use most features
- ⚠️ See optional prompts to verify email (non-blocking)

Later, we can:
- Add banner/prompt for unverified users
- Show verification reminder in settings
- Optionally block specific features for unverified users

---

## 📝 Notes

- Email verification tokens are still generated and emails are sent
- Users can verify their email at any time
- Verification status is tracked in the database
- Can be enforced selectively on routes/features as needed

---

**Current state: Unverified users can login freely!** 🚀

