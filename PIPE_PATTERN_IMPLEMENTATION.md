# Pipe-Separated Pattern Implementation

## Summary

We've added comprehensive support for pipe-separated call sheet formats (`Name | email | c. phone`) which are common in production call sheets.

## Changes Made

### 1. Added 8 New Pipe-Separated Patterns

All patterns are placed at the **top** of the `structured` patterns array (highest priority) with confidence scores of 0.85-0.98:

1. **`role_name_email_phone_pipe`** (0.98 confidence)
   - Matches: `ROLE: Name | email | c. phone`
   - Example: `PHOTOGRAPHER: Myrthe Giesbers | Info@myrthegiesbers.com | c. 929 722 0099`

2. **`role_name_email_phone_pipe_flexible`** (0.95 confidence)
   - Flexible version without line anchors

3. **`name_email_phone_pipe`** (0.93 confidence)
   - Matches: `Name | email | c. phone` (no role prefix)
   - Example: `Chloe King | king.chloe.s@gmail.com| c. 617 875 7447`

4. **`name_email_phone_pipe_flexible`** (0.9 confidence)
   - Flexible version

5. **`agent_name_email_phone_pipe`** (0.92 confidence)
   - Matches: `c/o Agent Name | email | c. phone`
   - Example: `c/o Cody Benfield | cody@silvertooth.co | c. 310 909 4912`

6. **`agent_name_email_pipe`** (0.88 confidence)
   - Matches: `c/o Agent Name | email` (no phone)
   - Example: `c/o Merimon Hart | merimon@southjames.com`

7. **`role_name_phone_pipe`** (0.9 confidence)
   - Matches: `ROLE: Name | c. phone` (no email)
   - Example: `MAKEUP: Alex Levy | c. 617 990 4893`

8. **`multiline_role_name_email_phone_pipe`** (0.92 confidence)
   - Matches: `ROLE:` on one line, `Name | email | c. phone` on next line

### 2. Enhanced Debug Logging

Added comprehensive logging to track pattern matching:
- Pattern-by-pattern match counts
- Sample matches for debugging
- Text preview in logs
- Pattern statistics

Enable debug logging:
```bash
export EXTRACTION_DEBUG=true
```

### 3. Created Test Script

Created `scripts/test-pipe-patterns.js` to verify patterns work with sample call sheet.

## How to Verify It Works

### Option 1: Test with Sample Call Sheet

1. Upload a call sheet with pipe-separated format
2. Check backend logs for:
   ```
   🔍 Testing pattern: role_name_email_phone_pipe
   📊 Pattern role_name_email_phone_pipe found X matches
   ```
3. Verify extraction summary shows structured patterns > 0:
   ```json
   {
     "patterns": {
       "structured": 8,  // ← Should be > 0
       "semiStructured": 0,
       "unstructured": 0
     }
   }
   ```

### Option 2: Run Test Script

```bash
cd /home/bkg/parrot/node/backend
node scripts/test-pipe-patterns.js
```

This will:
- Test all pipe patterns with sample call sheet
- Show which patterns matched
- Validate expected contacts were found
- Display pattern distribution

### Option 3: Check Logs After Upload

After uploading a call sheet, look for:

1. **Pattern Processing Logs:**
   ```
   🔍 Processing structured patterns
   🔍 Testing pattern: role_name_email_phone_pipe
   📊 Pattern role_name_email_phone_pipe found 8 matches
   ```

2. **Extraction Summary:**
   ```
   ✅ Robust extraction complete
   patterns: { structured: 8, ... }
   totalContacts: 20
   ```

3. **Pattern Distribution:**
   Check which patterns were used - should see `*_pipe` patterns in the list.

## Expected Behavior

### Before (Old Logs)
```json
{
  "patterns": {
    "structured": 0,  // ← No pipe patterns
    "semiStructured": 0,
    "unstructured": 8  // ← Only unstructured patterns
  }
}
```

### After (New Logs)
```json
{
  "patterns": {
    "structured": 8,  // ← Pipe patterns matching!
    "semiStructured": 0,
    "unstructured": 0
  }
}
```

## Troubleshooting

### If Patterns Still Show 0 Matches

1. **Check Text Format:**
   - Verify pipe character is `|` (not `│` or other unicode)
   - Check for extra spaces around pipes
   - Verify phone format includes `c.` prefix

2. **Enable Debug Logging:**
   ```bash
   export EXTRACTION_DEBUG=true
   ```
   Then check `textPreview` in logs to see actual text being processed.

3. **Test Pattern Manually:**
   ```javascript
   const regex = /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi;
   const testText = "PHOTOGRAPHER: Myrthe Giesbers | Info@myrthegiesbers.com | c. 929 722 0099";
   const matches = [...testText.matchAll(regex)];
   console.log(matches.length); // Should be 1
   ```

4. **Check Text Normalization:**
   - Verify text normalization doesn't remove pipe characters
   - Check for encoding issues

## Next Steps

1. **Deploy the changes** to your backend
2. **Test with actual call sheet** using pipe-separated format
3. **Monitor logs** to verify patterns are matching
4. **Adjust if needed** based on real-world results

## Files Modified

- `src/services/robustCallSheetExtractor.service.js`
  - Added 8 new pipe-separated patterns
  - Enhanced debug logging
  - Added pattern statistics

## Files Created

- `EXTRACTION_ROBUSTNESS_GUIDE.md` - Comprehensive guide for ensuring robust extraction
- `PIPE_PATTERN_IMPLEMENTATION.md` - This file
- `scripts/test-pipe-patterns.js` - Test script for verification

