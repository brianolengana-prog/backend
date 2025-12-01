# Sunday Times Call Sheet Pattern Fix

## Problem

The extraction system was only finding 4 contacts from a Sunday Times Style call sheet, and none of them were complete (missing email, phone, company). The issue was that the call sheet uses a unique format:

```
ROLE (all caps, no colon, on its own line)
Name / Email (or Name / Phone / Email on next line)
```

Example:
```
INTERIORS DIRECTOR
PHOEBE MCDOWELL / PHOEBE.MCDOWELL@SUNDAYTIMES.CO.UK

BOOKINGS DIRECTOR
KARLA SHIELD / KARLA.SHIELD@SUNDAYTIMES.CO.UK
```

## Root Cause

The existing patterns expected:
- `ROLE: Name / Email / Phone` (with colon on same line)
- Or `ROLE:\nName / Email / Phone` (with colon and newline)

But the Sunday Times format has:
- `ROLE` (all caps, no colon) on one line
- `Name / Email` or `Name / Phone / Email` on the next line
- Sometimes blank lines between role and contact info

## Solution

### 1. Added New Patterns (High Priority)

Added 6 new patterns to the `semiStructured` array to handle this format:

1. **`role_no_colon_name_email_slash`** (confidence: 0.95)
   - Matches: `ROLE\nName / Email`
   - Handles optional blank lines

2. **`role_no_colon_name_phone_email_slash`** (confidence: 0.97)
   - Matches: `ROLE\nName / Phone / Email`

3. **`role_no_colon_name_phone_slash`** (confidence: 0.93)
   - Matches: `ROLE\nName / Phone`

4. **`role_no_colon_name_email_phone_slash`** (confidence: 0.96)
   - Matches: `ROLE\nName / Email / Phone` (different order)

5. **`agent_name_phone_email_slash`** (confidence: 0.94)
   - Matches: `C/O Agent Name / Phone / Email`

6. **`agent_name_email_slash`** (confidence: 0.92)
   - Matches: `C/O Agent Name / Email`

### 2. Added Post-Processing Step

Added `postProcessContacts()` method that:
- Scans the text line by line
- Identifies role lines (all caps, no colon, contains role keywords)
- Associates roles from previous lines with contacts that don't have roles
- Handles cases where patterns might miss the role association

### 3. Pattern Improvements

- Made patterns handle optional blank lines between role and contact info
- Improved regex to be more flexible with whitespace
- Added support for phone numbers with `+` prefix

## Expected Results

After this fix, the system should extract:

1. **INTERIORS DIRECTOR** - PHOEBE MCDOWELL / PHOEBE.MCDOWELL@SUNDAYTIMES.CO.UK
2. **BOOKINGS DIRECTOR** - KARLA SHIELD / KARLA.SHIELD@SUNDAYTIMES.CO.UK
3. **PICTURE EDITOR** - LORI LEFTEROVA / LORINA.LEFTEROVA@SUNDAYTIMES.CO.UK
4. **TALENT** - HELENA CHRISTENSEN / +1 917 325 1981
5. **PUBLICISTS** - VIRGINIA NORRIS / VIRGINIA.NORRIS@AISLE8.COM
6. **PUBLICISTS** - ASHLEIGH HESP / ASHLEIGH.HESP@AISLE8.COM
7. **PHOTOGRAPHER** - WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM
8. **C/O** - BECKY LEWIS / 212.206.0737 / BLEWIS@ARTANDCOMMERCE.COM
9. **C/O** - EMILY WALKER / 212 206 0737 / EWALKER@ARTANDCOMMERCE.COM
10. **PHOTO ASSISTANT** - JASON ROGERS / 925 348 4864 / JAYSUNROGERS@GMAIL.COM
11. **HAIR** - BEN SKERVIN / +1 (646) 284 2004
12. **C/O** - DAVID WASHINSKY / 917 443 9595 / DAVID@WSCHUPFER.COM
13. **MAKEUP** - MARIA ORTEGA / 1 (646) 229 8693 / MARIAORTEGAMAKEUP@GMAIL.COM
14. **C/O** - MERIMON HART / MERIMON@SOUTHJAMES.COM
15. **INTERVIEW** - HANNAH MARRIOTT / +1 (646) 344 0361 / HANNAHLOUISEMARRIOTT@GMAIL.COM

All contacts should now have:
- ✅ Role (from the role line or post-processing)
- ✅ Name
- ✅ Email (when present)
- ✅ Phone (when present)

## Testing

To test this fix:

1. Upload the Sunday Times call sheet
2. Check that all contacts are extracted (should be ~15 contacts)
3. Verify that each contact has:
   - A role (not "Contact" or "Unknown")
   - Name
   - Email or Phone (or both)

## Debug Mode

Enable debug logging by setting:
```bash
EXTRACTION_DEBUG=true
```

This will show:
- Which patterns are being tested
- How many matches each pattern finds
- Role association during post-processing

