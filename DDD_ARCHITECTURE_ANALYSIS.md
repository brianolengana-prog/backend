# DDD Architecture Analysis - Extraction Workflow

> **Date**: 2025-01-17  
> **Status**: ⚠️ **PARTIALLY IMPLEMENTED** - DDD exists but not fully integrated  
> **Feature Flag**: `USE_NEW_EXTRACTION` controls DDD usage

---

## 🎯 Executive Summary

**Current State**: The backend has a **complete DDD architecture** for extraction, but it's **behind a feature flag** and **not the default**. The current extraction workflow primarily uses **legacy services** with **direct Prisma calls**, violating DDD principles.

**Key Finding**: The DDD architecture is **production-ready** but **disabled by default**. Enabling it requires:
1. Setting `USE_NEW_EXTRACTION=true` environment variable
2. Migrating persistence layer to use repositories
3. Removing direct Prisma calls from routes

---

## 📊 Architecture Comparison

### **DDD Architecture (Exists but Disabled)**

```
src/domains/extraction/
├── entities/
│   ├── ExtractionJob.js      ✅ Domain entity
│   └── Contact.js             ✅ Domain entity
├── services/
│   ├── ExtractionService.js   ✅ Orchestration service (DDD)
│   ├── ExtractionStrategyFactory.js  ✅ Strategy factory (DDD)
│   └── ExtractionServiceAdapter.js   ✅ Adapter for migration
├── strategies/
│   ├── base/ExtractionStrategy.js     ✅ Strategy interface
│   ├── pattern/PatternExtractionStrategy.js  ✅ Pattern strategy
│   └── ai/AIExtractionStrategy.js     ✅ AI strategy
├── repositories/
│   └── ExtractionJobRepository.js     ✅ Repository pattern
├── value-objects/
│   ├── Document.js            ✅ Value object
│   ├── ExtractionResult.js    ✅ Value object
│   └── ExtractionMetadata.js  ✅ Value object
└── integration/
    └── extraction-integration.helper.js  ✅ Migration helper
```

**DDD Principles Applied**:
- ✅ **Entities**: `ExtractionJob`, `Contact` (domain objects with identity)
- ✅ **Value Objects**: `Document`, `ExtractionResult`, `ExtractionMetadata` (immutable)
- ✅ **Repositories**: `ExtractionJobRepository` (data access abstraction)
- ✅ **Services**: `ExtractionService` (orchestration, no direct DB access)
- ✅ **Strategies**: Pattern & AI strategies (Strategy Pattern)
- ✅ **Factory**: `ExtractionStrategyFactory` (object creation)

---

### **Current Implementation (Legacy)**

```
src/routes/extraction.routes.js
├── Direct Prisma calls (19 instances)  ❌ Violates DDD
├── Legacy services:
│   ├── extraction-refactored.service.js  ❌ Not DDD
│   ├── ExtractionMigrationService       ❌ Not DDD
│   ├── optimizedAIExtraction.service.js ❌ Not DDD
│   └── robustCallSheetExtractor.service.js ❌ Not DDD
└── Feature flag check:
    └── USE_NEW_EXTRACTION (disabled by default)
```

**Violations**:
- ❌ **Direct Prisma calls** in routes (19 instances)
- ❌ **No repository pattern** in persistence layer
- ❌ **Business logic** in routes (should be in services)
- ❌ **Mixed architecture** (some DDD, mostly legacy)

---

## 🔍 Detailed Analysis

### **1. Feature Flag Control**

**File**: `src/routes/extraction.routes.js` (Lines 423-477)

```javascript
// Check feature flag
const useNewExtraction = featureFlags.isEnabledForUser('USE_NEW_EXTRACTION', userId);

if (useNewExtraction) {
  // ✅ Use DDD ExtractionService
  const extractionService = new ExtractionService();
  const extractionResult = await extractionService.extractContacts(...)
} else {
  // ❌ Fallback to legacy service
  const extractionPromise = migrationService.extractContacts(...)
}
```

**Current State**:
- Feature flag defaults to `false` (environment variable not set)
- Legacy service used by default
- DDD architecture only used if explicitly enabled

**Environment Variable**:
```bash
USE_NEW_EXTRACTION=true  # Enable DDD architecture
USE_NEW_EXTRACTION_PERCENTAGE=100  # 100% rollout
```

---

### **2. Direct Prisma Calls (Violation)**

**File**: `src/routes/extraction.routes.js`

**Found 19 Direct Prisma Calls**:
```javascript
// Line 225: Cache check
const recentExtraction = await prisma.job.findFirst({...})

// Line 369: Job creation
const job = await prisma.job.create({...})

// Line 694: Job creation
const job = await prisma.job.create({...})

// Line 740: Jobs query
const jobs = await prisma.job.findMany({...})

// Line 759: Job count
const totalJobs = await prisma.job.count({...})

// Line 793: Job lookup
const job = await prisma.job.findFirst({...})

// Line 807: Contacts query
const contacts = await prisma.contact.findMany({...})

// Line 836: Job lookup
const job = await prisma.job.findFirst({...})

// Line 851: Job deletion
await prisma.job.delete({...})

// Lines 908, 1010, 1086, 1158: More job creations
```

**DDD Violation**: Routes should **NOT** directly access database. Should use repositories instead.

**Should Be**:
```javascript
// ✅ DDD Way
const jobRepository = new ExtractionJobRepository()
const recentExtraction = await jobRepository.findRecentByFileHash(userId, fileHash)
```

---

### **3. Persistence Layer (Not Using Repository)**

**File**: `src/services/database/ExtractionPersistence.service.js`

**Current Implementation**:
```javascript
class ExtractionPersistenceService {
  async saveExtractionWithTransaction(params) {
    // ❌ Direct Prisma usage
    const result = await prisma.$transaction(async (tx) => {
      await tx.job.create({...})
      await tx.contact.createMany({...})
    })
  }
}
```

**DDD Way**:
```javascript
// ✅ Should use repositories
class ExtractionPersistenceService {
  constructor(jobRepository, contactRepository) {
    this.jobRepository = jobRepository
    this.contactRepository = contactRepository
  }
  
  async saveExtractionWithTransaction(params) {
    // Use repository methods
    const job = await this.jobRepository.createAsEntity({...})
    await this.contactRepository.createMany({...})
  }
}
```

---

### **4. DDD Services (Well-Designed)**

**File**: `src/domains/extraction/services/ExtractionService.js`

**✅ Good DDD Practices**:
- Dependency injection
- No direct database access
- Uses value objects (`Document`, `ExtractionResult`)
- Orchestrates strategies via factory
- Clean separation of concerns

**Architecture**:
```javascript
class ExtractionService {
  constructor(dependencies = {}) {
    this.strategyFactory = dependencies.strategyFactory || new ExtractionStrategyFactory()
    // ✅ No Prisma, no direct DB access
  }
  
  async extractContacts(fileBuffer, mimeType, fileName, options) {
    // 1. Extract text (via processor)
    const extractedText = await this._extractText(...)
    
    // 2. Create Document value object
    const document = Document.fromFile(...)
    
    // 3. Analyze document
    const documentAnalysis = this._analyzeDocument(document, extractedText)
    
    // 4. Select strategy (via factory)
    const strategy = await this.strategyFactory.selectStrategy(documentAnalysis, options)
    
    // 5. Extract contacts (via strategy)
    const extractionResult = await strategy.extract(extractedText, options)
    
    // 6. Return ExtractionResult value object
    return ExtractionResult.success(contacts, metadata, strategy, processingTime)
  }
}
```

**✅ This is proper DDD architecture!**

---

### **5. Strategy Pattern (Well-Implemented)**

**File**: `src/domains/extraction/strategies/pattern/PatternExtractionStrategy.js`

**✅ Good Practices**:
- Extends base `ExtractionStrategy`
- Returns `ExtractionResult` value object
- Adapter pattern for legacy `RobustCallSheetExtractor`
- Dependency injection

**Strategy Selection** (Factory):
```javascript
// ExtractionStrategyFactory.selectStrategy()
// ✅ Matches current hybrid logic:
// 1. Try pattern first (fast, free)
// 2. Use AI if pattern confidence < 0.7
// 3. Matches frontend behavior
```

---

### **6. Repository Pattern (Exists but Not Used)**

**File**: `src/domains/extraction/repositories/ExtractionJobRepository.js`

**✅ Well-Designed Repository**:
- Extends `BaseRepository`
- Domain-specific queries (`findRecentByFileHash`, `getStats`)
- Returns domain entities (`ExtractionJob`)
- Proper abstraction layer

**Methods Available**:
- `findByIdAsEntity(id)` - Returns `ExtractionJob` entity
- `findRecentByFileHash(userId, fileHash)` - Cache lookup
- `createAsEntity(data)` - Creates and returns entity
- `updateStatus(id, status)` - Status updates
- `getStats(userId, days)` - Statistics

**❌ Problem**: Not used in routes! Routes use direct Prisma instead.

---

## 🔄 Migration Path

### **Phase 1: Enable DDD (Immediate)**

**Step 1**: Enable feature flag
```bash
# .env
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=100
```

**Step 2**: Test with DDD enabled
- Monitor extraction success rate
- Compare results with legacy
- Check performance metrics

**Step 3**: Gradual rollout (if needed)
```bash
USE_NEW_EXTRACTION_PERCENTAGE=25  # 25% of users
# Monitor for 24-48 hours
USE_NEW_EXTRACTION_PERCENTAGE=50  # 50% of users
# Monitor for 24-48 hours
USE_NEW_EXTRACTION_PERCENTAGE=100 # 100% rollout
```

---

### **Phase 2: Migrate Persistence Layer**

**Current**: `ExtractionPersistence.service.js` uses direct Prisma

**Target**: Use repositories

**Changes Needed**:
```javascript
// Before (Current)
class ExtractionPersistenceService {
  async saveExtractionWithTransaction(params) {
    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.job.create({...})
      await tx.contact.createMany({...})
    })
  }
}

// After (DDD)
class ExtractionPersistenceService {
  constructor(jobRepository, contactRepository) {
    this.jobRepository = jobRepository
    this.contactRepository = contactRepository
  }
  
  async saveExtractionWithTransaction(params) {
    // Use repository methods
    const job = await this.jobRepository.createAsEntity({...})
    await this.contactRepository.createMany({...})
  }
}
```

---

### **Phase 3: Remove Direct Prisma Calls from Routes**

**Current**: 19 direct Prisma calls in `extraction.routes.js`

**Target**: All database access via repositories

**Changes Needed**:

1. **Cache Check** (Line 225):
```javascript
// Before
const recentExtraction = await prisma.job.findFirst({...})

// After
const jobRepository = new ExtractionJobRepository()
const recentExtraction = await jobRepository.findRecentByFileHash(userId, fileHash)
```

2. **Job Creation** (Multiple locations):
```javascript
// Before
const job = await prisma.job.create({...})

// After
const jobRepository = new ExtractionJobRepository()
const job = await jobRepository.createAsEntity({...})
```

3. **Job Queries**:
```javascript
// Before
const jobs = await prisma.job.findMany({...})

// After
const jobRepository = new ExtractionJobRepository()
const result = await jobRepository.findByUserId(userId, { page, limit })
```

---

## 📋 Current vs DDD Comparison

| Aspect | Current (Legacy) | DDD Architecture |
|--------|------------------|------------------|
| **Service Layer** | `extraction-refactored.service.js` | ✅ `ExtractionService` (DDD) |
| **Strategy Selection** | Hardcoded in service | ✅ `ExtractionStrategyFactory` |
| **Data Access** | Direct Prisma (19 calls) | ✅ `ExtractionJobRepository` |
| **Persistence** | `ExtractionPersistence.service.js` (Prisma) | ⚠️ Should use repositories |
| **Value Objects** | Plain objects | ✅ `Document`, `ExtractionResult` |
| **Entities** | Prisma models | ✅ `ExtractionJob`, `Contact` |
| **Feature Flag** | Disabled by default | ⚠️ Needs enabling |

---

## ✅ What's Working (DDD)

1. **ExtractionService**: Well-designed orchestration service
2. **Strategy Factory**: Automatic strategy selection
3. **Strategies**: Clean pattern & AI implementations
4. **Value Objects**: Proper immutability and validation
5. **Repository**: Well-designed data access layer
6. **Entities**: Domain objects with business logic

---

## ❌ What's Missing (Migration Needed)

1. **Feature Flag**: Disabled by default
2. **Route Integration**: Routes use legacy services
3. **Persistence Layer**: Not using repositories
4. **Direct Prisma Calls**: 19 instances in routes
5. **Legacy Services**: Still imported and used

---

## 🎯 Recommendations

### **Immediate Actions**:

1. **Enable DDD Architecture**:
   ```bash
   # Set in .env
   USE_NEW_EXTRACTION=true
   USE_NEW_EXTRACTION_PERCENTAGE=100
   ```

2. **Test DDD Flow**:
   - Upload test files
   - Verify extraction works
   - Compare results with legacy
   - Monitor performance

3. **Monitor for Issues**:
   - Check logs for errors
   - Verify contact counts match
   - Ensure jobId generation works

### **Short-Term (1-2 weeks)**:

1. **Migrate Persistence Layer**:
   - Update `ExtractionPersistence.service.js` to use repositories
   - Remove direct Prisma calls
   - Test atomic transactions

2. **Update Routes**:
   - Replace direct Prisma calls with repository methods
   - Use `ExtractionJobRepository` for all job operations
   - Use `ContactRepository` for all contact operations

3. **Remove Legacy Services**:
   - Once DDD is stable, remove legacy service imports
   - Clean up unused code

### **Long-Term (1-2 months)**:

1. **Complete Migration**:
   - Remove feature flag (make DDD default)
   - Remove legacy services
   - Update all routes to use DDD

2. **Enhance DDD**:
   - Add more value objects
   - Enhance domain events
   - Add domain services

---

## 🧪 Testing DDD Architecture

### **Enable Feature Flag**:
```bash
# Backend .env
USE_NEW_EXTRACTION=true
USE_NEW_EXTRACTION_PERCENTAGE=100
```

### **Test Extraction**:
1. Upload a PDF call sheet
2. Check backend logs for:
   ```
   🎯 Using new ExtractionService with automatic strategy selection
   ```
3. Verify extraction works correctly
4. Check database for job + contacts

### **Verify DDD Usage**:
```javascript
// Check logs for:
domainLogger.info('🎯 Using new ExtractionService...')
// NOT:
console.log('🚀 Starting extraction with timeout protection...')
```

---

## 📊 Code Quality Metrics

### **DDD Architecture**:
- ✅ **Separation of Concerns**: Excellent
- ✅ **Dependency Injection**: Implemented
- ✅ **Repository Pattern**: Implemented
- ✅ **Value Objects**: Implemented
- ✅ **Domain Entities**: Implemented
- ✅ **Strategy Pattern**: Implemented

### **Current Implementation**:
- ⚠️ **Separation of Concerns**: Mixed (routes have business logic)
- ❌ **Dependency Injection**: Not used in routes
- ❌ **Repository Pattern**: Not used (direct Prisma)
- ⚠️ **Value Objects**: Not used (plain objects)
- ⚠️ **Domain Entities**: Not used (Prisma models)
- ✅ **Strategy Pattern**: Used (but via legacy services)

---

## 🎯 Conclusion

**The DDD architecture is well-designed and production-ready**, but it's **not being used by default**. The current extraction workflow violates DDD principles by:

1. Using legacy services instead of DDD services
2. Making direct Prisma calls instead of using repositories
3. Having business logic in routes instead of services

**To fully adopt DDD**:
1. ✅ Enable `USE_NEW_EXTRACTION` feature flag
2. ✅ Migrate persistence layer to use repositories
3. ✅ Remove direct Prisma calls from routes
4. ✅ Remove legacy service dependencies

**The DDD architecture is ready - it just needs to be enabled and integrated!** 🚀

