# Branching Strategy for Architecture Refactoring

## 🎯 Strategy Overview

**Recommended Approach**: **Incremental Merges** with feature branches per phase

This allows us to:
- ✅ Merge and deploy incrementally (not wait 12 weeks)
- ✅ Test each phase in production
- ✅ Get feedback early
- ✅ Avoid massive merge conflicts
- ✅ Rollback easily if issues arise

---

## 📋 Branching Structure

### Main Branches

```
main (production)
  │
  ├── develop (integration branch)
  │
  └── refactor/architecture-redesign (long-lived feature branch)
       │
       ├── refactor/phase-1-foundation
       ├── refactor/phase-2-extraction
       ├── refactor/phase-3-contacts
       ├── refactor/phase-4-auth
       ├── refactor/phase-5-billing
       ├── refactor/phase-6-api-layer
       ├── refactor/phase-7-workers
       ├── refactor/phase-8-utils
       └── refactor/phase-9-cleanup
```

---

## 🔄 Workflow: Incremental Merge Strategy

### Phase-by-Phase Approach

#### **Phase 1: Foundation (Weeks 1-2)**

```bash
# 1. Create long-lived feature branch
git checkout -b refactor/architecture-redesign
git push -u origin refactor/architecture-redesign

# 2. Create phase branch
git checkout -b refactor/phase-1-foundation

# 3. Work on Phase 1
# ... implement foundation code ...

# 4. Test thoroughly
npm test
npm run lint

# 5. Merge phase branch into feature branch
git checkout refactor/architecture-redesign
git merge refactor/phase-1-foundation

# 6. Create PR to develop (for testing)
git push origin refactor/architecture-redesign
# Create PR: refactor/architecture-redesign → develop

# 7. After testing, merge to develop
# (via PR review and approval)

# 8. Deploy to staging
# Test in staging environment

# 9. If all good, merge to main
# Deploy to production
```

#### **Phase 2-9: Repeat Pattern**

For each phase:
1. Create phase branch from `refactor/architecture-redesign`
2. Implement phase
3. Test locally
4. Merge to feature branch
5. Create PR to develop
6. Test in staging
7. Merge to main (if approved)
8. Deploy incrementally

---

## 🎯 Two Deployment Strategies

### Strategy A: Parallel Deployment (Recommended)

**Keep old and new code running in parallel**

```javascript
// Use feature flags to switch between old/new
const USE_NEW_ARCHITECTURE = process.env.USE_NEW_ARCHITECTURE === 'true';

if (USE_NEW_ARCHITECTURE) {
  // New architecture
  const ContactService = require('./domains/contacts/services/ContactService');
} else {
  // Old architecture
  const contactsService = require('./services/contacts.service');
}
```

**Benefits:**
- ✅ Can rollback instantly
- ✅ Test new code in production (gradual rollout)
- ✅ Zero downtime
- ✅ A/B testing capability

**Deployment Steps:**
1. Deploy new code (disabled by default)
2. Enable for internal testing (feature flag)
3. Enable for 10% of users
4. Monitor metrics
5. Gradually increase to 100%
6. Remove old code after full migration

### Strategy B: Big Bang Deployment

**Complete refactoring, then deploy all at once**

**Benefits:**
- ✅ Clean cutover
- ✅ No parallel code maintenance

**Risks:**
- ❌ Higher risk
- ❌ Harder to rollback
- ❌ All-or-nothing

**Not Recommended** for 12-week refactoring

---

## 📊 Recommended Approach: Hybrid

### Phase 1-2: Foundation + Extraction (Weeks 1-4)

**Strategy**: Merge to develop, test in staging, deploy to production with feature flags

```bash
# After Phase 1 & 2 complete
git checkout develop
git merge refactor/architecture-redesign

# Deploy with feature flag
USE_NEW_EXTRACTION=false  # Start disabled
```

**Gradual Rollout:**
1. Week 4: Deploy Phase 1-2 (disabled)
2. Week 5: Enable for 5% of extractions
3. Week 6: Enable for 25% of extractions
4. Week 7: Enable for 50% of extractions
5. Week 8: Enable for 100% of extractions

### Phase 3-5: Other Domains (Weeks 5-7)

**Strategy**: Merge incrementally, deploy with feature flags

```bash
# After each phase
git checkout develop
git merge refactor/phase-3-contacts  # or phase-4, phase-5

# Deploy with feature flags
USE_NEW_CONTACTS=false
USE_NEW_AUTH=false
USE_NEW_BILLING=false
```

### Phase 6-9: API Layer & Cleanup (Weeks 8-12)

**Strategy**: Final migration, remove old code

```bash
# After all phases complete
git checkout develop
git merge refactor/architecture-redesign

# Remove feature flags
# Remove old code
# Final cleanup
```

---

## 🔧 Feature Flag Implementation

### Create Feature Flag Service

**File**: `src/shared/infrastructure/features/feature-flags.service.js`

```javascript
/**
 * Feature Flag Service
 * Controls gradual rollout of new architecture
 */
class FeatureFlagsService {
  constructor() {
    this.flags = {
      // Extraction domain
      USE_NEW_EXTRACTION: process.env.USE_NEW_EXTRACTION === 'true',
      USE_NEW_EXTRACTION_PERCENTAGE: parseInt(process.env.USE_NEW_EXTRACTION_PERCENTAGE || '0', 10),
      
      // Contacts domain
      USE_NEW_CONTACTS: process.env.USE_NEW_CONTACTS === 'true',
      USE_NEW_CONTACTS_PERCENTAGE: parseInt(process.env.USE_NEW_CONTACTS_PERCENTAGE || '0', 10),
      
      // Auth domain
      USE_NEW_AUTH: process.env.USE_NEW_AUTH === 'true',
      
      // Billing domain
      USE_NEW_BILLING: process.env.USE_NEW_BILLING === 'true',
      
      // API layer
      USE_NEW_API_LAYER: process.env.USE_NEW_API_LAYER === 'true',
    };
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(featureName) {
    return this.flags[featureName] === true;
  }

  /**
   * Check if feature is enabled for user (percentage-based rollout)
   */
  isEnabledForUser(featureName, userId) {
    const flag = this.flags[featureName];
    if (!flag) return false;

    const percentageFlag = `${featureName}_PERCENTAGE`;
    const percentage = this.flags[percentageFlag] || 0;
    
    if (percentage === 0) return false;
    if (percentage >= 100) return true;

    // Hash user ID to get consistent assignment
    const hash = this.hashUserId(userId);
    const userPercentage = (hash % 100) + 1;
    
    return userPercentage <= percentage;
  }

  /**
   * Hash user ID for consistent percentage assignment
   */
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all flags (for debugging)
   */
  getAllFlags() {
    return { ...this.flags };
  }
}

module.exports = new FeatureFlagsService();
```

### Usage in Routes

**File**: `src/routes/extraction.routes.js` (example)

```javascript
const featureFlags = require('../shared/infrastructure/features/feature-flags.service');

router.post('/upload', async (req, res) => {
  const userId = req.user.id;
  
  // Check if new architecture is enabled for this user
  const useNewArchitecture = featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId);
  
  if (useNewArchitecture) {
    // New architecture
    const ExtractionController = require('../api/controllers/ExtractionController');
    const controller = new ExtractionController(/* dependencies */);
    return controller.upload(req, res);
  } else {
    // Old architecture (existing code)
    // ... existing extraction logic ...
  }
});
```

---

## 📋 Git Workflow Commands

### Initial Setup

```bash
# Create long-lived feature branch
git checkout main
git pull origin main
git checkout -b refactor/architecture-redesign
git push -u origin refactor/architecture-redesign
```

### For Each Phase

```bash
# Start new phase
git checkout refactor/architecture-redesign
git pull origin refactor/architecture-redesign
git checkout -b refactor/phase-1-foundation

# Work on phase...
git add .
git commit -m "feat: Phase 1 - Foundation infrastructure"

# Merge phase into feature branch
git checkout refactor/architecture-redesign
git merge refactor/phase-1-foundation
git push origin refactor/architecture-redesign

# Create PR to develop
# (via GitHub/GitLab UI or CLI)
gh pr create --base develop --head refactor/architecture-redesign --title "Phase 1: Foundation"
```

### After Testing

```bash
# Merge to develop
git checkout develop
git pull origin develop
git merge refactor/architecture-redesign
git push origin develop

# Deploy to staging
# Test in staging

# If approved, merge to main
git checkout main
git pull origin main
git merge develop
git push origin main

# Deploy to production
```

---

## 🚨 Rollback Strategy

### If Issues Arise

```bash
# Option 1: Disable feature flag (instant rollback)
# Set environment variable
USE_NEW_EXTRACTION=false

# Option 2: Revert merge
git checkout main
git revert -m 1 <merge-commit-hash>
git push origin main

# Option 3: Rollback deployment
# Use your deployment tool's rollback feature
```

### Rollback Checklist

- [ ] Disable feature flag
- [ ] Verify old code is working
- [ ] Check logs for errors
- [ ] Monitor metrics
- [ ] Fix issues in feature branch
- [ ] Re-test before re-enabling

---

## 📊 Progress Tracking

### Branch Status Board

| Phase | Branch | Status | PR | Staging | Production |
|-------|--------|--------|----|---------|-------------| 
| Phase 1 | refactor/phase-1-foundation | ✅ Complete | ✅ Merged | ✅ Deployed | ⏳ Pending |
| Phase 2 | refactor/phase-2-extraction | 🚧 In Progress | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| Phase 3 | refactor/phase-3-contacts | ⏳ Not Started | ⏳ Pending | ⏳ Pending | ⏳ Pending |
| ... | ... | ... | ... | ... | ... |

### Deployment Status

```
Production Deployment:
├── Phase 1: Foundation ✅ (100% enabled)
├── Phase 2: Extraction 🚧 (25% enabled, gradual rollout)
├── Phase 3: Contacts ⏳ (0% - not deployed)
└── ...
```

---

## ✅ Recommended Workflow Summary

1. **Create long-lived feature branch**: `refactor/architecture-redesign`
2. **For each phase**:
   - Create phase branch
   - Implement phase
   - Merge to feature branch
   - Create PR to develop
   - Test in staging
   - Merge to main (if approved)
   - Deploy with feature flag (disabled initially)
3. **Gradual rollout**:
   - Enable for small percentage
   - Monitor metrics
   - Gradually increase
   - Remove old code when 100% enabled
4. **Final cleanup**:
   - Remove feature flags
   - Remove old code
   - Update documentation

---

## 🎯 Benefits of This Approach

✅ **Incremental Deployment** - Deploy as we go, not all at once  
✅ **Low Risk** - Can rollback instantly with feature flags  
✅ **Continuous Testing** - Test each phase in production  
✅ **Early Feedback** - Get feedback early and adjust  
✅ **No Big Bang** - Avoid massive deployment risk  
✅ **Team Confidence** - See progress incrementally  

---

*This strategy allows us to refactor safely while maintaining production stability.*

