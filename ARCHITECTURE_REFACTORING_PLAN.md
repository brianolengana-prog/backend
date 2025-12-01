# Architecture Refactoring Plan
## Call Sheets Converter Backend - Complete Redesign

**Date:** 2025-01-XX  
**Status:** Planning Phase  
**Goal:** Transform scattered codebase into clean, maintainable, scalable architecture

---

## 📊 Current State Analysis

### 🔴 Critical Issues Identified

#### 1. **Service Layer Chaos**
- **Problem**: 30+ services scattered across root and subdirectories
- **Impact**: 
  - No clear domain boundaries
  - Difficult to find related code
  - Circular dependency risks
  - Inconsistent patterns

**Current Structure:**
```
src/services/
├── [20+ services at root] (adaptiveExtraction, aiExtraction, hybridExtraction, etc.)
├── extraction/ (6 modules)
├── enterprise/ (10 modules)
├── database/ (1 module)
└── [backup files mixed in]
```

#### 2. **Data Access Violations**
- **Problem**: Services directly use Prisma instead of repositories
- **Impact**:
  - Business logic coupled to database
  - Difficult to test
  - No abstraction layer
  - Inconsistent data access patterns

**Evidence:**
- `contacts.service.js` - Direct Prisma calls (17 instances)
- `dashboard.service.js` - Direct Prisma calls
- Only 5 repository files exist, but 30+ services need data access

#### 3. **Unclear Domain Boundaries**
- **Problem**: No clear domain separation
- **Impact**:
  - Extraction logic mixed with business logic
  - Authentication mixed with extraction
  - Billing mixed with contacts
  - No clear module boundaries

#### 4. **Inconsistent Naming & Patterns**
- **Problem**: Mixed naming conventions
- **Impact**:
  - `.service.js` vs no extension
  - Backup files with timestamps
  - Inconsistent class vs singleton patterns
  - Mixed camelCase and kebab-case

#### 5. **Dependency Management Issues**
- **Problem**: Circular dependencies and unclear imports
- **Impact**:
  - Services importing from multiple levels
  - Unclear dependency graph
  - Difficult to understand data flow

---

## 🎯 Target Architecture

### Clean Architecture Principles

We'll implement a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  Routes → Controllers → DTOs                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Application Layer                         │
│  Use Cases / Services → Domain Services                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Domain Layer                             │
│  Entities → Value Objects → Domain Services                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  Repositories → External Services → Queue → Cache          │
└─────────────────────────────────────────────────────────────┘
```

### Domain-Driven Design (DDD) Structure

Organize by **business domains** rather than technical layers:

```
src/
├── domains/
│   ├── extraction/          # Extraction domain
│   │   ├── entities/
│   │   ├── services/
│   │   ├── strategies/      # Extraction strategies
│   │   ├── processors/      # Document processors
│   │   └── validators/      # Contact validators
│   │
│   ├── contacts/            # Contact management domain
│   │   ├── entities/
│   │   ├── services/
│   │   └── repositories/
│   │
│   ├── auth/                # Authentication domain
│   │   ├── entities/
│   │   ├── services/
│   │   └── repositories/
│   │
│   ├── billing/             # Billing & subscriptions domain
│   │   ├── entities/
│   │   ├── services/
│   │   └── repositories/
│   │
│   └── jobs/                # Job management domain
│       ├── entities/
│       ├── services/
│       └── repositories/
│
├── shared/                  # Shared across domains
│   ├── infrastructure/      # Database, queue, cache
│   ├── utils/              # Utilities
│   ├── middleware/         # Express middleware
│   ├── types/              # TypeScript types
│   └── config/             # Configuration
│
├── api/                     # API layer
│   ├── routes/             # Route definitions
│   ├── controllers/        # Request handlers
│   ├── middleware/        # API-specific middleware
│   └── dto/               # Data transfer objects
│
└── workers/                # Background workers
    ├── extraction/
    ├── cleanup/
    └── billing/
```

---

## 📋 Detailed Refactoring Plan

### Phase 1: Foundation & Infrastructure (Week 1-2)

#### 1.1 Create Base Structure
**Goal**: Establish new directory structure without breaking existing code

**Tasks:**
- [ ] Create `src/domains/` directory structure
- [ ] Create `src/shared/` directory structure
- [ ] Create `src/api/` directory structure
- [ ] Create `src/workers/` directory structure
- [ ] Add migration guide documentation

**Files to Create:**
```
src/
├── domains/
│   ├── extraction/
│   │   └── README.md (migration notes)
│   ├── contacts/
│   ├── auth/
│   ├── billing/
│   └── jobs/
├── shared/
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── prisma.client.js (singleton)
│   │   │   └── transaction.manager.js
│   │   ├── queue/
│   │   │   └── queue.manager.js
│   │   └── cache/
│   ├── utils/
│   ├── middleware/
│   ├── types/
│   └── config/
└── api/
    ├── routes/
    ├── controllers/
    ├── middleware/
    └── dto/
```

#### 1.2 Repository Pattern Implementation
**Goal**: Create consistent data access layer

**Tasks:**
- [ ] Create base repository class
- [ ] Implement domain-specific repositories:
  - [ ] `ContactRepository`
  - [ ] `JobRepository`
  - [ ] `UserRepository` (enhance existing)
  - [ ] `SubscriptionRepository` (enhance existing)
  - [ ] `SessionRepository` (enhance existing)
  - [ ] `ProductionRepository`
  - [ ] `CallSheetRepository`
  - [ ] `UsageRepository`

**Base Repository Pattern:**
```javascript
// shared/infrastructure/database/base.repository.js
class BaseRepository {
  constructor(model, prisma) {
    this.model = model;
    this.prisma = prisma;
  }
  
  async findById(id) { }
  async findMany(where) { }
  async create(data) { }
  async update(id, data) { }
  async delete(id) { }
  async count(where) { }
}
```

#### 1.3 Infrastructure Services
**Goal**: Centralize infrastructure concerns

**Tasks:**
- [ ] Create `DatabaseManager` (Prisma singleton)
- [ ] Create `QueueManager` (enhance existing)
- [ ] Create `CacheManager` (if needed)
- [ ] Create `FileStorageManager` (S3/local)
- [ ] Create `LoggerService` (enhance existing)

---

### Phase 2: Domain Extraction (Week 3-4)

#### 2.1 Extraction Domain - Core Entities
**Goal**: Define extraction domain entities and value objects

**Tasks:**
- [ ] Create `ExtractionJob` entity
- [ ] Create `Contact` entity
- [ ] Create `Document` value object
- [ ] Create `ExtractionResult` value object
- [ ] Create `ExtractionMetadata` value object

**Structure:**
```
domains/extraction/
├── entities/
│   ├── ExtractionJob.js
│   ├── Contact.js
│   └── Document.js
├── value-objects/
│   ├── ExtractionResult.js
│   ├── ExtractionMetadata.js
│   └── ContactData.js
└── services/
```

#### 2.2 Extraction Domain - Services
**Goal**: Organize extraction services by responsibility

**Tasks:**
- [ ] Create `ExtractionOrchestrator` (refactor existing)
- [ ] Create `ExtractionStrategySelector` (new)
- [ ] Create `DocumentProcessor` (move from services/extraction/)
- [ ] Create `ContactExtractor` (move from services/extraction/)
- [ ] Create `ContactValidator` (move from services/extraction/)

**Strategy Pattern:**
```
domains/extraction/
├── strategies/
│   ├── base/
│   │   └── ExtractionStrategy.js (interface)
│   ├── pattern/
│   │   ├── PatternExtractionStrategy.js
│   │   └── RobustCallSheetExtractor.js (move)
│   ├── ai/
│   │   ├── AIExtractionStrategy.js
│   │   └── OptimizedAIExtractor.js (refactor)
│   ├── ocr/
│   │   ├── OCRExtractionStrategy.js
│   │   └── AWSTextractStrategy.js (refactor)
│   ├── hybrid/
│   │   └── HybridExtractionStrategy.js
│   └── adaptive/
│       └── AdaptiveExtractionStrategy.js
```

#### 2.3 Extraction Domain - Repositories
**Goal**: Data access for extraction domain

**Tasks:**
- [ ] Create `ExtractionJobRepository`
- [ ] Create `ContactRepository` (extraction-specific)
- [ ] Migrate from direct Prisma calls

---

### Phase 3: Domain Contacts (Week 5)

#### 3.1 Contacts Domain - Entities & Services
**Goal**: Separate contact management from extraction

**Tasks:**
- [ ] Create `Contact` entity (domain model)
- [ ] Create `ContactService` (business logic)
- [ ] Create `ContactRepository` (data access)
- [ ] Create `ContactExportService` (move export.service.js)
- [ ] Create `ContactSearchService` (search logic)

**Structure:**
```
domains/contacts/
├── entities/
│   └── Contact.js
├── services/
│   ├── ContactService.js
│   ├── ContactExportService.js
│   └── ContactSearchService.js
└── repositories/
    └── ContactRepository.js
```

---

### Phase 4: Domain Auth (Week 6)

#### 4.1 Auth Domain - Refactoring
**Goal**: Clean authentication domain

**Tasks:**
- [ ] Create `User` entity
- [ ] Create `Session` entity
- [ ] Create `AuthService` (refactor auth.service.js)
- [ ] Create `TokenService` (JWT management)
- [ ] Create `PasswordService` (password hashing)
- [ ] Enhance repositories (User, Session, etc.)

**Structure:**
```
domains/auth/
├── entities/
│   ├── User.js
│   └── Session.js
├── services/
│   ├── AuthService.js
│   ├── TokenService.js
│   ├── PasswordService.js
│   └── OAuthService.js
└── repositories/
    ├── UserRepository.js
    └── SessionRepository.js
```

---

### Phase 5: Domain Billing (Week 7)

#### 5.1 Billing Domain - Refactoring
**Goal**: Clean billing and subscription domain

**Tasks:**
- [ ] Create `Subscription` entity
- [ ] Create `Payment` entity
- [ ] Create `BillingService` (refactor billing.service.js)
- [ ] Create `SubscriptionService` (refactor subscription.service.js)
- [ ] Create `StripeService` (refactor stripe.service.js)
- [ ] Create `UsageService` (refactor usage.service.js)
- [ ] Enhance repositories

**Structure:**
```
domains/billing/
├── entities/
│   ├── Subscription.js
│   └── Payment.js
├── services/
│   ├── BillingService.js
│   ├── SubscriptionService.js
│   ├── StripeService.js
│   └── UsageService.js
└── repositories/
    ├── SubscriptionRepository.js
    └── PaymentRepository.js
```

---

### Phase 6: API Layer Refactoring (Week 8)

#### 6.1 Controllers Pattern
**Goal**: Separate route logic from business logic

**Tasks:**
- [ ] Create `ExtractionController`
- [ ] Create `ContactsController`
- [ ] Create `AuthController`
- [ ] Create `BillingController`
- [ ] Create `DashboardController`
- [ ] Refactor routes to use controllers

**Pattern:**
```javascript
// api/controllers/ExtractionController.js
class ExtractionController {
  constructor(extractionService, usageService) {
    this.extractionService = extractionService;
    this.usageService = usageService;
  }
  
  async upload(req, res, next) {
    // Request validation
    // Call service
    // Format response
    // Error handling
  }
}
```

#### 6.2 DTOs (Data Transfer Objects)
**Goal**: Type-safe request/response objects

**Tasks:**
- [ ] Create DTOs for all endpoints
- [ ] Request validation
- [ ] Response formatting

**Structure:**
```
api/dto/
├── extraction/
│   ├── UploadRequest.dto.js
│   └── ExtractionResponse.dto.js
├── contacts/
│   ├── ContactListRequest.dto.js
│   └── ContactResponse.dto.js
└── auth/
    ├── LoginRequest.dto.js
    └── AuthResponse.dto.js
```

#### 6.3 Route Refactoring
**Goal**: Clean, thin route handlers

**Tasks:**
- [ ] Refactor all routes to use controllers
- [ ] Remove business logic from routes
- [ ] Standardize error handling
- [ ] Add request validation middleware

---

### Phase 7: Workers Refactoring (Week 9)

#### 7.1 Worker Organization
**Goal**: Organize workers by domain

**Tasks:**
- [ ] Move extraction worker to `workers/extraction/`
- [ ] Move cleanup worker to `workers/cleanup/`
- [ ] Create billing worker (if needed)
- [ ] Refactor worker manager

**Structure:**
```
workers/
├── extraction/
│   ├── ExtractionWorker.js
│   └── ExtractionWorkerManager.js
├── cleanup/
│   └── CleanupWorker.js
└── manager/
    └── WorkerManager.js
```

---

### Phase 8: Shared Utilities (Week 10)

#### 8.1 Utility Organization
**Goal**: Organize shared utilities

**Tasks:**
- [ ] Categorize utilities:
  - [ ] `shared/utils/validation/`
  - [ ] `shared/utils/formatting/`
  - [ ] `shared/utils/security/`
  - [ ] `shared/utils/performance/`
- [ ] Create utility index files
- [ ] Document utility usage

**Structure:**
```
shared/utils/
├── validation/
│   ├── inputValidator.js
│   └── schemaValidator.js
├── formatting/
│   ├── contactFormatter.js
│   └── dateFormatter.js
├── security/
│   ├── fileHash.js
│   └── inputSanitizer.js
├── performance/
│   └── PerformanceMonitor.js
└── index.js
```

---

### Phase 9: Migration & Cleanup (Week 11-12)

#### 9.1 Gradual Migration
**Goal**: Migrate existing code without breaking changes

**Strategy:**
1. **Parallel Implementation**: New structure alongside old
2. **Feature Flags**: Use flags to switch between old/new
3. **Incremental Migration**: One domain at a time
4. **Testing**: Comprehensive tests before migration
5. **Rollback Plan**: Ability to rollback if issues

**Migration Order:**
1. Infrastructure (repositories, database)
2. Extraction domain (most complex)
3. Contacts domain
4. Auth domain
5. Billing domain
6. API layer
7. Workers
8. Cleanup old code

#### 9.2 Code Cleanup
**Goal**: Remove deprecated code

**Tasks:**
- [ ] Remove backup files
- [ ] Remove deprecated services
- [ ] Update all imports
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Performance testing

---

## 🏗️ Architecture Patterns

### 1. Repository Pattern
**Purpose**: Abstract data access

```javascript
// domains/contacts/repositories/ContactRepository.js
class ContactRepository extends BaseRepository {
  async findByJobId(jobId) {
    return this.prisma.contact.findMany({
      where: { jobId }
    });
  }
  
  async findByUserId(userId, options) {
    // Pagination, filtering, etc.
  }
}
```

### 2. Service Pattern
**Purpose**: Business logic encapsulation

```javascript
// domains/contacts/services/ContactService.js
class ContactService {
  constructor(contactRepository, exportService) {
    this.repository = contactRepository;
    this.exportService = exportService;
  }
  
  async getContacts(userId, options) {
    // Business logic
    // Validation
    // Call repository
    // Transform data
  }
}
```

### 3. Strategy Pattern (Extraction)
**Purpose**: Pluggable extraction strategies

```javascript
// domains/extraction/strategies/base/ExtractionStrategy.js
class ExtractionStrategy {
  async extract(text, options) {
    throw new Error('Must implement extract method');
  }
  
  getConfidence() { }
  getName() { }
}

// domains/extraction/strategies/pattern/PatternExtractionStrategy.js
class PatternExtractionStrategy extends ExtractionStrategy {
  async extract(text, options) {
    // Pattern extraction logic
  }
}
```

### 4. Factory Pattern (Strategy Selection)
**Purpose**: Create appropriate strategy

```javascript
// domains/extraction/services/ExtractionStrategyFactory.js
class ExtractionStrategyFactory {
  createStrategy(documentAnalysis, options) {
    if (documentAnalysis.type === 'call_sheet') {
      return new PatternExtractionStrategy();
    }
    // ... other strategies
  }
}
```

### 5. DTO Pattern
**Purpose**: Type-safe data transfer

```javascript
// api/dto/extraction/UploadRequest.dto.js
class UploadRequestDTO {
  constructor(file, options) {
    this.file = file;
    this.options = this.validateOptions(options);
  }
  
  validateOptions(options) {
    // Validation logic
  }
}
```

---

## 📐 Dependency Rules

### Dependency Flow (Clean Architecture)

```
Routes → Controllers → Services → Repositories → Database
         ↓
        DTOs
         ↓
      Entities
```

**Rules:**
1. **Routes** depend on **Controllers** only
2. **Controllers** depend on **Services** and **DTOs**
3. **Services** depend on **Repositories** and **Domain Entities**
4. **Repositories** depend on **Infrastructure** (Prisma)
5. **No circular dependencies**
6. **Domain layer** has no external dependencies

### Import Rules

```javascript
// ✅ GOOD: Domain service importing repository
const ContactRepository = require('../repositories/ContactRepository');

// ✅ GOOD: Controller importing service
const ContactService = require('../../domains/contacts/services/ContactService');

// ❌ BAD: Service importing controller
const ContactController = require('../../api/controllers/ContactController');

// ❌ BAD: Domain importing infrastructure directly
const { PrismaClient } = require('@prisma/client');
```

---

## 🧪 Testing Strategy

### Test Organization

```
__tests__/
├── domains/
│   ├── extraction/
│   │   ├── services/
│   │   ├── strategies/
│   │   └── repositories/
│   ├── contacts/
│   └── auth/
├── api/
│   ├── controllers/
│   └── routes/
└── shared/
    └── infrastructure/
```

### Testing Levels

1. **Unit Tests**: Services, repositories, utilities
2. **Integration Tests**: Service + repository, API endpoints
3. **E2E Tests**: Full workflows

---

## 📊 Migration Checklist

### Pre-Migration
- [ ] Full codebase analysis complete
- [ ] Architecture plan approved
- [ ] Test coverage baseline established
- [ ] Backup current codebase
- [ ] Create feature branch

### Phase 1: Foundation
- [ ] Directory structure created
- [ ] Base repository implemented
- [ ] Infrastructure services created
- [ ] Tests passing

### Phase 2-5: Domain Migration
- [ ] Domain entities created
- [ ] Domain services refactored
- [ ] Repositories implemented
- [ ] Old services deprecated (not deleted)
- [ ] Tests passing
- [ ] Documentation updated

### Phase 6: API Migration
- [ ] Controllers created
- [ ] DTOs implemented
- [ ] Routes refactored
- [ ] Tests passing

### Phase 7-8: Workers & Utils
- [ ] Workers refactored
- [ ] Utils organized
- [ ] Tests passing

### Phase 9: Cleanup
- [ ] All old code removed
- [ ] All imports updated
- [ ] Full test suite passing
- [ ] Performance benchmarks met
- [ ] Documentation complete

---

## 🎯 Success Criteria

### Code Quality
- ✅ Zero circular dependencies
- ✅ All services use repositories (no direct Prisma)
- ✅ Clear domain boundaries
- ✅ Consistent naming conventions
- ✅ No backup files in codebase
- ✅ 80%+ test coverage

### Architecture
- ✅ Clear layered architecture
- ✅ Domain-driven design principles
- ✅ Separation of concerns
- ✅ Dependency inversion
- ✅ Single responsibility

### Maintainability
- ✅ Easy to find related code
- ✅ Clear module boundaries
- ✅ Comprehensive documentation
- ✅ Consistent patterns
- ✅ Easy to extend

### Performance
- ✅ No performance regression
- ✅ Same or better response times
- ✅ Efficient database queries
- ✅ Proper caching where needed

---

## 🚨 Risk Mitigation

### Risks & Mitigation

1. **Breaking Changes**
   - **Risk**: Breaking existing functionality
   - **Mitigation**: Parallel implementation, feature flags, comprehensive testing

2. **Migration Time**
   - **Risk**: Takes longer than expected
   - **Mitigation**: Phased approach, incremental migration, prioritize critical paths

3. **Team Knowledge**
   - **Risk**: Team unfamiliar with new structure
   - **Mitigation**: Documentation, code reviews, pair programming

4. **Dependencies**
   - **Risk**: Circular dependencies during migration
   - **Mitigation**: Dependency analysis tools, strict import rules

---

## 📅 Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 2 weeks | Foundation & Infrastructure |
| Phase 2 | 2 weeks | Extraction Domain |
| Phase 3 | 1 week | Contacts Domain |
| Phase 4 | 1 week | Auth Domain |
| Phase 5 | 1 week | Billing Domain |
| Phase 6 | 1 week | API Layer |
| Phase 7 | 1 week | Workers |
| Phase 8 | 1 week | Shared Utils |
| Phase 9 | 2 weeks | Migration & Cleanup |
| **Total** | **12 weeks** | **Complete Refactoring** |

---

## 📚 Documentation Requirements

### During Migration
- [ ] Architecture decision records (ADRs)
- [ ] Migration progress tracking
- [ ] Code review notes
- [ ] Test results

### Post-Migration
- [ ] Updated API documentation
- [ ] Architecture overview
- [ ] Developer guide
- [ ] Domain guides
- [ ] Testing guide

---

## 🔄 Next Steps

1. **Review & Approve Plan** - Team review of this plan
2. **Create Feature Branch** - `refactor/architecture-redesign`
3. **Set Up CI/CD** - Ensure tests run on every commit
4. **Start Phase 1** - Begin foundation work
5. **Daily Standups** - Track progress and blockers

---

*This plan is a living document and will be updated as we progress through the refactoring.*

