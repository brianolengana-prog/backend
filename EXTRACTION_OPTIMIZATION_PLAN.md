# Extraction Logic Optimization Plan
## Organizing & Optimizing Existing OpenAI Implementation

## 🎯 Goals

1. **Organize** - Consolidate multiple AI services into one unified service
2. **Optimize** - Reduce token usage, improve accuracy
3. **Efficient** - Handle rate limits properly, minimize API calls
4. **Accurate** - Better prompts, structured outputs, validation

---

## 🔴 Current State Analysis

### Multiple Services (Fragmented)
- `optimizedAIUsage.service.js` - Smart AI usage
- `optimizedAIExtraction.service.js` - Optimized extraction
- `aiExtraction.service.js` - Basic AI extraction
- `optimizedHybridExtraction.service.js` - Hybrid approach
- `enterprise/EnterpriseContactExtractor.js` - Enterprise extraction

**Problem:** Inconsistent logic, duplicate code, hard to maintain

### Current Issues

1. **No Rate Limit Management**
   - Multiple services making requests independently
   - Risk of hitting 3 RPM limit
   - No centralized queue

2. **Inefficient Prompts**
   - Different prompts across services
   - Not optimized for token usage
   - Missing structured outputs

3. **Chunking Logic**
   - Arbitrary chunking breaks context
   - Doesn't preserve section relationships
   - Multiple API calls when one would work

4. **No Token Budgeting**
   - No tracking of token usage
   - Risk of hitting 60k TPM limit
   - No cost optimization

---

## ✅ Proposed Solution: Unified Extraction Service

### Architecture

```
UnifiedExtractionService
├── Text Preprocessing
│   └── Normalize, clean, extract sections
│
├── Strategy Selection
│   ├── Single-pass (< 100k tokens)
│   ├── Chunked (> 100k tokens)
│   └── Pattern fast path (tabular only)
│
├── Rate Limit Queue
│   ├── RPM management (3 requests/minute)
│   ├── TPM management (60k tokens/minute)
│   └── Request queuing
│
├── AI Extraction
│   ├── Optimized prompts
│   ├── Structured outputs (JSON mode)
│   └── Error handling
│
└── Post-Processing
    ├── Validation
    ├── Deduplication
    └── Normalization
```

---

## 🔧 GPT-4o Mini Limitations & Design

### Hard Limits

| Limit | Value | Design Impact |
|-------|-------|---------------|
| **Context Window** | 128k tokens | Single-pass for < 100k tokens |
| **Output Tokens** | 16k tokens | Enough for 100+ contacts |
| **RPM** | 3 requests/min | Queue system, 20s between requests |
| **TPM** | 60k tokens/min | Token budgeting, request prioritization |
| **Cost Input** | $0.00015/1k | Optimize prompts (minimize tokens) |
| **Cost Output** | $0.0006/1k | Use structured outputs (reliable parsing) |

### Optimal Design Decisions

1. **Single-Pass for Most Documents**
   - Most call sheets < 100k tokens
   - Better accuracy (full context)
   - Faster (one API call)
   - Cheaper (less overhead)

2. **Structured Outputs (JSON Mode)**
   - Guaranteed valid JSON
   - No parsing errors
   - More reliable

3. **Rate Limit Queue**
   - Centralized queue
   - Prevents rate limit errors
   - Better error handling

4. **Optimized Prompts**
   - Minimal system prompt (~150 tokens)
   - Clear instructions (~200 tokens)
   - Examples for accuracy
   - Total overhead: ~400 tokens

---

## 📊 Token Optimization

### Current Prompt (Inefficient)
```
System: ~500 tokens (too verbose)
User: Document + ~500 tokens instructions
Total: Document + ~1000 tokens overhead
```

### Optimized Prompt
```
System: ~150 tokens (minimal, clear)
User: Document + ~200 tokens instructions
Total: Document + ~350 tokens overhead
```

**Savings:** ~650 tokens per request (40% reduction)

### Example: Sunday Times Call Sheet

**Document:** ~5,000 chars ≈ ~1,250 tokens

**Current:**
- Input: 1,250 + 1,000 = 2,250 tokens
- Cost: $0.00034

**Optimized:**
- Input: 1,250 + 350 = 1,600 tokens
- Cost: $0.00024

**Savings:** 29% cost reduction

---

## 🚀 Implementation Steps

### Phase 1: Create Unified Service (Week 1)

1. **Create `unifiedExtraction.service.js`**
   - Single extraction method
   - Rate limit queue
   - Optimized prompts
   - Structured outputs

2. **Test with Various Formats**
   - Sunday Times format
   - Standard call sheets
   - Complex documents

### Phase 2: Integrate (Week 2)

1. **Update ExtractionMigrationService**
   - Use unified service instead of multiple services
   - Maintain backward compatibility

2. **Update Routes**
   - Use unified service in process-text endpoint
   - Handle errors gracefully

### Phase 3: Optimize (Week 3)

1. **Prompt Engineering**
   - Test different prompt variations
   - Measure accuracy
   - Optimize token usage

2. **Rate Limit Testing**
   - Test under load
   - Verify queue works
   - Monitor token usage

### Phase 4: Cleanup (Week 4)

1. **Remove Old Services**
   - Deprecate old AI services
   - Keep only unified service
   - Update documentation

---

## 📈 Expected Improvements

### Accuracy
- **Current:** ~70% (misses format variations)
- **Target:** ~95% (AI handles all formats)

### Cost
- **Current:** ~$0.001 per extraction
- **Target:** ~$0.0007 per extraction (30% reduction)

### Speed
- **Current:** Multiple API calls, chunking overhead
- **Target:** Single API call for most documents

### Reliability
- **Current:** Rate limit errors possible
- **Target:** Queue prevents errors

---

## 🎯 Key Optimizations

### 1. **Prompt Optimization**
- Minimal system prompt
- Clear, specific instructions
- Examples (few-shot learning)
- Structured output format

### 2. **Rate Limit Management**
- Centralized queue
- 20s delay between requests
- Token budgeting
- Request prioritization

### 3. **Smart Chunking**
- Only chunk if > 100k tokens
- Chunk by sections (not arbitrary)
- Preserve context

### 4. **Post-Processing**
- Validate all contacts
- Deduplicate intelligently
- Normalize formats
- Remove invalid entries

---

## 📝 Next Steps

1. **Review unified service** - Check implementation
2. **Test with real call sheets** - Validate accuracy
3. **Measure improvements** - Compare metrics
4. **Gradual rollout** - A/B test first
5. **Monitor & optimize** - Continuous improvement

