# Optimized Extraction Implementation Guide
## Organizing & Optimizing Existing OpenAI Logic

## 🎯 Overview

You already have OpenAI in the backend. This guide shows how to:
1. **Organize** existing logic into one unified service
2. **Optimize** prompts and token usage
3. **Handle** GPT-4o-mini limitations properly
4. **Improve** accuracy with better prompts

---

## 📊 GPT-4o Mini Limitations (Critical for Design)

### Hard Limits

| Limit | Value | Impact on Design |
|-------|-------|------------------|
| **Context Window** | 128,000 tokens | Most call sheets fit in single request |
| **Output Tokens** | 16,000 tokens | Enough for 100+ contacts |
| **RPM** | 3 requests/minute | Need 20s delay between requests |
| **TPM** | 60,000 tokens/minute | Track token usage, queue requests |
| **Input Cost** | $0.00015/1k tokens | Optimize prompts (minimize tokens) |
| **Output Cost** | $0.0006/1k tokens | Use structured outputs (reliable) |

### Design Decisions Based on Limits

1. **Single-Pass for Most Documents**
   - Most call sheets: ~1,000-5,000 tokens
   - Fits easily in 128k context window
   - Better accuracy (full context)
   - Faster (one API call)

2. **Rate Limit Queue**
   - Centralized queue prevents RPM errors
   - 20s delay between requests
   - Token budgeting prevents TPM errors

3. **Structured Outputs**
   - Use `response_format: { type: 'json_object' }`
   - Guarantees valid JSON
   - No parsing errors

---

## 🏗️ Current Architecture Issues

### Problem: Multiple Services

**Current:**
- `optimizedAIUsage.service.js` - Smart AI usage
- `optimizedAIExtraction.service.js` - Optimized extraction  
- `aiExtraction.service.js` - Basic extraction
- `optimizedHybridExtraction.service.js` - Hybrid approach

**Issues:**
- ❌ Inconsistent prompts
- ❌ No centralized rate limiting
- ❌ Duplicate code
- ❌ Hard to maintain

### Solution: Unified Service

**New:**
- `unifiedExtraction.service.js` - Single, optimized service

**Benefits:**
- ✅ Consistent prompts
- ✅ Centralized rate limiting
- ✅ Single source of truth
- ✅ Easier to maintain

---

## 🔧 Implementation: Unified Extraction Service

### Key Features

1. **Rate Limit Queue**
   ```javascript
   // Automatically handles 3 RPM limit
   await this.waitForRateLimit();
   ```

2. **Token Optimization**
   ```javascript
   // Minimal system prompt (~150 tokens)
   // Clear instructions (~200 tokens)
   // Total overhead: ~350 tokens
   ```

3. **Structured Outputs**
   ```javascript
   response_format: { type: 'json_object' }
   // Guarantees valid JSON
   ```

4. **Smart Strategy Selection**
   ```javascript
   // Single-pass for < 100k tokens
   // Chunked for > 100k tokens
   ```

### Integration

**Update `ExtractionMigrationService.js`:**

```javascript
// OLD: Multiple services
const optimizedExtractor = new OptimizedHybridExtractionService();
const aiUsage = new OptimizedAIUsageService();

// NEW: Single unified service
const unifiedExtraction = require('./unifiedExtraction.service');

// Use unified service
const result = await unifiedExtraction.extractContacts(text, {
  extractionId,
  rolePreferences: options.rolePreferences,
  ...options
});
```

---

## 📝 Optimized Prompt Design

### Current Prompt (Inefficient)

```javascript
// System: ~500 tokens (too verbose)
// User: Document + ~500 tokens instructions
// Total: Document + ~1000 tokens overhead
```

### Optimized Prompt

```javascript
// System: ~150 tokens (minimal, clear)
const systemPrompt = `You extract contacts from call sheets. Return ONLY valid JSON.

Handle formats:
1. "ROLE: Name / Phone / Email"
2. "ROLE\\nName / Phone / Email"
3. C/O entries

Rules:
- Extract ALL contacts
- Remove "(NOT ON SET)" annotations
- Only include contacts with email OR phone

Return JSON: {"contacts": [...]}`;

// User: Document + ~200 tokens instructions
// Total: Document + ~350 tokens overhead
```

**Savings:** ~650 tokens per request (40% reduction)

---

## 🎯 Accuracy Improvements

### 1. Use Structured Outputs

```javascript
response_format: { type: 'json_object' }
```

**Benefits:**
- Guaranteed valid JSON
- No parsing errors
- More reliable

### 2. Few-Shot Learning

Include examples in prompt:
```javascript
Examples:
1. "PHOTOGRAPHER: WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM"
   → {"name": "WILLIAM ABRANOWICZ", "role": "PHOTOGRAPHER", ...}

2. "PHOTOGRAPHER\\nWILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM"
   → {"name": "WILLIAM ABRANOWICZ", "role": "PHOTOGRAPHER", ...}
```

### 3. Clear Instructions

```javascript
// Be specific about format handling
- Handle "ROLE: Name / Phone / Email"
- Handle "ROLE\\nName / Phone / Email" (role on separate line)
- Handle C/O entries (inherit parent role)
- Remove "(NOT ON SET)" annotations
```

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

---

## 🚀 Migration Steps

### Step 1: Test Unified Service

```javascript
// Test with Sunday Times call sheet
const unifiedExtraction = require('./unifiedExtraction.service');

const result = await unifiedExtraction.extractContacts(sundayTimesText, {
  extractionId: 'test_001'
});

console.log('Contacts found:', result.contacts.length);
console.log('Accuracy:', validateAgainstExpected(result.contacts));
```

### Step 2: Update ExtractionMigrationService

```javascript
// Replace multiple services with unified service
const unifiedExtraction = require('../unifiedExtraction.service');

// In extractContacts method:
const result = await unifiedExtraction.extractContacts(text, {
  extractionId,
  rolePreferences: options.rolePreferences,
  ...options
});
```

### Step 3: Monitor & Optimize

- Track accuracy improvements
- Monitor token usage
- Measure cost savings
- Adjust prompts as needed

---

## ✅ Expected Results

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

## 📋 Checklist

- [ ] Review unified service implementation
- [ ] Test with Sunday Times call sheet
- [ ] Test with other call sheet formats
- [ ] Update ExtractionMigrationService
- [ ] Monitor rate limits
- [ ] Track token usage
- [ ] Measure accuracy improvements
- [ ] Optimize prompts based on results

