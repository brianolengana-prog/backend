# Unified Frontend-Backend Refactoring Plan
## Enterprise-Grade End-to-End Architecture

**Goal**: Create a seamless, optimized, enterprise-grade extraction system that leverages clean backend architecture with intelligent frontend integration.

**Date**: January 2025  
**Status**: 🚧 Planning Phase

---

## 🎯 Executive Summary

### Current State Analysis

**Frontend (sjcallsheets-project):**
- ✅ Upload page with client-side processing
- ✅ Hybrid processing service (pattern + AI fallback)
- ✅ Multiple extraction service implementations (scattered)
- ⚠️ Inconsistent API response handling
- ⚠️ No strategy selection from frontend
- ⚠️ Client-side extraction logic duplicated

**Backend (backend):**
- ✅ Phase 1: Infrastructure (repositories, logging, queues)
- ✅ Phase 2: Extraction Domain (strategies, services, entities)
- ⚠️ Phase 2 not integrated with routes yet
- ⚠️ Old extraction routes still in use
- ⚠️ No strategy selection API for frontend

**Integration Issues:**
1. Frontend sends `extractionMethod: 'hybrid'` but backend doesn't use it
2. Response format inconsistencies
3. No unified strategy selection
4. Performance not optimized
5. Data flow could be cleaner

---

## 📋 Unified Refactoring Strategy

### Phase 1: Backend Strategy Integration (Week 1)
**Goal**: Expose new extraction architecture to frontend

**Tasks:**
1. ✅ Create strategy selection API endpoint
2. ✅ Integrate ExtractionService with routes
3. ✅ Add strategy metadata endpoint
4. ✅ Optimize response formats
5. ✅ Add progress reporting

**Deliverables:**
- `GET /api/extraction/strategies` - List available strategies
- `POST /api/extraction/upload` - Use new ExtractionService
- `POST /api/extraction/select-strategy` - Strategy selection
- Unified response format

---

### Phase 2: Frontend Strategy Integration (Week 2)
**Goal**: Frontend leverages backend strategy system

**Tasks:**
1. Create `ExtractionStrategyService` (frontend)
2. Replace scattered extraction services
3. Add strategy selection UI
4. Optimize data flow
5. Add real-time progress updates

**Deliverables:**
- Unified extraction service
- Strategy selection component
- Optimized upload flow
- Better error handling

---

### Phase 3: Performance Optimization (Week 3)
**Goal**: Optimize end-to-end performance

**Tasks:**
1. Implement request batching
2. Add response caching
3. Optimize data serialization
4. Add streaming responses
5. Implement progressive loading

**Deliverables:**
- Faster extraction times
- Reduced API calls
- Better user experience

---

### Phase 4: Frontend Architecture Cleanup (Week 4)
**Goal**: Clean frontend architecture matching backend

**Tasks:**
1. Domain-driven frontend structure
2. Service layer refactoring
3. Component organization
4. State management optimization
5. Type safety improvements

**Deliverables:**
- Clean frontend architecture
- Better maintainability
- Type-safe API calls

---

## 🏗️ Target Architecture

### Backend Architecture (Already Built)
```
domains/extraction/
├── entities/
│   ├── ExtractionJob.js
│   └── Contact.js
├── value-objects/
│   ├── Document.js
│   ├── ExtractionResult.js
│   └── ExtractionMetadata.js
├── strategies/
│   ├── base/ExtractionStrategy.js
│   ├── pattern/PatternExtractionStrategy.js
│   └── ai/AIExtractionStrategy.js
├── services/
│   ├── ExtractionService.js ✅
│   ├── ExtractionStrategyFactory.js ✅
│   └── ExtractionServiceAdapter.js ✅
└── repositories/
    └── ExtractionJobRepository.js ✅
```

### Frontend Architecture (To Build)
```
src/
├── domains/
│   └── extraction/
│       ├── services/
│       │   ├── ExtractionStrategyService.ts (NEW)
│       │   ├── ExtractionService.ts (NEW)
│       │   └── StrategySelector.ts (NEW)
│       ├── types/
│       │   ├── Strategy.ts (NEW)
│       │   └── ExtractionRequest.ts (NEW)
│       └── hooks/
│           └── useExtraction.ts (NEW)
├── components/
│   └── extraction/
│       ├── StrategySelector.tsx (NEW)
│       └── ExtractionProgress.tsx (NEW)
└── pages/
    └── Upload/
        └── index.tsx (REFACTOR)
```

---

## 🔄 Data Flow (Target)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Upload Page                                        │
│                                                              │
│ 1. User selects file                                         │
│ 2. StrategySelector shows available strategies              │
│ 3. User selects strategy (or auto-select)                    │
│ 4. ExtractionService calls backend                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: Extraction Routes                                   │
│                                                              │
│ 1. POST /api/extraction/upload                               │
│ 2. ExtractionService.extractContactsFromFile()                │
│ 3. ExtractionStrategyFactory.selectStrategy()                │
│ 4. Strategy.extract()                                        │
│ 5. Return ExtractionResult                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: Unified Format                                     │
│                                                              │
│ {                                                            │
│   success: true,                                             │
│   jobId: "uuid",                                             │
│   contacts: Contact[],                                       │
│   metadata: {                                                │
│     strategy: "PatternExtractionStrategy",                   │
│     processingTime: 1234,                                    │
│     confidence: 0.95,                                       │
│     estimatedCost: 0.00                                      │
│   }                                                          │
│ }                                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Display Results                                    │
│                                                              │
│ 1. Extract contacts from response                            │
│ 2. Display in ContactsTable                                  │
│ 3. Show metadata (strategy, time, cost)                     │
│ 4. Cache for future use                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Implementation Details

### 1. Backend Strategy API

**New Endpoint: `GET /api/extraction/strategies`**
```javascript
// Returns available strategies with metadata
{
  strategies: [
    {
      id: "pattern",
      name: "PatternExtractionStrategy",
      description: "Fast pattern-based extraction",
      confidence: 0.95,
      available: true,
      estimatedCost: 0.00,
      estimatedTime: 500
    },
    {
      id: "ai",
      name: "AIExtractionStrategy",
      description: "AI-powered extraction",
      confidence: 0.96,
      available: true,
      estimatedCost: 0.10,
      estimatedTime: 5000
    }
  ]
}
```

**Updated Endpoint: `POST /api/extraction/upload`**
```javascript
// Accepts strategy preference
{
  file: File,
  preferredStrategy: "pattern" | "ai" | "auto",
  options: {
    rolePreferences: string[],
    maxContacts: number,
    ...
  }
}

// Returns unified format
{
  success: true,
  jobId: "uuid",
  contacts: Contact[],
  metadata: ExtractionMetadata
}
```

---

### 2. Frontend Strategy Service

**New Service: `ExtractionStrategyService.ts`**
```typescript
class ExtractionStrategyService {
  // Fetch available strategies from backend
  async getAvailableStrategies(): Promise<Strategy[]>
  
  // Select best strategy based on document
  async selectStrategy(document: File): Promise<Strategy>
  
  // Execute extraction with selected strategy
  async extract(file: File, strategy: Strategy): Promise<ExtractionResult>
}
```

**New Hook: `useExtraction.ts`**
```typescript
function useExtraction() {
  const { strategies, selectStrategy, extract } = useExtractionStrategy()
  
  return {
    strategies,
    extract: async (file: File) => {
      const strategy = await selectStrategy(file)
      return await extract(file, strategy)
    }
  }
}
```

---

### 3. Frontend Upload Refactoring

**Updated: `Upload/index.tsx`**
```typescript
// Before: Multiple services, scattered logic
// After: Single unified service

const { extract } = useExtraction()

const handleFileProcessed = async (file: File) => {
  const result = await extract(file)
  // Handle result
}
```

---

## 🎯 Success Metrics

1. **Performance**
   - Extraction time: < 2s (pattern), < 10s (AI)
   - API response time: < 500ms
   - Frontend render time: < 100ms

2. **Code Quality**
   - Backend: Clean architecture ✅
   - Frontend: Domain-driven structure
   - Type safety: 100% TypeScript
   - Test coverage: > 80%

3. **User Experience**
   - Strategy selection visible
   - Real-time progress updates
   - Clear error messages
   - Fast response times

---

## 🚀 Next Steps

1. **Immediate (This Week)**
   - [ ] Create strategy API endpoint
   - [ ] Integrate ExtractionService with routes
   - [ ] Test end-to-end flow

2. **Short Term (Next Week)**
   - [ ] Build frontend strategy service
   - [ ] Refactor upload page
   - [ ] Add strategy selector UI

3. **Medium Term (Next Month)**
   - [ ] Performance optimization
   - [ ] Frontend architecture cleanup
   - [ ] Comprehensive testing

---

*Ready to build enterprise-grade software! 🚀*

