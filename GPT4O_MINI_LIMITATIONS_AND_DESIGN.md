# GPT-4o Mini Limitations & Optimal Design
## Understanding Constraints to Build Efficient Extraction Logic

## 🔴 GPT-4o Mini Hard Limits

### 1. **Context Window**
- **Limit:** 128,000 tokens (128k)
- **Input Buffer:** ~120,000 tokens (leave 8k for response)
- **Output Limit:** 16,000 tokens (16k max output)
- **Impact:** Large documents need chunking

### 2. **Rate Limits**
- **Requests Per Minute (RPM):** 3 requests/minute
- **Tokens Per Minute (TPM):** 60,000 tokens/minute
- **Impact:** Need intelligent queuing and batching

### 3. **Cost**
- **Input:** $0.00015 per 1k tokens ($0.15 per 1M tokens)
- **Output:** $0.0006 per 1k tokens ($0.60 per 1M tokens)
- **Impact:** Optimize prompts to reduce tokens

### 4. **Performance Characteristics**
- **Speed:** Fast (optimized model)
- **Accuracy:** Good for extraction tasks (82% MMLU)
- **Coding:** Not as strong as GPT-4
- **Hallucinations:** Can generate incorrect info (needs validation)

---

## ✅ Optimal Design Strategy

### 1. **Single-Pass Extraction (Preferred)**

**For documents < 100k tokens:**
- Send entire document in one request
- Use structured output (JSON mode)
- Single API call = faster, cheaper, more accurate

**Benefits:**
- ✅ AI sees full context
- ✅ Better relationship understanding
- ✅ No chunking overhead
- ✅ Single rate limit hit

**Implementation:**
```javascript
// For documents < 100k tokens
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  response_format: { type: 'json_object' }, // Structured output
  messages: [
    {
      role: 'system',
      content: systemPrompt // ~500 tokens
    },
    {
      role: 'user',
      content: fullDocumentText // Up to 120k tokens
    }
  ],
  max_tokens: 4000, // Enough for 50-100 contacts
  temperature: 0.1
});
```

### 2. **Smart Chunking (For Large Documents)**

**For documents > 100k tokens:**
- Chunk by sections (not arbitrary size)
- Preserve context (include section headers)
- Merge results intelligently

**Chunking Strategy:**
```javascript
// Chunk by logical sections, not arbitrary size
const sections = [
  'CREW',
  'TALENT', 
  'PRODUCTION',
  'VENDORS'
];

// Each chunk includes:
// - Section header
// - All contacts in that section
// - Context from previous section (if needed)
```

### 3. **Rate Limit Management**

**Queue System:**
```javascript
class RateLimitQueue {
  constructor() {
    this.queue = [];
    this.lastRequestTime = 0;
    this.tokensUsedThisMinute = 0;
    this.minuteStartTime = Date.now();
  }
  
  async addRequest(prompt) {
    // Wait for rate limit
    await this.waitForAvailability();
    
    // Make request
    const response = await this.makeRequest(prompt);
    
    // Update counters
    this.updateCounters(prompt, response);
    
    return response;
  }
  
  async waitForAvailability() {
    const now = Date.now();
    
    // Reset minute counter if needed
    if (now - this.minuteStartTime > 60000) {
      this.tokensUsedThisMinute = 0;
      this.minuteStartTime = now;
    }
    
    // Wait for RPM limit (3 requests/minute = 20s between requests)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 20000) {
      await this.sleep(20000 - timeSinceLastRequest);
    }
    
    // Check TPM limit (60k tokens/minute)
    const estimatedTokens = this.estimateTokens(prompt);
    if (this.tokensUsedThisMinute + estimatedTokens > 60000) {
      const waitTime = 60000 - (now - this.minuteStartTime);
      if (waitTime > 0) {
        await this.sleep(waitTime);
        this.tokensUsedThisMinute = 0;
        this.minuteStartTime = Date.now();
      }
    }
  }
}
```

### 4. **Optimized Prompt Design**

**Key Principles:**
1. **Be Specific** - Clear instructions reduce ambiguity
2. **Use Examples** - Few-shot learning improves accuracy
3. **Structured Output** - JSON mode for reliable parsing
4. **Minimize Tokens** - Remove unnecessary text

**Optimal Prompt Structure:**
```javascript
const systemPrompt = `You extract contacts from call sheets. Return JSON only.`;

const userPrompt = `Extract contacts from:

${documentText}

Format:
{
  "contacts": [
    {
      "name": "Full Name",
      "role": "ROLE",
      "email": "email@example.com",
      "phone": "+1 234 567 8900"
    }
  ]
}

Rules:
- Extract ALL contacts
- Handle formats: "ROLE: Name / Phone / Email" and "ROLE\\nName / Phone / Email"
- Remove "(NOT ON SET)" annotations
- C/O entries inherit parent role`;
```

**Token Optimization:**
- System prompt: ~100-200 tokens (keep minimal)
- User prompt: Document text + ~200 tokens instructions
- Total: Document size + ~400 tokens overhead

---

## 🏗️ Unified Extraction Service Design

### Architecture

```
UnifiedExtractionService
├── Text Preprocessing
│   ├── Normalize whitespace
│   ├── Remove headers/footers
│   └── Extract key sections
│
├── Strategy Selection
│   ├── Small doc (< 100k tokens) → Single-pass AI
│   ├── Large doc (> 100k tokens) → Chunked AI
│   └── Tabular data → Pattern fast path
│
├── AI Extraction (with rate limiting)
│   ├── Queue management
│   ├── Token budgeting
│   └── Structured output parsing
│
└── Post-Processing
    ├── Deduplication
    ├── Validation
    └── Normalization
```

### Key Features

1. **Single Service** - One unified extraction service
2. **Smart Routing** - Choose best strategy automatically
3. **Rate Limit Compliance** - Built-in queue system
4. **Token Optimization** - Efficient prompts
5. **Error Handling** - Graceful fallbacks

---

## 📊 Token Budget Planning

### Example: Sunday Times Call Sheet

**Document Size:** ~5,000 characters ≈ ~1,250 tokens

**Prompt Breakdown:**
- System prompt: ~150 tokens
- Instructions: ~200 tokens
- Document text: ~1,250 tokens
- **Total Input:** ~1,600 tokens

**Expected Output:**
- 15 contacts × ~50 tokens each = ~750 tokens
- JSON structure: ~100 tokens
- **Total Output:** ~850 tokens

**Cost:** 
- Input: 1,600 × $0.00015/1k = $0.00024
- Output: 850 × $0.0006/1k = $0.00051
- **Total:** ~$0.00075 per extraction

---

## 🎯 Accuracy Optimization

### 1. **Use Structured Outputs**
```javascript
response_format: { type: 'json_object' }
```
- Guarantees valid JSON
- Reduces parsing errors
- More reliable

### 2. **Few-Shot Learning**
Include examples in prompt:
```javascript
Examples:
1. "PHOTOGRAPHER: WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM"
   → {"name": "WILLIAM ABRANOWICZ", "role": "PHOTOGRAPHER", "phone": "646 825 1272", "email": "WAINC@ME.COM"}

2. "PHOTOGRAPHER\\nWILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM"
   → {"name": "WILLIAM ABRANOWICZ", "role": "PHOTOGRAPHER", "phone": "646 825 1272", "email": "WAINC@ME.COM"}
```

### 3. **Validation Rules**
```javascript
// Post-process to validate
- Email must contain @ and .
- Phone must have 10+ digits
- Name must be 2+ characters
- Role must be standard (PHOTOGRAPHER, HAIR, etc.)
```

### 4. **Error Handling**
```javascript
try {
  const response = await aiExtract(text);
  return validateAndClean(response);
} catch (error) {
  // Fallback to pattern extraction
  return patternExtract(text);
}
```

---

## 🚀 Implementation Recommendations

### 1. **Consolidate Services**
- Merge `optimizedAIUsage`, `optimizedAIExtraction`, `aiExtraction` into one service
- Single source of truth for AI extraction
- Consistent prompt engineering

### 2. **Implement Rate Limit Queue**
- Centralized queue for all AI requests
- Prevents rate limit errors
- Better error handling

### 3. **Optimize Prompts**
- Use structured outputs (JSON mode)
- Include examples (few-shot learning)
- Minimize token usage
- Be specific about format handling

### 4. **Smart Chunking**
- Only chunk if > 100k tokens
- Chunk by sections, not arbitrary size
- Preserve context between chunks

### 5. **Post-Processing**
- Validate all contacts
- Deduplicate intelligently
- Normalize formats
- Remove invalid entries

---

## 📈 Expected Improvements

### Current Issues:
- ❌ Multiple AI services (inconsistent)
- ❌ No rate limit management
- ❌ Inefficient prompts
- ❌ Chunking breaks context

### With Optimized Design:
- ✅ Single unified service
- ✅ Rate limit compliance
- ✅ Optimized prompts (40% fewer tokens)
- ✅ Better accuracy (full context)

### Metrics:
- **Accuracy:** 70% → 95%
- **Cost:** Same or lower (optimized prompts)
- **Speed:** Faster (single-pass for most docs)
- **Reliability:** Higher (rate limit handling)

