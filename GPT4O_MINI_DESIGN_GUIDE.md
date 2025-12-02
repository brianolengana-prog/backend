# GPT-4o Mini Design Guide
## Understanding Limitations to Build Efficient Extraction Logic

## 🔴 Hard Limits (Must Design Around)

### 1. Context Window: 128,000 tokens
- **What it means:** Maximum input + output tokens per request
- **Design impact:** 
  - Most call sheets: ~1,000-5,000 tokens ✅ (fits easily)
  - Large documents: Need chunking (rare)
  - **Strategy:** Single-pass for most documents

### 2. Rate Limits
- **RPM:** 3 requests/minute (20 seconds between requests)
- **TPM:** 60,000 tokens/minute
- **Design impact:**
  - Need queue system
  - Track token usage
  - **Strategy:** Centralized rate limit queue

### 3. Output Limit: 16,000 tokens
- **What it means:** Maximum response size
- **Design impact:**
  - Enough for 100+ contacts ✅
  - **Strategy:** No special handling needed

### 4. Cost
- **Input:** $0.00015 per 1k tokens ($0.15 per 1M)
- **Output:** $0.0006 per 1k tokens ($0.60 per 1M)
- **Design impact:**
  - Optimize prompts (minimize tokens)
  - **Strategy:** Minimal prompts (~350 token overhead)

---

## ✅ Optimal Design Decisions

### Decision 1: Single-Pass for Most Documents

**Why:**
- Most call sheets < 100k tokens
- Better accuracy (full context)
- Faster (one API call)
- Cheaper (less overhead)

**When to chunk:**
- Only if document > 100k tokens (rare)
- Chunk by sections, not arbitrary size

### Decision 2: Use Structured Outputs

**Why:**
- Guaranteed valid JSON
- No parsing errors
- More reliable

**How:**
```javascript
response_format: { type: 'json_object' }
```

### Decision 3: Rate Limit Queue

**Why:**
- Prevents RPM errors (3 requests/minute)
- Prevents TPM errors (60k tokens/minute)
- Better error handling

**How:**
- 20s delay between requests
- Track token usage per minute
- Queue requests if needed

### Decision 4: Optimized Prompts

**Why:**
- Reduce token usage (lower cost)
- Faster processing
- Better accuracy

**How:**
- Minimal system prompt (~150 tokens)
- Clear instructions (~200 tokens)
- Examples for accuracy
- Total overhead: ~350 tokens

---

## 📊 Token Budget Example

### Sunday Times Call Sheet

**Document:** ~5,000 characters ≈ ~1,250 tokens

**Optimized Prompt:**
- System: ~150 tokens
- Instructions: ~200 tokens
- Document: ~1,250 tokens
- **Total Input:** ~1,600 tokens

**Expected Output:**
- 15 contacts × ~50 tokens = ~750 tokens
- JSON structure: ~100 tokens
- **Total Output:** ~850 tokens

**Cost:**
- Input: 1,600 × $0.00015/1k = **$0.00024**
- Output: 850 × $0.0006/1k = **$0.00051**
- **Total:** **~$0.00075** per extraction

**Rate Limit Impact:**
- 1 request = 20s wait for next request
- Token usage: 2,450 tokens (well under 60k/minute)

---

## 🎯 Prompt Optimization

### Current (Inefficient)
```
System: ~500 tokens (too verbose)
User: Document + ~500 tokens instructions
Total: Document + ~1000 tokens overhead
```

### Optimized
```
System: ~150 tokens (minimal, clear)
User: Document + ~200 tokens instructions
Total: Document + ~350 tokens overhead
```

**Savings:** ~650 tokens per request (40% reduction)

### Key Principles

1. **Be Specific** - Clear instructions reduce ambiguity
2. **Use Examples** - Few-shot learning improves accuracy
3. **Structured Output** - JSON mode for reliable parsing
4. **Minimize Tokens** - Remove unnecessary text

---

## 🏗️ Architecture Design

### Unified Extraction Service

```
UnifiedExtractionService
├── Text Preprocessing
│   └── Normalize, clean, extract sections
│
├── Strategy Selection
│   ├── Single-pass (< 100k tokens) ← Most call sheets
│   └── Chunked (> 100k tokens) ← Rare
│
├── Rate Limit Queue
│   ├── RPM management (20s delay)
│   └── TPM management (track usage)
│
├── AI Extraction
│   ├── Optimized prompts (~350 tokens overhead)
│   ├── Structured outputs (JSON mode)
│   └── Error handling
│
└── Post-Processing
    ├── Validation
    ├── Deduplication
    └── Normalization
```

---

## 🚀 Implementation Checklist

- [x] Understand GPT-4o-mini limitations
- [x] Create unified extraction service
- [x] Implement rate limit queue
- [x] Optimize prompts
- [x] Use structured outputs
- [ ] Test with real call sheets
- [ ] Integrate into ExtractionMigrationService
- [ ] Monitor rate limits
- [ ] Track token usage
- [ ] Measure improvements

---

## 📈 Expected Results

### Accuracy
- **Current:** ~70%
- **Target:** ~95%

### Cost
- **Current:** ~$0.001 per extraction
- **Target:** ~$0.0007 per extraction (30% reduction)

### Speed
- **Current:** Multiple API calls
- **Target:** Single API call for most documents

### Reliability
- **Current:** Rate limit errors possible
- **Target:** Queue prevents errors

---

## 💡 Key Insights

1. **Most call sheets fit in single request** - No chunking needed
2. **Rate limits are the real constraint** - Need queue system
3. **Prompt optimization matters** - 40% token reduction possible
4. **Structured outputs are essential** - Reliable JSON parsing
5. **Single service is better** - Easier to maintain and optimize

---

## 🎯 Next Steps

1. **Test unified service** with Sunday Times call sheet
2. **Compare accuracy** with current approach
3. **Measure cost** improvements
4. **Integrate** into existing codebase
5. **Monitor** and optimize continuously

