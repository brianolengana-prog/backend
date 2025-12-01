# Complete Workflow Refactoring Plan
## Clean, Scoped, Accurate Data Flow

**Goal**: Ensure extraction → preview → contacts flow is clean, scoped, and accurate  
**Status**: 🚧 Planning

---

## 🎯 Core Principles

1. **Scoped Workflow**: Each call sheet extraction is a complete, isolated workflow
2. **Clean Data**: No dirty data, strict validation, consistent format
3. **Context Awareness**: Metrics, filtering, categorization all scoped to current job
4. **Simple UX**: User sees only what's relevant to current extraction

---

## 🔴 Current Issues

### Issue 1: Contacts Page Shows All Contacts
**Problem**: When user clicks "View All" from extraction, they see ALL contacts from all time  
**Impact**: Distracting, confusing, breaks workflow focus

### Issue 2: Metrics Not Scoped
**Problem**: Stats show all contacts, not just current extraction  
**Impact**: Misleading metrics, unclear context

### Issue 3: Filtering Logic Inconsistent
**Problem**: Filters don't enforce jobId scope when in context mode  
**Impact**: User can accidentally see other contacts

### Issue 4: Data Quality Issues
**Problem**: Dirty data (incomplete contacts, duplicates) shown  
**Impact**: Poor user experience, unreliable data

### Issue 5: Export Strategy Scattered
**Problem**: Export logic in multiple places, inconsistent  
**Impact**: Hard to maintain, inconsistent behavior

---

## ✅ Solution: Complete Workflow Refactoring

### Phase 1: Backend - Strict Job Scoping

#### 1.1 Contacts Service - Job-Scoped Queries
**File**: `src/domains/contacts/services/ContactService.js` (NEW)

**Features**:
- Strict jobId filtering when provided
- Job-scoped metrics
- Clean data validation
- Consistent response format

**Implementation**:
```javascript
class ContactService {
  async getContactsPaginated(userId, options = {}) {
    const { jobId, ...otherOptions } = options;
    
    // STRICT: If jobId provided, ONLY return contacts from that job
    const where = {
      userId,
      ...(jobId && jobId !== 'all' && { jobId }), // Enforce strict scoping
      // ... other filters
    };
    
    // Job-scoped metrics
    const stats = await this.getJobScopedStats(userId, jobId);
    
    return { contacts, pagination, stats };
  }
  
  async getJobScopedStats(userId, jobId) {
    // Metrics ONLY for this job
    if (jobId && jobId !== 'all') {
      return await this.getStatsForJob(userId, jobId);
    }
    return await this.getStatsForUser(userId);
  }
}
```

#### 1.2 Data Validation & Cleaning
**File**: `src/domains/contacts/services/ContactValidationService.js` (NEW)

**Features**:
- Strict validation rules
- Data cleaning (normalize, deduplicate)
- Quality scoring
- Filter invalid contacts

**Implementation**:
```javascript
class ContactValidationService {
  validateContact(contact) {
    // Must have: name AND (email OR phone)
    if (!contact.name || contact.name.trim().length === 0) {
      return { valid: false, reason: 'Missing name' };
    }
    
    if (!contact.email && !contact.phone) {
      return { valid: false, reason: 'Missing contact info' };
    }
    
    // Email validation
    if (contact.email && !this.isValidEmail(contact.email)) {
      return { valid: false, reason: 'Invalid email' };
    }
    
    return { valid: true };
  }
  
  cleanContacts(contacts) {
    // Remove invalid
    // Normalize data
    // Deduplicate
    // Sort by quality
    return cleanedContacts;
  }
}
```

#### 1.3 Export Service Refactoring
**File**: `src/domains/contacts/services/ContactExportService.js` (NEW)

**Features**:
- Clean, modular export
- Job-scoped exports
- Consistent format
- Data validation before export

**Implementation**:
```javascript
class ContactExportService {
  async exportContacts(userId, options = {}) {
    const { jobId, format, contactIds } = options;
    
    // STRICT: If jobId provided, ONLY export from that job
    const contacts = await this.getContactsForExport(userId, { jobId, contactIds });
    
    // Validate and clean before export
    const cleanedContacts = this.validationService.cleanContacts(contacts);
    
    // Export in requested format
    return await this.generateExport(cleanedContacts, format, options);
  }
}
```

---

### Phase 2: Frontend - Strict Context Enforcement

#### 2.1 Contacts Page - Strict Job Scoping
**File**: `src/pages/Contacts/index.tsx` (REFACTOR)

**Changes**:
- Enforce jobId scope when in context mode
- Disable "all contacts" view when in context
- Show clear context banner
- Metrics scoped to current job

**Implementation**:
```typescript
// STRICT: When jobId in URL, ONLY show that job's contacts
const contextJobId = searchParams.get('jobId');
const isContextMode = Boolean(contextJobId && isValidUUID(contextJobId));

// Enforce strict filtering
const queryOptions = {
  jobId: isContextMode ? contextJobId : jobFilter, // STRICT: Use context jobId
  // ... other options
};

// Metrics scoped to job
const stats = isContextMode 
  ? jobScopedStats  // Only stats for this job
  : allContactsStats; // All contacts stats
```

#### 2.2 Data Cleaning on Frontend
**File**: `src/utils/contactCleanup.ts` (NEW)

**Features**:
- Client-side validation
- Data normalization
- Duplicate detection
- Quality scoring

#### 2.3 Export Service Refactoring
**File**: `src/services/export/ContactExportService.ts` (REFACTOR)

**Features**:
- Clean, unified export
- Job-scoped exports
- Data validation
- Consistent behavior

---

## 📋 Implementation Steps

### Step 1: Backend Contact Service (Day 1-2)
- [ ] Create `ContactService` with strict job scoping
- [ ] Create `ContactValidationService` for data cleaning
- [ ] Update `ContactRepository` with job-scoped queries
- [ ] Add job-scoped metrics endpoint

### Step 2: Backend Export Service (Day 3)
- [ ] Refactor `ContactExportService` to new domain
- [ ] Add data validation before export
- [ ] Ensure job-scoped exports

### Step 3: Frontend Context Enforcement (Day 4-5)
- [ ] Update contacts page to enforce jobId scope
- [ ] Add context mode banner
- [ ] Scope metrics to current job
- [ ] Disable "all contacts" when in context

### Step 4: Frontend Data Cleaning (Day 6)
- [ ] Add contact validation
- [ ] Add data normalization
- [ ] Filter invalid contacts

### Step 5: Frontend Export Refactoring (Day 7)
- [ ] Refactor export service
- [ ] Ensure job-scoped exports
- [ ] Add data validation

---

## 🎯 Target Workflow

### User Journey (Clean & Scoped)

```
1. Upload Call Sheet
   ↓
2. Extraction Completes (23 contacts)
   ↓
3. Preview Shows (23 contacts, clean data)
   ↓
4. Click "View Contacts"
   ↓
5. Contacts Page (STRICT: Only 23 contacts from this job)
   - Banner: "Viewing: Summer Campaign Call Sheet (23 contacts)"
   - Metrics: Scoped to this job only
   - Filters: Scoped to this job
   - Export: Only this job's contacts
   ↓
6. User can:
   - Export these 23 contacts
   - Upload another call sheet
   - Clear context to see all contacts
```

---

## ✅ Success Criteria

1. ✅ Contacts page shows ONLY current job's contacts when jobId in URL
2. ✅ Metrics scoped to current job
3. ✅ No dirty data shown
4. ✅ Export scoped to current job
5. ✅ Clean, consistent data format
6. ✅ Simple, focused user experience

---

*Ready to implement clean, scoped workflow! 🚀*

