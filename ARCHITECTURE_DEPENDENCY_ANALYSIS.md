# Architecture Dependency Analysis
## Current State - Service Dependencies Map

**Purpose**: Understand current dependencies before refactoring

---

## 🔍 Current Service Dependencies

### Extraction Services Dependency Graph

```
extraction.routes.js
├── extraction-refactored.service.js
│   ├── extraction/ExtractionOrchestrator.js
│   │   ├── DocumentProcessor.js
│   │   ├── DocumentAnalyzer.js
│   │   ├── ContactExtractor.js
│   │   └── ContactValidator.js
│   └── extraction/LibraryManager.js
│
├── enterprise/ExtractionMigrationService.js
│   ├── enterprise/EnhancedAdaptiveExtraction.service.js
│   ├── optimizedAIUsage.service.js
│   ├── optimizedHybridExtraction.service.js
│   └── adaptiveExtraction.service.js
│
├── optimizedAIExtraction.service.js
│   └── [OpenAI API]
│
├── awsTextract.service.js
│   └── [AWS SDK]
│
├── usage.service.js
│   └── subscription.service.js
│       └── stripe.service.js
│
└── database/ExtractionPersistence.service.js
    └── [Prisma Direct]
```

### Issues Identified

#### 1. Circular Dependencies (Potential)
```
adaptiveExtraction.service.js
  → simpleExtraction.service.js
    → extraction-refactored.service.js
      → extraction/ExtractionOrchestrator.js
        → [might import adaptiveExtraction]
```

#### 2. Direct Prisma Usage
**Services using Prisma directly:**
- `contacts.service.js` (17 instances)
- `dashboard.service.js` (multiple)
- `extraction/ExtractionOrchestrator.js` (1 instance)
- `database/ExtractionPersistence.service.js` (multiple)

**Services using repositories:**
- `auth.service.js` → `user.repository.js`
- `subscription.service.js` → `subscription.repository.js`

#### 3. Mixed Service Patterns
- **Singleton pattern**: `extraction-refactored.service.js` (module.exports = new Service())
- **Class pattern**: `ExtractionOrchestrator` (class, instantiated)
- **Mixed**: Some services export class, some export instance

---

## 📊 Service Inventory

### Root Level Services (src/services/)

| Service | Lines | Dependencies | Prisma Usage | Status |
|---------|-------|--------------|--------------|--------|
| `adaptiveExtraction.service.js` | ~500 | simpleExtraction, aiExtraction | ❌ No | ⚠️ Deprecated |
| `adaptiveExtraction.service.js.backup` | - | - | - | 🗑️ Remove |
| `adaptivePattern.service.js` | ~200 | - | ❌ No | ⚠️ Review |
| `aiExtraction.service.js` | ~300 | OpenAI | ❌ No | ⚠️ Deprecated |
| `auth.service.js` | ~400 | email, subscription, repositories | ❌ No | ✅ Keep |
| `awsTextract.service.js` | ~200 | AWS SDK | ❌ No | ✅ Keep |
| `billing.service.js` | ~300 | stripe, subscription | ❌ No | ✅ Keep |
| `contacts.service.js` | ~500 | export, Prisma direct | ✅ Yes | ⚠️ Refactor |
| `contextAwareAI.service.js` | ~200 | OpenAI | ❌ No | ⚠️ Review |
| `dashboard.service.js` | ~300 | usage, subscription, stripe, Prisma | ✅ Yes | ⚠️ Refactor |
| `documentAnalysis.service.js` | ~200 | - | ❌ No | ✅ Keep |
| `email.service.js` | ~150 | Nodemailer | ❌ No | ✅ Keep |
| `export.service.js` | ~300 | - | ❌ No | ✅ Keep |
| `extraction-refactored.service.js` | ~120 | extraction/ | ❌ No | ✅ Keep |
| `extraction.service.js` | ~400 | Prisma | ✅ Yes | ⚠️ Deprecated |
| `hybridExtraction.service.js` | ~400 | multiple | ❌ No | ⚠️ Review |
| `intelligentStrategy.service.js` | ~200 | - | ❌ No | ⚠️ Review |
| `jobProcessor.service.js` | ~300 | multiple extraction services | ❌ No | ⚠️ Review |
| `optimizedAIExtraction.service.js` | ~300 | OpenAI | ❌ No | ✅ Keep |
| `optimizedAIUsage.service.js` | ~200 | - | ❌ No | ✅ Keep |
| `optimizedHybridExtraction.service.js` | ~200 | robustCallSheetExtractor | ❌ No | ✅ Keep |
| `predefinedPrompts.service.js` | ~150 | - | ❌ No | ✅ Keep |
| `queue.service.js` | ~200 | hybridExtraction | ❌ No | ⚠️ Review |
| `robustCallSheetExtractor.service.js` | ~1000 | - | ❌ No | ✅ Keep |
| `simpleExtraction.service.js` | ~100 | extraction-refactored | ❌ No | ⚠️ Deprecated |
| `simpleExtraction.service.js.backup` | - | - | - | 🗑️ Remove |
| `stripe.service.js` | ~300 | Stripe SDK | ❌ No | ✅ Keep |
| `subscription.service.js` | ~300 | stripe, repository | ❌ No | ✅ Keep |
| `upgradeWorkflow.service.js` | ~200 | subscription, usage | ❌ No | ✅ Keep |
| `usage.service.js` | ~300 | subscription, Prisma | ✅ Yes | ⚠️ Refactor |

### Subdirectory Services

#### `services/extraction/` (6 files)
- ✅ Well organized
- ✅ Clear separation
- ✅ No Prisma usage
- **Action**: Keep structure, move to `domains/extraction/`

#### `services/enterprise/` (10 files)
- ⚠️ Mixed concerns
- ⚠️ Some duplication
- **Action**: Refactor into extraction domain strategies

#### `services/database/` (1 file)
- ⚠️ Direct Prisma usage
- **Action**: Convert to repository pattern

---

## 🎯 Refactoring Priorities

### High Priority (Breaking Issues)

1. **Remove Direct Prisma Usage**
   - `contacts.service.js` → Create `ContactRepository`
   - `dashboard.service.js` → Create repositories
   - `usage.service.js` → Create `UsageRepository`
   - `extraction/ExtractionOrchestrator.js` → Use repository

2. **Eliminate Circular Dependencies**
   - Map all dependencies
   - Break cycles with interfaces/abstractions
   - Use dependency injection

3. **Remove Backup Files**
   - Delete all `.backup-*` files
   - Clean up unused code

### Medium Priority (Code Quality)

4. **Consolidate Extraction Services**
   - Merge similar services
   - Remove deprecated services
   - Create strategy pattern

5. **Standardize Service Patterns**
   - Choose singleton OR class pattern
   - Consistent export style
   - Consistent naming

6. **Organize by Domain**
   - Move services to domain folders
   - Clear domain boundaries
   - Shared code in shared/

### Low Priority (Nice to Have)

7. **Improve Documentation**
   - Add JSDoc comments
   - Create architecture diagrams
   - Update README

8. **Add Type Safety**
   - Consider TypeScript migration
   - Add runtime validation
   - Use Zod schemas

---

## 🔄 Migration Strategy

### Step 1: Create New Structure (Non-Breaking)
- Create new directories
- Keep old code in place
- New code in new structure
- Feature flags to switch

### Step 2: Migrate Infrastructure (Low Risk)
- Create base repository
- Create infrastructure services
- Update imports gradually

### Step 3: Migrate Domain by Domain (Medium Risk)
- Start with simplest domain
- Migrate one domain at a time
- Test thoroughly before next

### Step 4: Migrate API Layer (Medium Risk)
- Create controllers
- Update routes
- Maintain backward compatibility

### Step 5: Cleanup (Low Risk)
- Remove old code
- Update all imports
- Final testing

---

## 📋 Dependency Rules (Target State)

### Allowed Dependencies

```
Routes → Controllers → Services → Repositories → Database
         ↓
        DTOs
         ↓
      Entities
```

### Forbidden Dependencies

- ❌ Services → Routes/Controllers
- ❌ Repositories → Services
- ❌ Domain → Infrastructure (except interfaces)
- ❌ Circular dependencies

### Dependency Injection

Use constructor injection:

```javascript
// ✅ GOOD
class ContactService {
  constructor(contactRepository, exportService) {
    this.repository = contactRepository;
    this.exportService = exportService;
  }
}

// ❌ BAD
class ContactService {
  constructor() {
    this.repository = require('../repositories/ContactRepository');
  }
}
```

---

## 🧹 Cleanup Checklist

### Files to Remove
- [ ] `adaptiveExtraction.service.js.backup-1759739852032`
- [ ] `simpleExtraction.service.js.backup-1759739852032`
- [ ] `extraction.routes.js.backup-1759739852032`
- [ ] Any other `.backup-*` files

### Services to Deprecate
- [ ] `extraction.service.js` (replaced by extraction-refactored)
- [ ] `simpleExtraction.service.js` (replaced by extraction-refactored)
- [ ] `aiExtraction.service.js` (replaced by optimizedAIExtraction)
- [ ] `adaptiveExtraction.service.js` (being replaced by enterprise)

### Services to Consolidate
- [ ] `hybridExtraction.service.js` + `optimizedHybridExtraction.service.js`
- [ ] `adaptivePattern.service.js` + `intelligentStrategy.service.js`
- [ ] `contextAwareAI.service.js` (merge into AI strategy)

---

*This analysis will be updated as we progress through the refactoring.*

