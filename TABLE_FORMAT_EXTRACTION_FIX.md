# Table Format Call Sheet Extraction Fix

## Problem

The extraction system was finding 0 contacts from a tabular call sheet format where:
- Section headers are on separate lines (POSITION, TALENT, CLIENT/AGENCY)
- Column headers are on separate lines (NAME, EMAIL, CELL, CALL, WRAP, LOCATION)
- Each contact's data is spread across multiple lines (one field per line)

Example format:
```
POSITION
NAME
EMAIL
CELL
CALL
WRAP
LOCATION

Producer
Colin Olsen
colin@southjames.com
630-715-7732
11:00AM
3:00PM
1026 6th Ave
```

## Root Cause

The existing patterns expected:
- Single-line formats: `ROLE: Name / Email / Phone`
- Multi-line with role prefix: `ROLE\nName / Email / Phone`
- But NOT tabular formats where each column is on a separate line

## Solution

### 1. Added Table Row Extraction Method

Created `extractTableRows()` method that:
- Detects table sections (POSITION, TALENT, CLIENT/AGENCY)
- Identifies column headers (NAME, EMAIL, CELL, etc.)
- Parses data rows where each field is on a separate line
- Groups lines together to form complete contacts

### 2. Integration into Extraction Flow

Added table row extraction as Step 2 in the extraction pipeline:
1. Extract by sections
2. **Extract table rows** ← NEW
3. Extract with structured patterns
4. Extract with semi-structured patterns
5. Extract with unstructured patterns
6. Merge and deduplicate
7. Post-process roles
8. Normalize

### 3. Table Row Patterns

Added `tableRows` pattern array with:
- `table_row_position_name_email_cell` - Full row with role, name, email, phone
- `table_row_name_email_cell` - Row without role
- `table_row_position_name_email` - Row without phone
- `table_row_position_name_cell` - Row without email

## Expected Results

After this fix, the system should extract:

1. **Producer** - Colin Olsen / colin@southjames.com / 630-715-7732
2. **DP** - Joe Gherardi / groundedfilmsny@gmail.com / 908-752-0623
3. **H/MU** - Maria Ortega / mariaortegamakeup@gmail.com / 646-229-8693
4. **TALENT** - Jeffery Fueller / jf1236@gmail.com

All contacts should have:
- ✅ Role (from POSITION column or section header)
- ✅ Name
- ✅ Email (when present)
- ✅ Phone (from CELL column, when present)

## How It Works

1. **Section Detection**: Scans for section headers (POSITION, TALENT, etc.)
2. **Header Detection**: Looks for column headers in the following lines (NAME, EMAIL, CELL, etc.)
3. **Row Parsing**: Groups subsequent lines into rows based on column count
4. **Field Mapping**: Maps each line to the appropriate contact field based on column position
5. **Contact Creation**: Creates contact objects when a complete row is parsed

## Testing

To test this fix:

1. Upload the tabular call sheet
2. Check that contacts are extracted from the POSITION section
3. Verify that each contact has:
   - A role (from POSITION column)
   - Name
   - Email (from EMAIL column)
   - Phone (from CELL column)

## Debug Mode

Enable debug logging:
```bash
EXTRACTION_DEBUG=true
```

This will show:
- Table section detection
- Column header identification
- Row parsing progress
- Contact creation

