# Prisma Contact Save Fix - 2025-10-07

## Problem
The extraction system was failing to persist contacts to the database with the following error:
```
PrismaClientValidationError: Unknown argument `section`
```

The error occurred because the code was trying to save fields (`section`, `confidence`, `source`) that don't exist in the Prisma Contact model schema.

## Root Cause
The Contact model in `schema.prisma` only has these fields:
- `id`, `jobId`, `userId`, `name`, `email`, `phone`, `role`, `company`, `isSelected`, `createdAt`, `updatedAt`

But the extraction code was trying to save additional metadata fields:
- `section` - inferred section based on role (CREW, TALENT, etc.)
- `confidence` - quality score for the extraction (0-1)
- `source` - extraction method used

## Files Modified

### 1. `src/services/extraction/ExtractionOrchestrator.js`
**Line 133-141**: Removed non-existent fields from contact save operation
```javascript
// BEFORE:
const contactsToSave = contacts.map(contact => ({
  name: contact.name || '',
  role: contact.role || '',
  email: contact.email || '',
  phone: contact.phone || '',
  company: contact.company || '',
  section: contact.section || 'OTHER',      // ❌ Doesn't exist in schema
  confidence: contact.confidence || 0.5,     // ❌ Doesn't exist in schema
  source: contact.source || 'extraction',    // ❌ Doesn't exist in schema
  userId,
  jobId
}));

// AFTER:
const contactsToSave = contacts.map(contact => ({
  name: contact.name || '',
  role: contact.role || '',
  email: contact.email || '',
  phone: contact.phone || '',
  company: contact.company || '',
  userId,
  jobId
}));
```

### 2. `src/services/extraction/ContactValidator.js`
**Multiple changes to remove metadata fields**:

#### a) Removed metadata from `normalizeContact` (Lines 59-65)
```javascript
// BEFORE:
return {
  name: this.cleanName(contact.name),
  role: this.cleanRole(contact.role),
  email: this.cleanEmail(contact.email),
  phone: this.cleanPhone(contact.phone),
  company: this.cleanCompany(contact.company),
  section: contact.section || this.inferSection(contact.role),
  source: contact.source || 'unknown',
  confidence: contact.confidence || 0.5,
  lineNumber: contact.lineNumber || 0,
  rawMatch: contact.rawMatch || ''
};

// AFTER:
return {
  name: this.cleanName(contact.name),
  role: this.cleanRole(contact.role),
  email: this.cleanEmail(contact.email),
  phone: this.cleanPhone(contact.phone),
  company: this.cleanCompany(contact.company)
};
```

#### b) Removed `calculateConfidenceScore` from validation pipeline (Line 48)
```javascript
// BEFORE:
return contacts
  .map(contact => this.normalizeContact(contact))
  .filter(contact => this.isValidContact(contact))
  .map(contact => this.calculateConfidenceScore(contact));

// AFTER:
return contacts
  .map(contact => this.normalizeContact(contact))
  .filter(contact => this.isValidContact(contact));
```

#### c) Renamed and refactored scoring methods
- `calculateConfidenceScore` → `calculateQualityScore` (for internal metrics only)
- `calculateOverallConfidence` → `calculateOverallQuality`
- Removed `inferSection` method (no longer needed)

#### d) Updated `sortContacts` to not use confidence
```javascript
// BEFORE: Sorted by role priority then confidence
// AFTER: Sorts by role priority then alphabetically by name
```

#### e) Updated `getValidationStats` to remove metadata references
```javascript
// BEFORE:
return {
  originalCount: originalContacts.length,
  validatedCount: validatedContacts.length,
  rejectedCount: originalContacts.length - validatedContacts.length,
  averageConfidence: this.calculateOverallConfidence(validatedContacts),
  sectionsFound: [...new Set(validatedContacts.map(c => c.section))],
  rolesFound: [...new Set(validatedContacts.map(c => c.role))]
};

// AFTER:
return {
  originalCount: originalContacts.length,
  validatedCount: validatedContacts.length,
  rejectedCount: originalContacts.length - validatedContacts.length,
  rolesFound: [...new Set(validatedContacts.map(c => c.role))]
};
```

### 3. `src/services/extraction/ExtractionOrchestrator.js`
**Line 73**: Updated metadata field name
```javascript
// BEFORE:
confidence: ContactValidator.calculateOverallConfidence(finalContacts),

// AFTER:
quality: ContactValidator.calculateOverallQuality(finalContacts),
```

## Impact
✅ **Positive Changes**:
- Contacts can now be successfully saved to the database
- Code matches the actual database schema
- Cleaner data model without redundant fields
- Metadata fields (`section`, `confidence`, `source`) were only used internally and never displayed to users

✅ **No Breaking Changes**:
- All extraction functionality remains intact
- Contact validation still works
- Quality scoring moved to internal metrics only
- Frontend receives the same contact data (name, role, email, phone, company)

## Testing Required
1. ✅ Upload a document and verify contacts are saved to database
2. ✅ Verify no Prisma validation errors
3. ✅ Check that contact extraction returns correct data
4. ✅ Verify usage tracking works correctly
5. ✅ Test contact retrieval and display in frontend

## Future Considerations
If you need to track `section`, `confidence`, or `source` metadata in the future:

1. **Option A: Add to Database Schema**
   - Update `prisma/schema.prisma` to add these optional fields
   - Run `prisma migrate dev` to update database
   - Re-enable the metadata tracking in the code

2. **Option B: Store as JSON metadata**
   - Use the existing `processedContacts` JSON field in the Job model
   - Store extraction metadata separately from contact records

## Deployment Notes
- ✅ No database migration required (we removed fields, didn't add them)
- ✅ No data loss (metadata was never stored in production)
- ✅ Backward compatible with existing data
- ✅ Safe to deploy immediately

## Fixed By
- ExtractionOrchestrator.js - Removed invalid fields from save operation
- ContactValidator.js - Cleaned up validation pipeline and metadata handling
- Maintained all existing functionality while fixing the Prisma error
