# Service Deprecation Guide 🗑️
**Legacy Extraction Services - Deprecation Plan**
*Date: 2025-10-08*

---

## 🎯 OBJECTIVE

Deprecate legacy extraction services in favor of the new unified architecture:
- Mark old services as deprecated
- Provide migration paths
- Set sunset dates
- Ensure backward compatibility during transition

---

## 📋 SERVICES TO DEPRECATE

### **1. Legacy Services (Not Recommended)**

| Service | File | Status | Replacement |
|---------|------|--------|-------------|
| `extraction.service.js` | `/services/` | ⚠️ Deprecated | `extraction-refactored.service.js` |
| `simpleExtraction.service.js` | `/services/` | ⚠️ Deprecated | `ExtractionOrchestrator` |
| `aiExtraction.service.js` | `/services/` | ⚠️ Deprecated | `optimizedAIUsage.service.js` |
| `hybridExtractionService` | `/services/` | ⚠️ Deprecated | `ExtractionMigrationService` |

### **2. Services to Keep (Modern Architecture)**

| Service | File | Status | Purpose |
|---------|------|--------|---------|
| `extraction-refactored.service.js` | `/services/` | ✅ Active | Main entry point |
| `ExtractionOrchestrator.js` | `/services/extraction/` | ✅ Active | Core orchestration |
| `DocumentProcessor.js` | `/services/extraction/` | ✅ Active | Text extraction |
| `ContactExtractor.js` | `/services/extraction/` | ✅ Active | Pattern extraction |
| `ContactValidator.js` | `/services/extraction/` | ✅ Active | Validation |
| `ExtractionMigrationService.js` | `/services/enterprise/` | ✅ Active | Routing layer |
| `optimizedHybridExtraction.service.js` | `/services/` | ✅ Active | Hybrid extraction |
| `optimizedAIUsage.service.js` | `/services/` | ✅ Active | Smart AI usage |

---

## 📅 DEPRECATION TIMELINE

### **Phase 1: Soft Deprecation** (Current - Month 1)
- ✅ Mark services as deprecated in code
- ✅ Add deprecation warnings to logs
- ✅ Update documentation
- ✅ No breaking changes

### **Phase 2: Migration Period** (Month 2-3)
- Update all routes to use new services
- Monitor usage of old services
- Send deprecation notices to users (if API is public)
- Provide migration guides

### **Phase 3: Hard Deprecation** (Month 4)
- Old services throw deprecation errors
- Force migration to new services
- Only allow legacy services via feature flag

### **Phase 4: Removal** (Month 5+)
- Remove old service files
- Clean up dependencies
- Update all documentation

---

## 🔧 IMPLEMENTATION

### **1. Add Deprecation Warnings**

Add deprecation notices to each legacy service:

```javascript
/**
 * @deprecated This service is deprecated and will be removed in v3.0.0
 * Please use ExtractionOrchestrator or extraction-refactored.service.js instead
 * Migration guide: /docs/migration-guide.md
 */
class LegacyExtractionService {
  constructor() {
    console.warn(`
      ⚠️  DEPRECATION WARNING ⚠️
      
      LegacyExtractionService is deprecated and will be removed in v3.0.0.
      Please migrate to ExtractionOrchestrator.
      
      Migration guide: /docs/migration-guide.md
      Sunset date: 2025-03-08
    `);
  }
  
  // ... rest of code
}
```

### **2. Update Documentation**

Add deprecation notices to JSDoc comments:

```javascript
/**
 * Extract contacts from document
 * 
 * @deprecated since v2.0.0, use extractionService.extractContacts() instead
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type
 * @returns {Promise<ExtractionResult>}
 */
async function legacyExtractContacts(buffer, mimeType) {
  console.warn('legacyExtractContacts is deprecated, use extractionService.extractContacts()');
  // ... implementation
}
```

### **3. Add Feature Flags**

Allow legacy services only via feature flag:

```javascript
// In .env
ALLOW_LEGACY_SERVICES=false
LEGACY_SERVICE_SUNSET_DATE=2025-03-08

// In code
if (!process.env.ALLOW_LEGACY_SERVICES) {
  throw new Error(`
    Legacy extraction services are no longer supported.
    Please upgrade to the new extraction architecture.
    Contact support for migration assistance.
  `);
}
```

---

## 🔄 MIGRATION PATHS

### **From `extraction.service.js` → `extraction-refactored.service.js`**

**Before:**
```javascript
const extractionService = require('./services/extraction.service');

const result = await extractionService.extractContacts(buffer, mimeType, fileName);
```

**After:**
```javascript
const extractionService = require('./services/extraction-refactored.service');

const result = await extractionService.extractContacts(buffer, mimeType, fileName);
```

**Changes:**
- ✅ Same interface (backward compatible)
- ✅ Better performance
- ✅ Modular architecture

---

### **From `aiExtraction.service.js` → `optimizedAIUsage.service.js`**

**Before:**
```javascript
const aiService = require('./services/aiExtraction.service');

const result = await aiService.extractContacts(buffer, mimeType, fileName);
```

**After:**
```javascript
const aiService = require('./services/optimizedAIUsage.service');

const result = await aiService.enhanceContacts(text, patternContacts);
```

**Changes:**
- ⚠️ Different interface (AI is now enhancement, not primary extraction)
- ✅ Rate limiting built-in
- ✅ Cost optimization
- ✅ Better error handling

---

### **From `hybridExtractionService` → `ExtractionMigrationService`**

**Before:**
```javascript
const hybridService = require('./services/hybridExtraction.service');

const result = await hybridService.extractContacts(buffer, mimeType, fileName);
```

**After:**
```javascript
const migrationService = require('./services/enterprise/ExtractionMigrationService');

const result = await migrationService.extractContacts(text, options);
```

**Changes:**
- ⚠️ Works with text instead of buffer (separate text extraction step)
- ✅ Smart routing (legacy vs enterprise)
- ✅ Feature flags
- ✅ Gradual rollout support

---

## 📊 DEPRECATION METRICS

### **Track Usage**

Monitor usage of deprecated services:

```javascript
const deprecationMetrics = {
  'extraction.service.js': 0,
  'aiExtraction.service.js': 0,
  'hybridExtraction.service.js': 0
};

function trackDeprecatedUsage(serviceName) {
  deprecationMetrics[serviceName]++;
  
  // Log weekly
  if (Date.now() % (7 * 24 * 60 * 60 * 1000) < 1000) {
    console.log('📊 Deprecated Service Usage (last 7 days):', deprecationMetrics);
  }
}
```

### **Migration Progress**

Track migration progress:

```
Week 1: 100% legacy usage
Week 2: 75% legacy, 25% new
Week 3: 50% legacy, 50% new
Week 4: 25% legacy, 75% new
Week 5: 0% legacy, 100% new ✅
```

---

## 🚨 BREAKING CHANGES

### **v3.0.0 (Planned)**

**Removed:**
- `extraction.service.js`
- `aiExtraction.service.js`
- `hybridExtraction.service.js`
- `simpleExtraction.service.js`

**Added:**
- Full enforcement of new architecture
- No backward compatibility with old services

**Migration Required:**
- All code must use `extraction-refactored.service.js` or `ExtractionOrchestrator`

---

## ✅ DEPRECATION CHECKLIST

### **Code Updates**

- [x] Mark services as @deprecated in JSDoc
- [x] Add console warnings to deprecated services
- [ ] Update all internal routes to use new services
- [ ] Add feature flags for legacy services
- [ ] Set sunset dates

### **Documentation**

- [x] Create deprecation guide (this document)
- [ ] Update README with deprecation notices
- [ ] Create migration guide for external users
- [ ] Update API documentation

### **Communication**

- [ ] Email notification to users (if public API)
- [ ] Blog post about migration
- [ ] Update changelog
- [ ] Update release notes

### **Testing**

- [x] Test new services work correctly
- [ ] Test backward compatibility
- [ ] Test feature flags
- [ ] Test error messages

### **Monitoring**

- [ ] Track usage of deprecated services
- [ ] Set up alerts for legacy service usage
- [ ] Monitor migration progress
- [ ] Track error rates

---

## 🎯 RECOMMENDED ACTIONS

### **For Developers**

1. **Stop using deprecated services immediately**
   - Update all new code to use `extraction-refactored.service.js`
   - Use `ExtractionOrchestrator` for modular access

2. **Migrate existing code**
   - Identify all usages of deprecated services
   - Update to new services (use migration paths above)
   - Test thoroughly

3. **Monitor deprecation warnings**
   - Check logs for deprecation warnings
   - Track which code is still using legacy services

### **For DevOps**

1. **Set sunset dates in environment**
   ```bash
   LEGACY_SERVICE_SUNSET_DATE=2025-03-08
   ALLOW_LEGACY_SERVICES=true  # Set to false after migration
   ```

2. **Monitor service usage**
   - Track calls to deprecated services
   - Alert when usage increases

3. **Plan removal**
   - Schedule code cleanup
   - Archive old service files
   - Update deployment scripts

---

## 📝 NOTES

### **Backward Compatibility**

During the deprecation period:
- ✅ Old services will continue to work
- ✅ Deprecation warnings will be logged
- ✅ No breaking changes until v3.0.0

### **Support**

If you need help migrating:
1. Review migration paths above
2. Check code examples in new services
3. Contact the development team

### **Exceptions**

If you must use legacy services:
1. Set `ALLOW_LEGACY_SERVICES=true`
2. Document why (technical debt)
3. Create migration ticket
4. Set migration deadline

---

**Status:** In Progress  
**Current Phase:** Soft Deprecation  
**Sunset Date:** 2025-03-08  
**Migration Deadline:** 2025-02-08

---

**Document Created:** 2025-10-08  
**Last Updated:** 2025-10-08  
**Author:** AI Assistant  
**Reviewed By:** Pending

