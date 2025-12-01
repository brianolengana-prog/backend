# Local Testing Guide - After Merging to Develop

**Date**: January 2025  
**Purpose**: Test the refactored backend locally before deploying

---

## 🎯 Workflow Overview

```
1. Merge to develop (local) ✅
   ↓
2. Test locally with feature flags OFF (old code) ✅
   ↓
3. Test locally with feature flags ON (new code) ✅
   ↓
4. If all good → Push to remote develop
   ↓
5. Deploy to staging/production (with flags OFF)
   ↓
6. Gradually enable flags in production
```

---

## 📋 Step-by-Step Testing

### Step 1: Merge to Develop (Local)

```bash
# Make sure you're on the refactor branch
cd /home/bkg/parrot/node/backend
git checkout refactor/architecture-redesign

# Switch to develop
git checkout develop

# Merge the refactor branch
git merge refactor/architecture-redesign

# Verify merge
git log --oneline -5
```

**Result**: 
- ✅ Your local `develop` branch now has the refactored code
- ✅ **Deployed version is UNCHANGED** (you haven't pushed yet)
- ✅ You can test locally without affecting production

---

### Step 2: Test Locally with Feature Flags OFF (Old Code)

**This tests that old code still works (safety check)**

```bash
# Make sure your .env has feature flags OFF
USE_NEW_EXTRACTION=false
USE_NEW_CONTACTS=false
```

**Test**:
1. Start your backend server:
   ```bash
   npm start
   # or
   node src/server.js
   ```

2. Test extraction endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/extraction/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@test-callsheet.pdf"
   ```

3. Test contacts endpoint:
   ```bash
   curl http://localhost:3000/api/contacts \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

**Expected**: 
- ✅ Old code runs (feature flags OFF)
- ✅ Everything works as before
- ✅ No errors

---

### Step 3: Test Locally with Feature Flags ON (New Code)

**This tests the new refactored architecture**

```bash
# Update your .env to enable new code
USE_NEW_EXTRACTION=true
USE_NEW_CONTACTS=true
```

**Or test with percentage rollout**:
```bash
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=100  # 100% of users
```

**Test**:
1. Restart your backend server:
   ```bash
   npm start
   ```

2. Test new extraction endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/extraction/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@test-callsheet.pdf"
   ```

3. Test new contacts endpoint:
   ```bash
   curl http://localhost:3000/api/contacts \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. Test new strategies endpoint:
   ```bash
   curl http://localhost:3000/api/extraction/strategies \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

**Expected**:
- ✅ New code runs (feature flags ON)
- ✅ Same results as old code (backward compatible)
- ✅ Better architecture (cleaner code)
- ✅ No errors

---

## 🔍 What to Check

### 1. Extraction Works
- [ ] File upload succeeds
- [ ] Contacts extracted correctly
- [ ] Job created in database
- [ ] Response format matches old API

### 2. Contacts Work
- [ ] Get contacts returns correct data
- [ ] Job scoping works (if jobId provided)
- [ ] Stats endpoint works
- [ ] Export endpoint works

### 3. Feature Flags Work
- [ ] OFF = old code runs
- [ ] ON = new code runs
- [ ] Percentage rollout works (if tested)

### 4. No Breaking Changes
- [ ] API responses match old format
- [ ] Database schema unchanged
- [ ] No new errors in logs

---

## 🚨 If Something Goes Wrong

### Rollback Locally
```bash
# Undo the merge
git reset --hard HEAD~1

# Or go back to before merge
git reflog
git reset --hard <commit-before-merge>
```

### Keep Old Code Running
- Feature flags are OFF by default
- Old code runs even if new code has issues
- You can disable flags instantly

---

## 📤 After Local Testing Passes

### Push to Remote Develop
```bash
git push origin develop
```

**Result**:
- ✅ Remote `develop` branch updated
- ✅ **Production still UNCHANGED** (production uses `main`)
- ✅ Team can test on staging

### Deploy to Staging/Production
```bash
# Deploy with feature flags OFF
USE_NEW_EXTRACTION=false
USE_NEW_CONTACTS=false
```

**Result**:
- ✅ Deployed version uses old code (safe)
- ✅ New code is available but disabled
- ✅ Can enable gradually when ready

---

## 🎯 Key Points

1. **Local Merge ≠ Deployed**
   - Merging locally doesn't affect deployed version
   - You must push and deploy to change production

2. **Feature Flags = Safety**
   - OFF by default = old code runs
   - ON = new code runs
   - Can switch instantly

3. **Test Both Paths**
   - Test with flags OFF (old code)
   - Test with flags ON (new code)
   - Both should work

4. **Gradual Rollout**
   - Start with flags OFF in production
   - Enable for 1% of users
   - Gradually increase
   - Rollback if needed

---

## ✅ Testing Checklist

- [ ] Merge to develop locally
- [ ] Test with flags OFF (old code)
- [ ] Test with flags ON (new code)
- [ ] Verify no breaking changes
- [ ] Check logs for errors
- [ ] Test all endpoints
- [ ] Verify database operations
- [ ] If all good → push to remote

---

*Test locally first, then deploy! 🚀*

