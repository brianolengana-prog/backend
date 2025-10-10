# Enterprise Extractor - Integration Guide

## 🚀 Quick Start

### **Option 1: Direct Integration (Recommended for Testing)**

Update `optimizedHybridExtraction.service.js`:

```javascript
// At the top of the file
const enterpriseExtractor = require('./enterprise/ExtractionAdapter');

// In extractContacts method, replace:
// const patternResults = await this.robustExtractor.extractContacts(normalizedText, { ... });

// With:
const patternResults = await enterpriseExtractor.extractContacts(normalizedText, {
  extractionId: options.extractionId,
  rolePreferences: options.rolePreferences
});
```

---

### **Option 2: Feature Flag (Gradual Rollout)**

1. **Set environment variable**:
   ```bash
   # In .env file
   USE_ENTERPRISE_EXTRACTOR=true
   ```

2. **Update service**:
   ```javascript
   const config = require('../config/extraction.config');
   const enterpriseExtractor = require('./enterprise/ExtractionAdapter');
   const robustExtractor = require('./robustCallSheetExtractor.service');
   
   // In extractContacts method:
   const extractor = config.USE_ENTERPRISE_EXTRACTOR 
     ? enterpriseExtractor 
     : robustExtractor;
   
   const patternResults = await extractor.extractContacts(normalizedText, options);
   ```

---

### **Option 3: Side-by-Side Comparison (Best for Validation)**

1. **Enable comparison mode**:
   ```bash
   # In .env file
   USE_ENTERPRISE_EXTRACTOR=true
   RUN_EXTRACTION_COMPARISON=true
   ```

2. **Run both extractors**:
   ```javascript
   const config = require('../config/extraction.config');
   const enterpriseExtractor = require('./enterprise/ExtractionAdapter');
   const robustExtractor = require('./robustCallSheetExtractor.service');
   
   // Extract with both
   const [enterpriseResult, robustResult] = await Promise.all([
     enterpriseExtractor.extractContacts(normalizedText, options),
     robustExtractor.extractContacts(normalizedText, options)
   ]);
   
   // Log comparison
   if (config.RUN_SIDE_BY_SIDE_COMPARISON) {
     logger.info('📊 Extraction Comparison', {
       extractionId: options.extractionId,
       enterprise: {
         count: enterpriseResult.contacts.length,
         confidence: enterpriseResult.metadata.confidence,
         quality: enterpriseResult.metadata.qualityGrade,
         time: enterpriseResult.processingTime
       },
       robust: {
         count: robustResult.contacts.length,
         time: robustResult.processingTime
       },
       difference: {
         contactCount: enterpriseResult.contacts.length - robustResult.contacts.length,
         timeImprovement: robustResult.processingTime - enterpriseResult.processingTime
       }
     });
   }
   
   // Use enterprise result
   const patternResults = config.USE_ENTERPRISE_EXTRACTOR 
     ? enterpriseResult 
     : robustResult;
   ```

---

## 🔧 **Step-by-Step Integration**

### **Step 1: Update optimizedHybridExtraction.service.js**

Find this section (around line 54-70):

```javascript
// OLD CODE:
const patternResults = await this.robustExtractor.extractContacts(normalizedText, {
  extractionId: options.extractionId,
  rolePreferences: options.rolePreferences
});
```

Replace with:

```javascript
// NEW CODE:
const config = require('../config/extraction.config');
const enterpriseExtractor = require('./enterprise/ExtractionAdapter');

// Use enterprise or robust based on config
const extractor = config.USE_ENTERPRISE_EXTRACTOR 
  ? enterpriseExtractor 
  : this.robustExtractor;

const patternResults = await extractor.extractContacts(normalizedText, {
  extractionId: options.extractionId,
  rolePreferences: options.rolePreferences
});

// Log which extractor was used
logger.info('🔧 Extraction method', {
  extractionId: options.extractionId,
  method: config.USE_ENTERPRISE_EXTRACTOR ? 'enterprise' : 'robust-patterns',
  confidence: patternResults.metadata?.confidence,
  quality: patternResults.metadata?.qualityGrade
});
```

---

### **Step 2: Create .env Configuration**

Add to your `.env` file:

```bash
# Extraction Configuration
USE_ENTERPRISE_EXTRACTOR=true
RUN_EXTRACTION_COMPARISON=false
LOG_EXTRACTION_METRICS=true
MIN_CONFIDENCE=0.7
EXTRACTION_TIMEOUT=60000
EXTRACTION_MIGRATION_PHASE=testing
```

---

### **Step 3: Test Locally**

```bash
# Start backend
cd /home/bkg/parrot/node/backend
npm run dev

# Upload a call sheet through frontend
# Watch logs for extraction metrics
```

Expected logs:

```
🏢 Starting enterprise extraction
🧹 Text normalized
📄 Text parsed into lines
🔍 Components extracted: { roles: 12, names: 15, phones: 12, emails: 3 }
🔗 Contacts assembled: 12 contacts
✅ Component-first extraction complete
📊 Extraction quality assessment: { grade: 'EXCELLENT', confidence: 0.85 }
```

---

### **Step 4: Compare Results**

Enable comparison mode:

```bash
USE_ENTERPRISE_EXTRACTOR=true
RUN_EXTRACTION_COMPARISON=true
```

Upload call sheet and check logs for:

```json
{
  "message": "📊 Extraction Comparison",
  "enterprise": {
    "count": 25,
    "confidence": "0.82",
    "quality": "EXCELLENT",
    "time": 18
  },
  "robust": {
    "count": 23,
    "time": 27
  },
  "difference": {
    "contactCount": 2,
    "timeImprovement": 9
  }
}
```

---

## 📊 **Monitoring**

### **Key Metrics to Watch**

1. **Contact Count**
   - Enterprise should find same or more contacts
   - If fewer, investigate rejected contacts

2. **Confidence Score**
   - EXCELLENT (0.8+): Production ready
   - GOOD (0.65-0.8): Review recommended
   - ACCEPTABLE (0.5-0.65): Needs improvement
   - POOR (<0.5): Manual review required

3. **Processing Time**
   - Enterprise should be 20-40% faster
   - Single-pass vs multi-pass architecture

4. **Rejection Rate**
   - Lower is better
   - High rate indicates validation may be too strict

---

### **Logging Best Practices**

```javascript
// After extraction
logger.info('📈 Extraction Summary', {
  extractionId,
  method: 'enterprise',
  contacts: {
    found: result.contacts.length,
    rejected: result.metadata.quality.rejectionRate
  },
  quality: {
    grade: result.quality.grade,
    confidence: result.quality.averageConfidence,
    recommendation: result.quality.recommendation
  },
  performance: {
    processingTime: result.processingTime,
    textLength: text.length,
    contactsPerSecond: (result.contacts.length / (result.processingTime / 1000)).toFixed(1)
  },
  components: result.metadata.components
});
```

---

## 🧪 **Testing**

### **Unit Tests**

```bash
cd /home/bkg/parrot/node/backend
npm test -- ComponentContactExtractor.test.js
```

### **Integration Tests**

Upload these test call sheets:

1. **Structured Format** (should get EXCELLENT grade):
   ```
   PHOTOGRAPHER: John Doe / 917-555-1234
   STYLIST: Jane Smith / jane@example.com
   MUA: Alice Brown / 646-555-7777
   ```

2. **Mixed Format** (should get GOOD grade):
   ```
   Photographer: John Doe - 917.555.1234
   Jane Smith | Stylist | jane@example.com
   MUA: Alice Brown / 646-555-7777
   ```

3. **Unstructured** (should get ACCEPTABLE/POOR grade):
   ```
   John Doe can be reached at 917-555-1234
   Contact Jane Smith for styling: jane@example.com
   Alice Brown is our makeup artist (646-555-7777)
   ```

---

## 🐛 **Troubleshooting**

### **Issue: No contacts extracted**

**Check:**
1. Text normalization working?
   - Log: `🧹 Text normalized`
2. Components found?
   - Log: `🔍 Components extracted`
3. Validation too strict?
   - Check `isValidContact` rules

**Fix:**
- Review validation rules
- Check confidence thresholds
- Verify text has proper format

---

### **Issue: Too many rejections**

**Check:**
- Rejection rate in logs
- Warning messages for rejected contacts

**Fix:**
- Adjust validation rules in `isValidContact`
- Lower confidence thresholds
- Review role/name patterns

---

### **Issue: Wrong contacts extracted**

**Check:**
- Component extraction accuracy
- Proximity grouping logic

**Fix:**
- Review component patterns
- Adjust proximity threshold
- Check line parsing logic

---

### **Issue: Performance slower than expected**

**Check:**
- Text length
- Component count
- Validation overhead

**Fix:**
- Profile with console.time
- Optimize validation rules
- Consider caching

---

## 🔄 **Rollback Plan**

If issues arise:

1. **Immediate rollback**:
   ```bash
   USE_ENTERPRISE_EXTRACTOR=false
   ```

2. **Verify old system working**:
   - Upload test call sheet
   - Check extraction works

3. **Investigate issue**:
   - Review logs
   - Check test failures
   - Identify root cause

4. **Fix and retry**:
   - Apply fixes
   - Test locally
   - Re-enable gradually

---

## 📝 **Checklist**

### **Pre-Integration**
- [ ] Tests passing
- [ ] Environment variables set
- [ ] Logs configured

### **Integration**
- [ ] Code updated in `optimizedHybridExtraction.service.js`
- [ ] Config file created
- [ ] Adapter working

### **Testing**
- [ ] Unit tests pass
- [ ] Test call sheets uploaded
- [ ] Metrics logged correctly
- [ ] Side-by-side comparison done

### **Production**
- [ ] Feature flag enabled
- [ ] Monitoring in place
- [ ] Rollback plan ready
- [ ] Team notified

---

## 🎉 **Success Criteria**

Enterprise extractor is successful when:

1. ✅ **Same or better accuracy** vs old system
2. ✅ **20-40% faster** processing time
3. ✅ **Higher confidence** scores (0.7+)
4. ✅ **Lower rejection** rate (<20%)
5. ✅ **All tests** passing
6. ✅ **No critical** bugs

---

**Ready to integrate? Start with Option 1 for quick testing!**

