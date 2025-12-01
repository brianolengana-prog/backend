# Extraction Robustness Guide

## Overview
This guide outlines best practices and strategies to ensure the contact extraction system is super solid and robust.

## Current Pattern Coverage

### ✅ Pipe-Separated Formats (NEW - Highest Priority)
- `ROLE: Name | email | c. phone` - Most common call sheet format
- `Name | email | c. phone` - Without role prefix
- `c/o Agent Name | email | c. phone` - Agent lines
- `ROLE:` (on one line) followed by `Name | email | c. phone` (on next line)

### ✅ Slash-Separated Formats
- `ROLE: Name / Email / Phone`
- `ROLE: Name / Phone`
- `ROLE: Name / Agency / Phone`

### ✅ Dash-Separated Formats
- `ROLE: Name - Phone`
- `Name - Role - Phone`

### ✅ Other Formats
- Table formats (tab-delimited, pipe-delimited)
- Multi-line formats
- Unstructured patterns (fallback)

## Debugging Extraction Issues

### 1. Enable Debug Logging

Set environment variable to see detailed pattern matching:
```bash
export EXTRACTION_DEBUG=true
```

Or in your `.env` file:
```
EXTRACTION_DEBUG=true
```

### 2. What to Look For in Logs

#### Pattern Matching Logs
```
🔍 Processing structured patterns
🔍 Testing pattern: role_name_email_phone_pipe
📊 Pattern role_name_email_phone_pipe found 5 matches
✅ Pattern role_name_email_phone_pipe extracted contact
```

#### Extraction Summary
```
✅ Robust extraction complete
patterns: {
  sections: 0,
  semiStructured: 2,
  structured: 8,  // ← Should be > 0 for pipe-separated formats
  unstructured: 0
}
```

#### If Patterns Don't Match
- Check `textPreview` in logs to see what text is being processed
- Verify regex patterns match the actual format
- Check for encoding issues (special characters, line breaks)

### 3. Common Issues and Solutions

#### Issue: Patterns show 0 matches
**Possible Causes:**
1. Text normalization issues (extra spaces, line breaks)
2. Regex flags missing (case-insensitive, multiline)
3. Special characters not escaped

**Solution:**
- Check `textPreview` in debug logs
- Test regex patterns manually with sample text
- Verify text normalization preserves pipe characters

#### Issue: Contacts extracted but invalid
**Possible Causes:**
1. Phone number format doesn't match expected pattern
2. Email validation too strict
3. Name cleaning removes valid characters

**Solution:**
- Check `isValidContact` criteria
- Review `cleanPhoneNumber` and `cleanName` methods
- Adjust validation rules if needed

#### Issue: Low confidence scores
**Possible Causes:**
1. Using unstructured patterns (low confidence)
2. Missing email or phone
3. Incomplete contact data

**Solution:**
- Prioritize structured patterns
- Ensure patterns match actual format
- Consider AI enhancement for low-confidence results

## Ensuring Robust Extraction

### 1. Pattern Priority Strategy

Patterns are processed in order of confidence:
1. **Structured patterns** (0.85-0.98 confidence) - Try first
2. **Semi-structured patterns** (0.6-0.8 confidence) - Fallback
3. **Unstructured patterns** (0.5 confidence) - Last resort

**Best Practice:** Add new formats to structured patterns with high confidence scores.

### 2. Multi-Pattern Approach

The system uses multiple extraction strategies:
- **Section-based extraction** - Extract by TALENT, CREW, PRODUCTION sections
- **Pattern-based extraction** - Match specific formats
- **AI enhancement** - Fill gaps and improve quality
- **Client-side fallback** - Use client-extracted contacts if backend fails

### 3. Validation and Cleaning

Every extracted contact goes through:
1. **Validation** - `isValidContact()` checks for minimum required fields
2. **Cleaning** - Normalize phone numbers, emails, names
3. **Deduplication** - Remove duplicate contacts
4. **Role normalization** - Standardize role names

### 4. Error Handling

The system includes:
- **Try-catch blocks** around pattern matching
- **Timeout protection** for long-running extractions
- **Graceful degradation** - Falls back to simpler patterns if complex ones fail
- **Detailed error logging** for debugging

### 5. Testing Strategy

#### Unit Testing
Test individual patterns with sample text:
```javascript
const pattern = {
  name: 'role_name_email_phone_pipe',
  regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
  groups: ['role', 'name', 'email', 'phone']
};

const testText = "PHOTOGRAPHER: Myrthe Giesbers | Info@myrthegiesbers.com | c. 929 722 0099";
const matches = [...testText.matchAll(pattern.regex)];
console.log(matches); // Should find 1 match
```

#### Integration Testing
Test full extraction pipeline:
1. Upload sample call sheet
2. Check extraction logs for pattern matches
3. Verify contact count and quality
4. Validate all contacts have required fields

#### Real-World Testing
Test with actual production call sheets:
- Various formats (PDF, DOCX, XLSX)
- Different layouts and structures
- Edge cases (missing fields, special characters)

## Monitoring Extraction Quality

### Key Metrics to Track

1. **Pattern Match Rate**
   - How many contacts found by structured vs unstructured patterns
   - Higher structured = better quality

2. **Contact Completeness**
   - Percentage with email
   - Percentage with phone
   - Percentage with both

3. **Confidence Scores**
   - Average confidence of extracted contacts
   - Distribution of confidence levels

4. **Extraction Success Rate**
   - Percentage of uploads that successfully extract contacts
   - Average contacts per document

### Log Analysis

Monitor these log patterns:
```json
{
  "message": "✅ Robust extraction complete",
  "patterns": {
    "structured": 8,  // ← Should be high
    "semiStructured": 2,
    "unstructured": 0  // ← Should be low
  },
  "totalContacts": 20
}
```

## Best Practices for Adding New Patterns

### 1. Pattern Design
- **Start with high confidence** (0.9+) for common formats
- **Use specific regex** - Avoid overly broad patterns
- **Test edge cases** - Empty fields, special characters, variations

### 2. Pattern Placement
- **Add to structured patterns** if format is common and well-defined
- **Add to semi-structured** if format is less common or has variations
- **Avoid unstructured** unless absolutely necessary

### 3. Pattern Testing
```javascript
// Test your pattern
const testCases = [
  "PHOTOGRAPHER: John Doe | john@example.com | c. 123 456 7890",
  "Name | email | c. phone",
  // Add edge cases
];

testCases.forEach(test => {
  const matches = [...test.matchAll(pattern.regex)];
  console.log(`Test: "${test}" - Matches: ${matches.length}`);
});
```

### 4. Documentation
- Document the format the pattern matches
- Include example matches
- Note any limitations or edge cases

## Troubleshooting Checklist

When extraction fails or produces poor results:

- [ ] Check if `EXTRACTION_DEBUG=true` is set
- [ ] Review pattern matching logs
- [ ] Verify text normalization (check `textPreview` in logs)
- [ ] Test regex patterns manually with sample text
- [ ] Check for encoding issues (special characters)
- [ ] Verify pattern priority (structured > semi-structured > unstructured)
- [ ] Review validation rules (`isValidContact`)
- [ ] Check phone/email cleaning functions
- [ ] Verify section extraction is working (TALENT, CREW sections)
- [ ] Review AI enhancement logs (if enabled)
- [ ] Check for timeout issues
- [ ] Verify deduplication isn't removing valid contacts

## Performance Optimization

### Pattern Ordering
- **Most common patterns first** - Reduces processing time
- **High-confidence patterns first** - Better results faster
- **Limit pattern matches** - Prevent processing too many matches

### Caching
- Cache extraction results for duplicate files (file hash)
- Cache normalized text for repeated processing

### Early Exit
- Stop processing when enough contacts found
- Skip low-confidence patterns if high-confidence ones succeed

## Continuous Improvement

### 1. Pattern Refinement
- Monitor which patterns match most often
- Refine patterns based on real-world data
- Remove unused or low-performing patterns

### 2. Quality Metrics
- Track extraction quality over time
- Identify patterns that produce low-quality contacts
- Adjust confidence scores based on results

### 3. User Feedback
- Track which extractions users manually correct
- Identify common correction patterns
- Use feedback to improve patterns

## Next Steps After Testing

1. **Test with pipe-separated call sheet** - Upload the sample call sheet you provided
2. **Check logs** - Verify pipe patterns are matching
3. **Review results** - Ensure all contacts are extracted correctly
4. **Adjust if needed** - Fine-tune patterns based on results

## Quick Reference

### Enable Debug Logging
```bash
export EXTRACTION_DEBUG=true
# Restart backend
```

### Check Pattern Matches
Look for logs like:
```
🔍 Testing pattern: role_name_email_phone_pipe
📊 Pattern role_name_email_phone_pipe found 8 matches
```

### Verify Extraction Quality
Check final logs:
```
✅ Robust extraction complete
patterns: { structured: 8, ... }
totalContacts: 20
```

### Test New Pattern
```javascript
const regex = /your-pattern-here/gmi;
const testText = "sample text";
const matches = [...testText.matchAll(regex)];
console.log(matches.length); // Should be > 0
```

