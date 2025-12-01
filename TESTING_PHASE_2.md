# Testing Phase 2 - Quick Start Guide
## How to Test the New Extraction Architecture

---

## ✅ Integration Test Results

**Status**: ✅ **PASSED**

```
✅ Strategy Factory - Found strategies
✅ Strategy Selection - Pattern strategy selected
✅ Extraction Service - Extracted 4 contacts
✅ Value Objects - Working correctly
✅ Error Handling - Graceful failures
```

---

## 🧪 Quick Tests

### Test 1: Integration Script
```bash
node test-phase2-integration.js
```

**Expected**: All tests pass ✅

### Test 2: Health Check
```bash
curl http://localhost:3001/api/extraction/v2/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: Returns health status

### Test 3: List Strategies
```bash
curl http://localhost:3001/api/extraction/v2/strategies \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected**: Lists available strategies

### Test 4: Upload (Requires Feature Flag)
```bash
# First, enable feature flag
export USE_NEW_EXTRACTION=true
export USE_NEW_EXTRACTION_PERCENTAGE=100

# Restart server, then:
curl -X POST http://localhost:3001/api/extraction/v2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-call-sheet.pdf"
```

**Expected**: Extracts contacts using new architecture

---

## 🔄 Feature Flag Control

### Current State
- **Feature Flag**: `USE_NEW_EXTRACTION=false` (disabled)
- **Old Routes**: `/api/extraction/upload` (working)
- **New Routes**: `/api/extraction/v2/*` (available, disabled by default)

### Enable for Testing
```bash
# In .env or environment
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=100  # All users
```

### Enable Gradual Rollout
```bash
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=10  # 10% of users
```

---

## 📊 What We've Built

### New Architecture Components
1. ✅ **ExtractionService** - Main orchestration
2. ✅ **ExtractionStrategyFactory** - Strategy selection
3. ✅ **PatternExtractionStrategy** - Pattern-based extraction
4. ✅ **AIExtractionStrategy** - AI-powered extraction
5. ✅ **ExtractionJobRepository** - Data access
6. ✅ **Value Objects** - Immutable results
7. ✅ **Domain Entities** - Business logic

### Integration Components
1. ✅ **ExtractionServiceAdapter** - Backward compatibility
2. ✅ **V2 Routes** - Test endpoints
3. ✅ **Integration Helper** - Feature flag integration
4. ✅ **Tests** - Unit and integration tests

---

## 🎯 Testing Checklist

- [x] Integration test script passes
- [ ] Health check endpoint works
- [ ] Strategies endpoint works
- [ ] Upload endpoint works (with feature flag)
- [ ] Contacts extracted correctly
- [ ] Database persistence works
- [ ] Error handling works
- [ ] Feature flag controls access
- [ ] Old routes still work

---

## 🚀 Next Steps

1. **Enable Feature Flag** (for testing)
2. **Test V2 Endpoints** (verify functionality)
3. **Compare Results** (old vs new)
4. **Monitor Performance** (check metrics)
5. **Gradual Rollout** (5% → 25% → 100%)

---

*Ready for testing! Enable feature flag and test the new architecture! 🎉*

