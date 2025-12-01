# Architecture Visual Guide
## Target Architecture - Visual Representation

---

## 🏗️ Current vs Target Architecture

### Current Architecture (Scattered)

```
src/
├── services/                    ❌ 30+ files, no organization
│   ├── adaptiveExtraction.service.js
│   ├── aiExtraction.service.js
│   ├── hybridExtraction.service.js
│   ├── optimizedAIExtraction.service.js
│   ├── robustCallSheetExtractor.service.js
│   ├── contacts.service.js      ❌ Direct Prisma
│   ├── dashboard.service.js      ❌ Direct Prisma
│   ├── extraction/
│   ├── enterprise/
│   └── [backup files]
│
├── routes/                      ⚠️ Business logic mixed in
│   └── extraction.routes.js     ❌ 1300+ lines
│
├── repositories/                ⚠️ Only 5 files, underutilized
│   └── user.repository.js
│
└── utils/                       ⚠️ Mixed utilities
    └── [6 files]
```

### Target Architecture (Clean & Organized)

```
src/
├── domains/                     ✅ Domain-driven organization
│   ├── extraction/
│   │   ├── entities/
│   │   ├── services/
│   │   ├── strategies/
│   │   ├── processors/
│   │   ├── validators/
│   │   └── repositories/
│   │
│   ├── contacts/
│   │   ├── entities/
│   │   ├── services/
│   │   └── repositories/
│   │
│   ├── auth/
│   │   ├── entities/
│   │   ├── services/
│   │   └── repositories/
│   │
│   └── billing/
│       ├── entities/
│       ├── services/
│       └── repositories/
│
├── shared/                      ✅ Shared infrastructure
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── queue/
│   │   └── cache/
│   ├── utils/
│   ├── middleware/
│   ├── types/
│   └── config/
│
├── api/                         ✅ API layer
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   └── dto/
│
└── workers/                     ✅ Background workers
    ├── extraction/
    ├── cleanup/
    └── billing/
```

---

## 📐 Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes     │→ │ Controllers  │→ │     DTOs     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Use Cases  │→ │   Services   │→ │  Domain Svc  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Entities   │  │ Value Objects│  │ Domain Logic │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                INFRASTRUCTURE LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Repositories │  │   External   │  │    Queue     │      │
│  │              │  │   Services    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            ▼                                  │
│                   ┌──────────────┐                           │
│                   │   Database   │                           │
│                   └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Example: Contact Extraction

### Current Flow (Messy)

```
POST /api/extraction/upload
    │
    ▼
extraction.routes.js (1300+ lines)
    │
    ├─→ extraction-refactored.service.js
    │       │
    │       ├─→ extraction/ExtractionOrchestrator.js
    │       │       │
    │       │       ├─→ DocumentProcessor.js
    │       │       ├─→ ContactExtractor.js
    │       │       └─→ ContactValidator.js
    │       │
    │       └─→ [Prisma direct calls] ❌
    │
    ├─→ enterprise/ExtractionMigrationService.js
    │       │
    │       └─→ [Multiple extraction services]
    │
    ├─→ usage.service.js
    │       │
    │       └─→ [Prisma direct] ❌
    │
    └─→ database/ExtractionPersistence.service.js
            │
            └─→ [Prisma direct] ❌
```

### Target Flow (Clean)

```
POST /api/extraction/upload
    │
    ▼
api/routes/extraction.routes.js (thin, ~50 lines)
    │
    ▼
api/controllers/ExtractionController.js
    │
    ├─→ Validate request (DTO)
    │
    ├─→ domains/extraction/services/ExtractionService.js
    │       │
    │       ├─→ domains/extraction/strategies/StrategyFactory.js
    │       │       │
    │       │       └─→ Select strategy (Pattern/AI/OCR/Hybrid)
    │       │
    │       ├─→ domains/extraction/processors/DocumentProcessor.js
    │       │
    │       └─→ domains/extraction/validators/ContactValidator.js
    │
    ├─→ domains/extraction/repositories/ExtractionJobRepository.js
    │       │
    │       └─→ shared/infrastructure/database/PrismaClient.js
    │
    ├─→ domains/contacts/repositories/ContactRepository.js
    │       │
    │       └─→ shared/infrastructure/database/PrismaClient.js
    │
    └─→ domains/billing/services/UsageService.js
            │
            └─→ domains/billing/repositories/UsageRepository.js
```

---

## 🎯 Domain Boundaries

### Extraction Domain

```
domains/extraction/
│
├── entities/
│   ├── ExtractionJob.js          # Job entity
│   └── Contact.js                # Contact entity (extraction context)
│
├── value-objects/
│   ├── Document.js               # Document value object
│   ├── ExtractionResult.js       # Result value object
│   └── ExtractionMetadata.js     # Metadata value object
│
├── services/
│   ├── ExtractionService.js       # Main orchestration
│   ├── ExtractionStrategyFactory.js  # Strategy selection
│   └── DocumentAnalysisService.js   # Document analysis
│
├── strategies/
│   ├── base/
│   │   └── ExtractionStrategy.js    # Interface
│   ├── pattern/
│   │   └── PatternExtractionStrategy.js
│   ├── ai/
│   │   └── AIExtractionStrategy.js
│   ├── ocr/
│   │   └── OCRExtractionStrategy.js
│   └── hybrid/
│       └── HybridExtractionStrategy.js
│
├── processors/
│   ├── DocumentProcessor.js      # Text extraction
│   └── PDFProcessor.js           # PDF-specific
│
├── validators/
│   ├── ContactValidator.js        # Contact validation
│   └── ExtractionValidator.js    # Extraction validation
│
└── repositories/
    ├── ExtractionJobRepository.js
    └── ContactRepository.js       # Extraction-specific
```

### Contacts Domain

```
domains/contacts/
│
├── entities/
│   └── Contact.js                # Contact entity (business context)
│
├── services/
│   ├── ContactService.js          # Business logic
│   ├── ContactExportService.js    # Export functionality
│   └── ContactSearchService.js    # Search functionality
│
└── repositories/
    └── ContactRepository.js       # Data access
```

### Auth Domain

```
domains/auth/
│
├── entities/
│   ├── User.js
│   └── Session.js
│
├── services/
│   ├── AuthService.js
│   ├── TokenService.js
│   ├── PasswordService.js
│   └── OAuthService.js
│
└── repositories/
    ├── UserRepository.js
    └── SessionRepository.js
```

### Billing Domain

```
domains/billing/
│
├── entities/
│   ├── Subscription.js
│   ├── Payment.js
│   └── Usage.js
│
├── services/
│   ├── BillingService.js
│   ├── SubscriptionService.js
│   ├── StripeService.js
│   └── UsageService.js
│
└── repositories/
    ├── SubscriptionRepository.js
    ├── PaymentRepository.js
    └── UsageRepository.js
```

---

## 🔌 Dependency Injection Pattern

### Service with Dependencies

```javascript
// domains/extraction/services/ExtractionService.js
class ExtractionService {
  constructor(
    strategyFactory,
    documentProcessor,
    contactValidator,
    jobRepository,
    contactRepository
  ) {
    this.strategyFactory = strategyFactory;
    this.documentProcessor = documentProcessor;
    this.contactValidator = contactValidator;
    this.jobRepository = jobRepository;
    this.contactRepository = contactRepository;
  }
  
  async extract(fileBuffer, mimeType, fileName, options) {
    // Use injected dependencies
  }
}
```

### Controller with Services

```javascript
// api/controllers/ExtractionController.js
class ExtractionController {
  constructor(
    extractionService,
    usageService,
    performanceMonitor
  ) {
    this.extractionService = extractionService;
    this.usageService = usageService;
    this.performanceMonitor = performanceMonitor;
  }
  
  async upload(req, res, next) {
    // Use injected services
  }
}
```

### Dependency Container (Future)

```javascript
// shared/infrastructure/container.js
class Container {
  constructor() {
    this.services = new Map();
  }
  
  register(name, factory) {
    this.services.set(name, factory);
  }
  
  resolve(name) {
    const factory = this.services.get(name);
    return factory(this);
  }
}

// Usage
const container = new Container();
container.register('extractionService', (c) => {
  return new ExtractionService(
    c.resolve('strategyFactory'),
    c.resolve('documentProcessor'),
    // ...
  );
});
```

---

## 📊 Module Communication

### Request Flow

```
Client Request
    │
    ▼
┌─────────────────┐
│   Express App    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Handler  │  (Thin, ~10 lines)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │  (Request validation, response formatting)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Domain Service  │  (Business logic)
└────────┬────────┘
         │
         ├─→ Strategy Selection
         ├─→ Document Processing
         ├─→ Contact Extraction
         └─→ Validation
         │
         ▼
┌─────────────────┐
│   Repository    │  (Data access)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Database     │
└─────────────────┘
```

### Response Flow

```
Database
    │
    ▼
Repository (Entity)
    │
    ▼
Domain Service (Business Logic)
    │
    ▼
Controller (DTO Transformation)
    │
    ▼
Route (Response Formatting)
    │
    ▼
Client Response
```

---

## 🎨 Code Organization Principles

### 1. Domain-Driven Design
- Organize by business domain, not technical layer
- Each domain is self-contained
- Clear domain boundaries

### 2. Dependency Rule
- Dependencies point inward (toward domain)
- Outer layers depend on inner layers
- Domain has no external dependencies

### 3. Single Responsibility
- Each class/function has one reason to change
- Clear separation of concerns
- Easy to test and maintain

### 4. Open/Closed Principle
- Open for extension (strategies)
- Closed for modification (core)
- Use interfaces and abstractions

### 5. Dependency Inversion
- Depend on abstractions, not concretions
- Use dependency injection
- Testable and flexible

---

## 📈 Migration Path Visualization

```
Week 1-2: Foundation
    │
    ├─→ Create directory structure
    ├─→ Base repository
    └─→ Infrastructure services
         │
         ▼
Week 3-4: Extraction Domain
    │
    ├─→ Entities & Value Objects
    ├─→ Services refactoring
    ├─→ Strategy pattern
    └─→ Repositories
         │
         ▼
Week 5-7: Other Domains
    │
    ├─→ Contacts domain
    ├─→ Auth domain
    └─→ Billing domain
         │
         ▼
Week 8: API Layer
    │
    ├─→ Controllers
    ├─→ DTOs
    └─→ Route refactoring
         │
         ▼
Week 9-10: Workers & Utils
    │
    ├─→ Worker refactoring
    └─→ Utility organization
         │
         ▼
Week 11-12: Cleanup
    │
    ├─→ Remove old code
    ├─→ Update imports
    └─→ Final testing
```

---

*This visual guide will be updated as the architecture evolves.*

