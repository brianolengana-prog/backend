# Local Testing Workflow ✅

## Current Status

You're on the `develop` branch with uncommitted changes. This is perfect for testing!

## Workflow Overview

```
main (production)
  │
  └── develop (testing/staging) ← You are here
       │
       └── refactor/architecture-redesign (feature branch)
```

## Step-by-Step: Test Locally Before Merging

### 1. **Test Your Changes Locally** (Current Step)

You're already doing this! Your server is running and working:
```bash
✅ Server running on port 3001
✅ Database connected
✅ Health endpoints working
✅ CORS working
```

**Test everything:**
- [ ] Health endpoint: `http://localhost:3001/health`
- [ ] API endpoints work
- [ ] Database operations work
- [ ] Frontend can connect
- [ ] No errors in logs

### 2. **Commit Your Changes**

Once you're satisfied with local testing:

```bash
# Review what changed
git status

# Add your changes
git add src/app.js src/config/database.js src/domains/contacts/ src/domains/extraction/ src/routes/contacts.routes.js src/server.js

# Add documentation
git add DATABASE_CONNECTION_FIXED.md HEALTH_ENDPOINT_FIX.md

# Commit with descriptive message
git commit -m "fix: Database connection and health endpoint

- Fix lazy-loaded Prisma client initialization
- Fix ContactRepository and ExtractionJobRepository database access
- Add /health endpoint for frontend compatibility
- Fix duplicate jobId declaration in contacts.routes
- Add connection timeout and retry logic
- Add SSL configuration for Supabase

Fixes: Database connection hanging on startup
Fixes: Health endpoint 404 error"
```

### 3. **Push to Develop Branch**

```bash
# Push your changes to remote develop branch
git push origin develop
```

### 4. **Test on Develop Branch** (Optional - if you have staging)

If you have a staging environment, deploy `develop` branch there and test.

### 5. **Merge to Main** (When Ready)

Once everything is tested and working:

```bash
# Switch to main
git checkout main

# Pull latest changes
git pull origin main

# Merge develop into main
git merge develop

# Push to production
git push origin main
```

## Best Practices

### ✅ **DO:**
- Test thoroughly locally before committing
- Write descriptive commit messages
- Test on `develop` before merging to `main`
- Use feature flags for gradual rollout
- Keep `main` branch stable and deployable

### ❌ **DON'T:**
- Merge untested code to `main`
- Skip local testing
- Commit without testing
- Push directly to `main` (use PRs)

## Current Workflow Status

```
✅ You're on develop branch
✅ Changes are tested locally
✅ Server is working
⏳ Next: Commit and push to develop
⏳ Then: Test on develop (or merge to main if confident)
```

## Quick Commands Reference

```bash
# Check current branch
git branch

# See what changed
git status
git diff

# Test locally
npm start
curl http://localhost:3001/health

# Commit changes
git add .
git commit -m "Your message"

# Push to develop
git push origin develop

# Switch to main (when ready)
git checkout main
git merge develop
git push origin main
```

## Testing Checklist

Before merging to `main`, verify:

- [ ] Server starts without errors
- [ ] Database connects successfully
- [ ] Health endpoint returns `{"status":"OK"}`
- [ ] API endpoints respond correctly
- [ ] Frontend can connect (CORS working)
- [ ] No console errors
- [ ] Database operations work
- [ ] All routes load correctly

## Benefits of This Workflow

1. **Safe Testing**: Test on `develop` without affecting production
2. **Easy Rollback**: If something breaks, `main` is still stable
3. **Incremental Deployment**: Merge small changes frequently
4. **Team Collaboration**: Others can test on `develop` branch
5. **Production Safety**: `main` always has working code

## Next Steps

1. ✅ **You've tested locally** - Everything works!
2. ⏳ **Commit your changes** - Use descriptive commit message
3. ⏳ **Push to develop** - `git push origin develop`
4. ⏳ **Test on develop** (optional staging environment)
5. ⏳ **Merge to main** - When you're confident everything works

---

**You're doing it right!** 🎉 Testing locally on `develop` before merging to `main` is the best practice.

