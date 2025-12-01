# Quick Local Testing Guide

## ✅ Yes! You Can Test Locally Without Affecting Deployed Version

**Key Point**: Merging locally does NOT change your deployed version. You must push and deploy to change production.

---

## 🎯 Simple Workflow

### Option 1: Create Develop Branch (Recommended)

```bash
# 1. Create develop branch from main
git checkout main
git checkout -b develop

# 2. Merge refactor branch into develop
git merge refactor/architecture-redesign

# 3. Now you can test locally!
npm start
```

**Result**:
- ✅ Your local code has the refactored architecture
- ✅ **Deployed version is UNCHANGED** (you haven't pushed)
- ✅ You can test everything locally

---

### Option 2: Merge Directly to Main (If No Develop Branch)

```bash
# 1. Switch to main
git checkout main

# 2. Merge refactor branch
git merge refactor/architecture-redesign

# 3. Test locally
npm start
```

**Important**: Don't push until you've tested!

---

## 🧪 Testing Steps

### Step 1: Test with Feature Flags OFF (Old Code)

```bash
# In your .env file
USE_NEW_EXTRACTION=false
USE_NEW_CONTACTS=false

# Start server
npm start

# Test endpoints - should work as before
```

**Expected**: Old code runs, everything works as before ✅

---

### Step 2: Test with Feature Flags ON (New Code)

```bash
# In your .env file
USE_NEW_EXTRACTION=true
USE_NEW_CONTACTS=true

# Restart server
npm start

# Test endpoints - should work the same but with new architecture
```

**Expected**: New code runs, same results, better architecture ✅

---

## 🔍 What to Test

1. **Extraction Endpoint**
   ```bash
   POST /api/extraction/upload
   ```
   - Upload a call sheet
   - Verify contacts extracted
   - Check database

2. **Contacts Endpoint**
   ```bash
   GET /api/contacts
   GET /api/contacts/stats
   GET /api/contacts/export
   ```
   - Verify data returned
   - Check job scoping works
   - Test export

3. **New Strategies Endpoint**
   ```bash
   GET /api/extraction/strategies
   ```
   - Should return available strategies

---

## 🚨 Important Notes

### Local vs Deployed

- **Local Merge**: Only changes your local code
- **Deployed Version**: Unchanged until you push and deploy
- **Feature Flags OFF**: Old code runs (safe default)

### Safety

- Feature flags are OFF by default
- Old code runs even if new code has issues
- Can rollback instantly by setting flags to false

---

## 📤 After Testing

### If Tests Pass ✅

```bash
# Push to remote (if you want to deploy)
git push origin develop  # or main

# Deploy with flags OFF
USE_NEW_EXTRACTION=false
USE_NEW_CONTACTS=false
```

### If Tests Fail ❌

```bash
# Undo merge locally
git reset --hard HEAD~1

# Or switch back to main
git checkout main
```

---

## ✅ Quick Checklist

- [ ] Merge to develop/main locally
- [ ] Test with flags OFF (old code)
- [ ] Test with flags ON (new code)
- [ ] Verify no errors
- [ ] Check logs
- [ ] If good → push and deploy (with flags OFF)

---

*Test locally first, then deploy! 🚀*

