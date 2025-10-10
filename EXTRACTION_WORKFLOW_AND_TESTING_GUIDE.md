# Complete Extraction System: Workflow & Testing Guide

> **Purpose**: Comprehensive guide to understand, test, and validate the extraction system  
> **Date**: October 10, 2025  
> **Status**: Complete Documentation

---

## 📊 Complete Extraction Workflow

### 1. High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER UPLOADS FILE                                              │
│  ├── PDF, DOCX, XLSX, CSV, TXT, Images                         │
│  └── Via /api/extraction/upload endpoint                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: FILE VALIDATION & PREPROCESSING                        │
│  ├── Check file type (MIME validation)                          │
│  ├── Check file size (max limits per plan)                      │
│  ├── Validate user permissions & usage limits                   │
│  ├── Generate extraction ID                                     │
│  └── Save to temp storage                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: TEXT EXTRACTION (Format-Specific)                      │
│                                                                  │
│  PDF Files:                                                      │
│  ├── pdf-parse library → Extract text + metadata                │
│  ├── Fallback: pdf2json → Extract as JSON                       │
│  ├── OCR Fallback: AWS Textract (for scanned PDFs)             │
│                                                                  │
│  DOCX Files:                                                     │
│  └── mammoth library → Extract text from Word                   │
│                                                                  │
│  XLSX/Excel Files:                                              │
│  └── xlsx library → Extract tabular data                        │
│                                                                  │
│  Images (JPG, PNG):                                             │
│  └── AWS Textract OCR → Extract text from image                │
│                                                                  │
│  CSV/TXT:                                                       │
│  └── Direct text extraction (UTF-8 decode)                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: DOCUMENT ANALYSIS & CLASSIFICATION                     │
│                                                                  │
│  Document Classifier:                                           │
│  ├── Identify document type:                                    │
│  │   • Call Sheet                                              │
│  │   • Contact List                                            │
│  │   • Crew List                                               │
│  │   • Talent Sheet                                            │
│  │   • Production Schedule                                     │
│  │   • Invoice/Receipt                                         │
│  │   • Resume/CV                                               │
│  │                                                              │
│  ├── Analyze layout structure:                                  │
│  │   • Structured Table                                        │
│  │   • Form-based                                              │
│  │   • Free Text                                               │
│  │   • Multi-column                                            │
│  │   • Mixed Content                                           │
│  │                                                              │
│  └── Calculate confidence scores:                               │
│      • Document type confidence (0-1)                           │
│      • Layout confidence (0-1)                                  │
│      • Content structure confidence (0-1)                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: STRATEGY SELECTION                                     │
│                                                                  │
│  Based on analysis, select extraction strategy:                 │
│                                                                  │
│  📋 Pattern-Based (Fast, 85-92% accuracy):                      │
│  ├── Structured patterns (tables, forms)                        │
│  ├── Semi-structured patterns (sections)                        │
│  ├── Unstructured patterns (free text)                         │
│  └── Best for: Standard call sheets                            │
│                                                                  │
│  🤖 AI-Based (Slow, 92-96% accuracy):                          │
│  ├── GPT-4o Mini with specialized prompts                      │
│  ├── Context-aware processing                                   │
│  ├── Rate limited (3 req/min)                                  │
│  └── Best for: Complex/unusual formats                         │
│                                                                  │
│  🔬 AWS Textract (Medium, 95-98% accuracy):                    │
│  ├── Enterprise OCR for scanned PDFs                           │
│  ├── Table detection & form analysis                           │
│  ├── Requires AWS credentials                                   │
│  └── Best for: Scanned documents, images                       │
│                                                                  │
│  🔄 Hybrid (Balanced, 90-95% accuracy):                        │
│  ├── Pattern first, AI enhancement                             │
│  ├── Validates pattern results with AI                         │
│  ├── Falls back to AI if pattern fails                         │
│  └── Best for: Most production documents                       │
│                                                                  │
│  🧠 Adaptive (Intelligent, 88-96% accuracy):                   │
│  ├── Analyzes document complexity                              │
│  ├── Selects best strategy automatically                       │
│  ├── Adjusts based on confidence scores                        │
│  └── Best for: Unknown document types                          │
│                                                                  │
│  🏢 Enterprise (Most Advanced, 92-98% accuracy):               │
│  ├── Component-based extraction                                │
│  ├── Multi-stage validation                                    │
│  ├── Machine learning classification                           │
│  └── Best for: Mission-critical extractions                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: CONTACT EXTRACTION                                     │
│                                                                  │
│  Pattern-Based Extraction:                                      │
│  ├── Apply regex patterns for:                                 │
│  │   • Name patterns (First Last, LAST First, etc.)           │
│  │   • Email patterns (RFC 5322 compliant)                     │
│  │   • Phone patterns (international formats)                  │
│  │   • Role patterns (dept-specific roles)                     │
│  │                                                              │
│  ├── Section-based extraction:                                 │
│  │   • CREW section → Extract crew contacts                   │
│  │   • TALENT section → Extract talent contacts               │
│  │   • PRODUCTION section → Extract production staff          │
│  │                                                              │
│  └── Table-aware extraction:                                   │
│      • Detect table structures                                 │
│      • Map columns to contact fields                           │
│      • Extract row-by-row                                      │
│                                                                  │
│  AI-Based Extraction:                                          │
│  ├── Send text to GPT-4o with specialized prompt              │
│  ├── Request structured JSON response                          │
│  ├── Parse and validate AI response                           │
│  └── Handle rate limits & errors                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: VALIDATION & CLEANING                                  │
│                                                                  │
│  For each extracted contact:                                    │
│                                                                  │
│  ✅ Name Validation:                                           │
│  ├── Min 2 characters                                          │
│  ├── Must contain letters                                      │
│  ├── Remove special characters                                 │
│  └── Normalize case (Title Case)                              │
│                                                                  │
│  ✅ Email Validation:                                          │
│  ├── RFC 5322 format validation                               │
│  ├── Domain validation (MX record check)                       │
│  ├── Disposable email detection                               │
│  └── Normalize to lowercase                                    │
│                                                                  │
│  ✅ Phone Validation:                                          │
│  ├── International format detection                            │
│  ├── Normalize to E.164 format                                │
│  ├── Remove invalid numbers                                    │
│  └── Validate number length                                    │
│                                                                  │
│  ✅ Role Validation & Normalization:                           │
│  ├── Map to standard role taxonomy:                            │
│  │   • Director, Producer, DP, Gaffer, etc.                   │
│  ├── Handle synonyms (DOP → DP)                                │
│  ├── Categorize by department                                  │
│  └── Assign role hierarchy                                     │
│                                                                  │
│  ✅ Deduplication:                                             │
│  ├── Compare by exact name match                               │
│  ├── Compare by email/phone match                              │
│  ├── Fuzzy matching for similar names                          │
│  └── Merge duplicate records                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: CONFIDENCE SCORING                                     │
│                                                                  │
│  Calculate confidence score (0-1) based on:                     │
│                                                                  │
│  • Has valid name: +0.3                                        │
│  • Has valid email: +0.3                                       │
│  • Has valid phone: +0.2                                       │
│  • Has valid role: +0.1                                        │
│  • Has company: +0.05                                          │
│  • Has department: +0.05                                       │
│                                                                  │
│  Adjust score based on:                                        │
│  • Extraction method (AI: +0.1, Pattern: +0.05)               │
│  • Document quality (structured: +0.1)                         │
│  • Validation passes (all pass: +0.1)                         │
│                                                                  │
│  Filter contacts:                                              │
│  • Keep: confidence >= 0.5                                     │
│  • Review: 0.3 <= confidence < 0.5                            │
│  • Discard: confidence < 0.3                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 8: DATABASE PERSISTENCE                                   │
│                                                                  │
│  Transaction-safe storage:                                      │
│                                                                  │
│  1. Create Job record:                                         │
│     ├── User ID, file name, status                            │
│     ├── Extraction method, processing time                     │
│     └── Metadata (confidence, strategy, etc.)                 │
│                                                                  │
│  2. Create Contact records (batch insert):                     │
│     ├── Link to Job ID                                         │
│     ├── Store all validated fields                            │
│     └── Store confidence scores                               │
│                                                                  │
│  3. Create Production record (if detected):                    │
│     ├── Production name from document                          │
│     ├── Shooting dates, location                              │
│     └── Link to Job                                            │
│                                                                  │
│  4. Update Usage metrics:                                      │
│     ├── Increment upload count                                 │
│     ├── Increment contact extraction count                     │
│     └── Check plan limits                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 9: RESPONSE & CLEANUP                                     │
│                                                                  │
│  Return to client:                                             │
│  {                                                             │
│    "success": true,                                            │
│    "jobId": "uuid",                                            │
│    "contacts": [...],                                          │
│    "metadata": {                                               │
│      "total": 42,                                              │
│      "confidence": 0.87,                                       │
│      "processingTime": 3421,                                   │
│      "extractionMethod": "hybrid",                             │
│      "documentType": "call_sheet"                              │
│    }                                                           │
│  }                                                             │
│                                                                  │
│  Cleanup:                                                       │
│  ├── Delete temporary file (after 1 hour)                      │
│  ├── Clear memory buffers                                      │
│  └── Log extraction metrics                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing Strategy

### 1. Test Document Categories

To properly test the extraction system, you need **variety across multiple dimensions**:

#### A. Document Types
- ✅ Standard Call Sheet (production)
- ✅ Talent Call Sheet (model/agency focused)
- ✅ Crew List (department-based)
- ✅ Contact Directory (simple list)
- ✅ Production Schedule (time-based)
- ✅ Invoice/Receipt (with contact info)
- ✅ Email Thread (forwarded messages)

#### B. Format Variations
- ✅ PDF (native text)
- ✅ PDF (scanned/image-based)
- ✅ DOCX (Word document)
- ✅ XLSX (Excel spreadsheet)
- ✅ CSV (comma-separated)
- ✅ TXT (plain text)
- ✅ Images (JPG/PNG of documents)

#### C. Structure Complexity
- ✅ **Simple** - Clean table with headers
- ✅ **Medium** - Mixed sections (crew + talent + production)
- ✅ **Complex** - Multi-page, multiple tables, nested sections
- ✅ **Messy** - Poor formatting, missing data, typos
- ✅ **Minimal** - Just names and phones, no roles
- ✅ **Dense** - 100+ contacts in one document

#### D. Data Quality Variations
- ✅ Perfect data (all fields complete)
- ✅ Partial data (some fields missing)
- ✅ Dirty data (typos, inconsistent formatting)
- ✅ International data (various phone/name formats)
- ✅ Edge cases (single contact, no contacts, corrupted)

### 2. Test Scenarios

#### Scenario 1: Standard Call Sheet (Baseline)
```
Document: Standard_Call_Sheet_Production.pdf
Expected: 25-30 contacts
Roles: Director, DP, Gaffer, Producer, Talent
Fields: Name, Role, Email, Phone, Company
Strategy: Pattern-based should work (85-90% accuracy)
Pass Criteria: >= 23 contacts extracted with >= 80% accuracy
```

#### Scenario 2: Scanned Call Sheet (OCR Test)
```
Document: Scanned_Call_Sheet.pdf
Expected: 20-25 contacts
Format: Image-based PDF (no selectable text)
Strategy: AWS Textract + AI (95%+ accuracy)
Pass Criteria: >= 19 contacts extracted with >= 90% accuracy
```

#### Scenario 3: Talent Sheet (Specialized)
```
Document: Model_Talent_Sheet.xlsx
Expected: 15-20 talent
Roles: Model, Agent, Manager
Fields: Name, Agency, Email, Phone, Social Media
Strategy: Hybrid (tabular detection + AI)
Pass Criteria: >= 14 contacts with agency info preserved
```

#### Scenario 4: Crew List (Department-Based)
```
Document: Crew_List_Departments.docx
Expected: 40-50 crew
Structure: Grouped by department (Camera, Lighting, Sound, etc.)
Strategy: Section-based pattern extraction
Pass Criteria: >= 38 contacts with correct departments
```

#### Scenario 5: Messy Contact List (Stress Test)
```
Document: Messy_Contact_List.txt
Expected: 30-35 contacts
Issues: Inconsistent formatting, typos, missing fields
Strategy: Adaptive (will choose AI if pattern fails)
Pass Criteria: >= 25 contacts extracted and cleaned
```

#### Scenario 6: Multi-Page Production Schedule
```
Document: Production_Schedule_3_Days.pdf
Expected: 60-80 contacts (duplicates across days)
Structure: Daily schedules with recurring contacts
Strategy: Pattern + Deduplication
Pass Criteria: >= 55 unique contacts, duplicates removed
```

#### Scenario 7: International Contacts
```
Document: International_Call_Sheet.pdf
Expected: 20-25 contacts
Data: UK, EU, Asian phone formats; accented names
Strategy: Pattern with international phone regex
Pass Criteria: >= 18 contacts with normalized phone numbers
```

#### Scenario 8: Minimal Data (Edge Case)
```
Document: Simple_Name_Phone_List.csv
Expected: 50-60 contacts
Fields: Only name and phone (no email, no role)
Strategy: Simple pattern extraction
Pass Criteria: >= 48 contacts, assign "Contact" as default role
```

#### Scenario 9: No Contacts (Negative Test)
```
Document: Production_Budget.xlsx
Expected: 0 contacts
Content: Financial data, no contact information
Strategy: Any (should detect no contacts)
Pass Criteria: Return success: true, contacts: []
```

#### Scenario 10: Corrupted File (Error Handling)
```
Document: Corrupted_File.pdf
Expected: Error response
Content: Malformed PDF structure
Strategy: Any (should fail gracefully)
Pass Criteria: Return success: false with meaningful error
```

### 3. Automated Testing Framework

Create a comprehensive test suite:

```javascript
// tests/extraction/comprehensive.test.js

const testCases = [
  {
    id: 'TC001',
    name: 'Standard Call Sheet',
    file: 'test-data/standard-call-sheet.pdf',
    expectedContacts: { min: 23, max: 30 },
    expectedRoles: ['Director', 'DP', 'Gaffer', 'Producer'],
    expectedFields: ['name', 'role', 'email', 'phone'],
    minAccuracy: 0.80,
    minConfidence: 0.70,
    maxProcessingTime: 5000, // 5 seconds
    strategy: 'pattern'
  },
  {
    id: 'TC002',
    name: 'Scanned Call Sheet (OCR)',
    file: 'test-data/scanned-call-sheet.pdf',
    expectedContacts: { min: 19, max: 25 },
    requiresOCR: true,
    minAccuracy: 0.90,
    minConfidence: 0.85,
    maxProcessingTime: 15000, // 15 seconds
    strategy: 'textract'
  },
  // ... more test cases
]

describe('Extraction System - Comprehensive Tests', () => {
  testCases.forEach(testCase => {
    it(`${testCase.id}: ${testCase.name}`, async () => {
      const result = await runExtractionTest(testCase)
      
      // Validate contact count
      expect(result.contacts.length).toBeGreaterThanOrEqual(testCase.expectedContacts.min)
      expect(result.contacts.length).toBeLessThanOrEqual(testCase.expectedContacts.max)
      
      // Validate accuracy
      const accuracy = calculateAccuracy(result.contacts, testCase.groundTruth)
      expect(accuracy).toBeGreaterThanOrEqual(testCase.minAccuracy)
      
      // Validate confidence
      const avgConfidence = result.contacts.reduce((sum, c) => sum + c.confidence, 0) / result.contacts.length
      expect(avgConfidence).toBeGreaterThanOrEqual(testCase.minConfidence)
      
      // Validate processing time
      expect(result.processingTime).toBeLessThanOrEqual(testCase.maxProcessingTime)
      
      // Validate required roles
      if (testCase.expectedRoles) {
        const extractedRoles = new Set(result.contacts.map(c => c.role))
        testCase.expectedRoles.forEach(role => {
          expect(extractedRoles.has(role)).toBe(true)
        })
      }
      
      // Validate required fields
      if (testCase.expectedFields) {
        result.contacts.forEach(contact => {
          testCase.expectedFields.forEach(field => {
            expect(contact[field]).toBeDefined()
            expect(contact[field]).not.toBe('')
          })
        })
      }
    })
  })
})
```

### 4. Validation Metrics

For each test, measure:

#### Quantitative Metrics:
- **Contact Count**: # of contacts extracted
- **Accuracy**: % of correctly extracted contacts
- **Precision**: % of extracted contacts that are valid
- **Recall**: % of actual contacts that were found
- **F1 Score**: Harmonic mean of precision and recall
- **Processing Time**: Time taken for extraction
- **Confidence Score**: Average confidence of extracted contacts

#### Qualitative Metrics:
- **Data Completeness**: % of contacts with all fields
- **Role Accuracy**: % of correctly identified roles
- **Email Validity**: % of valid email addresses
- **Phone Validity**: % of valid phone numbers
- **Deduplication Rate**: % of duplicates removed

### 5. Ground Truth Creation

For accurate testing, create ground truth datasets:

```javascript
// test-data/ground-truth/standard-call-sheet.json
{
  "fileName": "standard-call-sheet.pdf",
  "documentType": "call_sheet",
  "expectedContacts": [
    {
      "name": "John Smith",
      "role": "Director",
      "email": "john.smith@production.com",
      "phone": "+1-555-123-4567",
      "company": "Big Productions LLC"
    },
    {
      "name": "Jane Doe",
      "role": "DP",
      "email": "jane.doe@cinematography.com",
      "phone": "+1-555-987-6543",
      "company": "DP Services"
    },
    // ... all expected contacts
  ],
  "metadata": {
    "totalContacts": 28,
    "uniqueRoles": 12,
    "hasProduction": true,
    "productionName": "Summer Vibes Commercial"
  }
}
```

### 6. Test Execution

Run tests with:

```bash
# Run all extraction tests
npm run test:extraction

# Run specific category
npm run test:extraction -- --grep "OCR"

# Run with coverage
npm run test:extraction:coverage

# Run performance benchmarks
npm run test:extraction:benchmark
```

---

## 📋 Test Document Checklist

### Minimum Required Test Set:

- [ ] **Basic Tests (6 documents)**
  - [ ] Standard call sheet (PDF, native text)
  - [ ] Scanned call sheet (PDF, image-based)
  - [ ] Crew list (DOCX or PDF)
  - [ ] Talent sheet (XLSX or CSV)
  - [ ] Simple contact list (TXT or CSV)
  - [ ] Empty/invalid document (for error handling)

- [ ] **Format Coverage (6 documents)**
  - [ ] PDF (native text)
  - [ ] PDF (scanned)
  - [ ] DOCX
  - [ ] XLSX
  - [ ] CSV
  - [ ] Image (JPG/PNG)

- [ ] **Complexity Coverage (4 documents)**
  - [ ] Simple (single table, < 20 contacts)
  - [ ] Medium (mixed sections, 20-50 contacts)
  - [ ] Complex (multi-page, 50-100 contacts)
  - [ ] Messy (poor formatting, typos)

- [ ] **Edge Cases (4 documents)**
  - [ ] International contacts (various formats)
  - [ ] Minimal data (names + phones only)
  - [ ] Duplicates (same person multiple times)
  - [ ] No contacts (should return empty array)

### Recommended Full Test Suite:

**Total: 25-30 diverse documents covering all scenarios**

---

## ✅ Success Criteria

### System is considered **Accurate** if:
- ✅ >= 85% accuracy on standard call sheets
- ✅ >= 90% accuracy on clean, structured documents
- ✅ >= 80% accuracy on complex documents
- ✅ >= 75% accuracy on messy/poor quality documents
- ✅ 95%+ accuracy on OCR (scanned documents)

### System is considered **Reliable** if:
- ✅ < 5% failure rate across all document types
- ✅ Graceful error handling (no crashes)
- ✅ Consistent results on repeated tests
- ✅ Proper deduplication (< 2% duplicates in results)
- ✅ Validates all emails and phones correctly

### System is considered **Optimal** if:
- ✅ Processing time < 5 seconds for standard documents
- ✅ Processing time < 15 seconds for OCR documents
- ✅ Processing time < 30 seconds for complex documents
- ✅ Memory usage < 500MB per extraction
- ✅ Handles 100+ contacts without degradation

---

## 🚀 Next Steps

1. **Create Test Dataset**
   - Gather 25-30 diverse call sheets
   - Create ground truth JSON files
   - Organize by category

2. **Run Baseline Tests**
   - Test current system against all documents
   - Record metrics for each test case
   - Identify failure patterns

3. **Optimize & Iterate**
   - Fix extraction patterns for failed cases
   - Tune confidence thresholds
   - Improve validation logic

4. **Continuous Testing**
   - Add new test cases as edge cases are discovered
   - Monitor production extraction metrics
   - A/B test strategy improvements

---

## 📊 Sample Test Report Template

```markdown
# Extraction Test Report
**Date**: 2025-10-10  
**Tester**: [Name]  
**Build**: v2.1.3

## Summary
- Total Tests: 25
- Passed: 22 (88%)
- Failed: 3 (12%)
- Average Accuracy: 87.3%
- Average Processing Time: 4.2s

## Failed Tests
1. TC015: International Contacts
   - Expected: 20 contacts
   - Got: 17 contacts
   - Issue: Asian phone numbers not recognized
   - Fix: Add international phone regex patterns

2. TC018: Multi-page Schedule
   - Expected: 55 unique contacts
   - Got: 78 contacts (duplicates)
   - Issue: Deduplication failed for name variations
   - Fix: Improve fuzzy matching algorithm

3. TC023: Corrupted PDF
   - Expected: Graceful error
   - Got: System timeout
   - Issue: No timeout handling
   - Fix: Add extraction timeout (30s max)

## Recommendations
- Add international phone regex patterns
- Improve fuzzy name matching (Levenshtein distance)
- Implement extraction timeouts
- Add more test cases for edge cases
```

---

**Ready to test!** You now have a complete framework to validate the extraction system comprehensively.

