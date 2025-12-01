# Phase 2 Integration Guide
## Testing and Integrating the New Extraction Architecture

**Status**: ✅ Ready for Testing  
**Feature Flag**: `USE_NEW_EXTRACTION` (disabled by default)

---

## 🧪 Testing the New Architecture

### Step 1: Run Integration Test

```bash
# Test all components together
node test-phase2-integration.js
```

**Expected Output:**
- ✅ Strategy Factory finds available strategies
- ✅ Strategy selection works
- ✅ Extraction Service extracts contacts
- ✅ Value objects work correctly
- ✅ Error handling works

---

### Step 2: Test via API (Feature Flag OFF)

**Current State:**
- Feature flag is OFF by default
- Old routes continue to work
- New routes available but disabled

**Test New Routes:**
```bash
# This will return 403 (feature flag disabled)
curl -X POST http://localhost:3001/api/extraction/v2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-call-sheet.pdf"
```

**Response:**
```json
{
  "success": false,
  "error": "New extraction architecture not enabled for this user",
  "useLegacyEndpoint": "/api/extraction/upload"
}
```

---

### Step 3: Enable Feature Flag (Testing)

**Option A: Enable for All Users**
```bash
# Set environment variable
export USE_NEW_EXTRACTION=true
```

**Option B: Enable for Percentage of Users**
```bash
# Enable for 10% of users
export USE_NEW_EXTRACTION=true
export USE_NEW_EXTRACTION_PERCENTAGE=10
```

**Option C: Enable for Specific User (Testing)**
- Modify feature flag service temporarily
- Or set percentage to 100

---

### Step 4: Test New Architecture

**Once enabled, test the new endpoint:**

```bash
# Upload file using new architecture
curl -X POST http://localhost:3001/api/extraction/v2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-call-sheet.pdf"
```

**Expected Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "completed",
  "result": {
    "contacts": [...],
    "metadata": {
      "architecture": "v2",
      "strategy": "PatternExtractionStrategy",
      "processingTime": 1234
    }
  }
}
```

---

## 🔍 Available Test Endpoints

### 1. Health Check
```bash
GET /api/extraction/v2/health
```

**Response:**
```json
{
  "success": true,
  "architecture": "v2",
  "health": {
    "initialized": true,
    "strategyFactory": "available",
    "documentProcessor": "lazy-load",
    "contactValidator": "lazy-load"
  },
  "featureFlag": {
    "enabled": false,
    "percentage": 0
  }
}
```

### 2. Available Strategies
```bash
GET /api/extraction/v2/strategies
```

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "name": "PatternExtractionStrategy",
      "confidence": 0.95,
      "available": true,
      "cost": "free",
      "speed": "fast"
    }
  ],
  "recommendations": {
    "best": {
      "name": "PatternExtractionStrategy",
      "confidence": 0.95
    },
    "reasoning": "PatternExtractionStrategy selected with 95% confidence..."
  }
}
```

### 3. Upload (V2)
```bash
POST /api/extraction/v2/upload
Content-Type: multipart/form-data
Authorization: Bearer TOKEN

file: [binary]
```

---

## 📊 Comparison: Old vs New

### Old Architecture (Current)
```
Route → extractionService (legacy)
         → Multiple services
         → Direct Prisma calls
         → Mixed concerns
```

### New Architecture (V2)
```
Route → ExtractionService (orchestration)
         → StrategyFactory (selection)
         → Selected Strategy (extraction)
         → Repository (data access)
         → Clean separation
```

---

## ✅ Integration Checklist

### Testing
- [x] Integration test passes
- [ ] API health check works
- [ ] Strategies endpoint works
- [ ] Upload endpoint works (with feature flag)
- [ ] Contacts are extracted correctly
- [ ] Database persistence works
- [ ] Error handling works

### Feature Flag Testing
- [ ] Feature flag OFF - old routes work
- [ ] Feature flag ON - new routes work
- [ ] Percentage rollout works
- [ ] Rollback works (disable flag)

### Production Readiness
- [ ] All tests pass
- [ ] Performance is acceptable
- [ ] Error handling is robust
- [ ] Logging is comprehensive
- [ ] Documentation is complete

---

## 🚀 Gradual Rollout Plan

### Week 1: Internal Testing
```bash
# Enable for 0% (testing only)
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=0

# Test manually with specific users
```

### Week 2: Small Rollout
```bash
# Enable for 5% of users
USE_NEW_EXTRACTION_PERCENTAGE=5

# Monitor metrics
# Check for errors
```

### Week 3: Medium Rollout
```bash
# Enable for 25% of users
USE_NEW_EXTRACTION_PERCENTAGE=25

# Continue monitoring
```

### Week 4: Full Rollout
```bash
# Enable for 100% of users
USE_NEW_EXTRACTION_PERCENTAGE=100

# Monitor for a week
# Then remove old code
```

---

## 🔧 Troubleshooting

### Issue: Feature Flag Not Working
**Solution:**
- Check environment variables
- Restart server
- Verify feature flag service is loaded

### Issue: New Architecture Returns Errors
**Solution:**
- Check logs for details
- Verify all dependencies are available
- Test with integration test script
- Fallback to old architecture automatically

### Issue: Contacts Not Saving
**Solution:**
- Check database connection
- Verify repository is working
- Check job creation
- Review error logs

---

## 📝 Next Steps

1. **Test Integration** ✅ (Done - test script passes)
2. **Enable Feature Flag** (For testing)
3. **Test API Endpoints** (V2 routes)
4. **Monitor Performance** (Compare old vs new)
5. **Gradual Rollout** (5% → 25% → 100%)
6. **Remove Old Code** (After full migration)

---

*Phase 2 is ready for integration testing! 🚀*

