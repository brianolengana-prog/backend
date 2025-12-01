/**
 * Robust Call Sheet Extractor
 * 
 * Comprehensive pattern-based extraction specifically designed for call sheets
 * Handles the infinite variety of call sheet formats found in production
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.EXTRACTION_DEBUG === 'true' ? 'debug' : 'info', // Enable debug logs when EXTRACTION_DEBUG=true
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class RobustCallSheetExtractor {
  constructor() {
    this.patterns = this.initializeComprehensivePatterns();
    this.roleNormalizer = this.initializeRoleNormalizer();
  }

  /**
   * Initialize comprehensive patterns for all call sheet variations
   */
  initializeComprehensivePatterns() {
    return {
      // High-confidence structured patterns (most common)
      structured: [
        // ✅ NEW: Pattern 0a: ROLE: Name | email | c. phone (pipe-separated with "c." phone prefix) - HIGHEST PRIORITY
        {
          name: 'role_name_email_phone_pipe',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.98
        },
        // ✅ NEW: Pattern 0b: ROLE: Name | email | c. phone (flexible, no line start/end anchors)
        {
          name: 'role_name_email_phone_pipe_flexible',
          regex: /([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.95
        },
        // ✅ NEW: Pattern 0c: Name | email | c. phone (no role prefix, role might be on previous line)
        {
          name: 'name_email_phone_pipe',
          regex: /^([A-Za-z][A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['name', 'email', 'phone'],
          confidence: 0.93
        },
        // ✅ NEW: Pattern 0d: Name | email | c. phone (flexible)
        {
          name: 'name_email_phone_pipe_flexible',
          regex: /([A-Za-z][A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})/gmi,
          groups: ['name', 'email', 'phone'],
          confidence: 0.9
        },
        // ✅ NEW: Pattern 0e: c/o Agent Name | email | c. phone (agent lines with phone)
        {
          name: 'agent_name_email_phone_pipe',
          regex: /c\/o\s+([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})/gmi,
          groups: ['name', 'email', 'phone'],
          confidence: 0.92
        },
        // ✅ NEW: Pattern 0h: c/o Agent Name | email (agent lines without phone)
        {
          name: 'agent_name_email_pipe',
          regex: /c\/o\s+([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)/gmi,
          groups: ['name', 'email'],
          confidence: 0.88
        },
        // ✅ NEW: Pattern 0f: ROLE: Name | c. phone (no email)
        {
          name: 'role_name_phone_pipe',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.9
        },
        // ✅ NEW: Pattern 0g: ROLE: Name | c. phone (flexible)
        {
          name: 'role_name_phone_pipe_flexible',
          regex: /([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.85
        },
        // Pattern 1: ROLE: Name / Phone (most common) - CASE INSENSITIVE
        {
          name: 'role_name_phone_slash',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.95
        },
        // Pattern 1b: ROLE: Name / Phone (more flexible) - CASE INSENSITIVE
        {
          name: 'role_name_phone_slash_flexible',
          regex: /([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.9
        },
        // Pattern 2: ROLE: Name / Email / Phone - CASE INSENSITIVE
        {
          name: 'role_name_email_phone_slash',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s]+@[^\s]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.95
        },
        // Pattern 2b: ROLE: Name / Email / Phone (flexible) - CASE INSENSITIVE
        {
          name: 'role_name_email_phone_slash_flexible',
          regex: /([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s]+@[^\s]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.9
        },
        // Pattern 3: ROLE: Name / Agency / Phone (talent) - CASE INSENSITIVE
        {
          name: 'role_name_agency_phone',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([A-Za-z\s\-'\.&]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'agency', 'phone'],
          confidence: 0.9
        },
        // Pattern 4: ROLE: Name - Phone - CASE INSENSITIVE
        {
          name: 'role_name_phone_dash',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*-\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.9
        },
        // Pattern 4b: ROLE: Name - Phone (flexible)
        {
          name: 'role_name_phone_dash_flexible',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*-\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['role', 'name', 'phone'],
          confidence: 0.85
        },
        // Pattern 5: ROLE: Name (Phone)
        {
          name: 'role_name_phone_parens',
          regex: /^([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\(([^)]+)\)\s*$/gm,
          groups: ['role', 'name', 'phone'],
          confidence: 0.85
        },
        // Pattern 5b: ROLE: Name (Phone) (flexible)
        {
          name: 'role_name_phone_parens_flexible',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\(([^)]+)\)/gm,
          groups: ['role', 'name', 'phone'],
          confidence: 0.8
        },
        // Pattern 6: Multi-line ROLE: Name / Email / Phone
        {
          name: 'role_name_email_phone_multiline',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s]+@[^\s]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.9
        },
        // Pattern 7: ROLE: Name / Agency / Phone (talent with agency)
        {
          name: 'role_name_agency_phone_flexible',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([A-Za-z\s\-'\.&]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['role', 'name', 'agency', 'phone'],
          confidence: 0.85
        },
        // Pattern 8: Very flexible role: name / contact format
        {
          name: 'role_name_contact_very_flexible',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/gm,
          groups: ['role', 'name', 'contact'],
          confidence: 0.7
        },
        // Pattern 9: Super flexible - any text with colon and slash
        {
          name: 'any_colon_slash_format',
          regex: /([^:\n\r]+):\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\n\r]+)/gm,
          groups: ['role', 'name', 'contact'],
          confidence: 0.6
        }
      ],

      // Medium-confidence patterns (semi-structured)
      semiStructured: [
        // ✅ NEW: Pattern 0a: All-caps ROLE (no colon) on one line, Name / Email on next line (Sunday Times style)
        // Handles optional blank lines between role and contact info
        {
          name: 'role_no_colon_name_email_slash',
          regex: /^([A-Z][A-Z\s&\/\-]{2,})\s*\n\s*\n?\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s\/]+@[^\s\/]+)\s*$/gmi,
          groups: ['role', 'name', 'email'],
          confidence: 0.95
        },
        // ✅ NEW: Pattern 0b: All-caps ROLE (no colon) on one line, Name / Phone / Email on next line
        {
          name: 'role_no_colon_name_phone_email_slash',
          regex: /^([A-Z][A-Z\s&\/\-]{2,})\s*\n\s*\n?\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.\+]{8,}\)?)\s*\/\s*([^\s\/]+@[^\s\/]+)\s*$/gmi,
          groups: ['role', 'name', 'phone', 'email'],
          confidence: 0.97
        },
        // ✅ NEW: Pattern 0c: All-caps ROLE (no colon) on one line, Name / Phone on next line
        {
          name: 'role_no_colon_name_phone_slash',
          regex: /^([A-Z][A-Z\s&\/\-]{2,})\s*\n\s*\n?\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.\+]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.93
        },
        // ✅ NEW: Pattern 0d: All-caps ROLE (no colon) on one line, Name / Email / Phone on next line (different order)
        {
          name: 'role_no_colon_name_email_phone_slash',
          regex: /^([A-Z][A-Z\s&\/\-]{2,})\s*\n\s*\n?\s*([A-Za-z\s\-'\.]+)\s*\/\s*([^\s\/]+@[^\s\/]+)\s*\/\s*(\(?[\d\s\-\(\)\.\+]{8,}\)?)\s*$/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.96
        },
        // ✅ NEW: Pattern 0e: C/O Agent Name / Phone / Email (agent lines)
        {
          name: 'agent_name_phone_email_slash',
          regex: /^C\/O\s+([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.\+]{8,}\)?)\s*\/\s*([^\s\/]+@[^\s\/]+)\s*$/gmi,
          groups: ['name', 'phone', 'email'],
          confidence: 0.94
        },
        // ✅ NEW: Pattern 0f: C/O Agent Name / Email (agent lines without phone)
        {
          name: 'agent_name_email_slash',
          regex: /^C\/O\s+([A-Za-z\s\-'\.]+)\s*\/\s*([^\s\/]+@[^\s\/]+)\s*$/gmi,
          groups: ['name', 'email'],
          confidence: 0.92
        },
        // ✅ NEW: Pattern 5a: Multi-line ROLE: followed by Name | email | c. phone on next line
        {
          name: 'multiline_role_name_email_phone_pipe',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*\n\s*([A-Za-z\s\-'\.]+)\s*\|\s*([^\s\|]+@[^\s\|]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.92
        },
        // ✅ NEW: Pattern 5b: Multi-line ROLE: followed by Name | c. phone (no email) on next line
        {
          name: 'multiline_role_name_phone_pipe',
          regex: /^([A-Za-z][A-Za-z\s&\/\-]+):\s*\n\s*([A-Za-z\s\-'\.]+)\s*\|\s*c\.\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.9
        },
        // Pattern 6: Multi-line format (name on one line, phone on next)
        {
          name: 'multiline_name_phone',
          regex: /^([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*\n\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gm,
          groups: ['role', 'name', 'phone'],
          confidence: 0.8
        },
        // Pattern 7: Name - Role - Phone
        {
          name: 'name_role_phone_dash',
          regex: /^([A-Za-z\s\-'\.]+)\s*-\s*([A-Z][A-Z\s&\/\-]+)\s*-\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gm,
          groups: ['name', 'role', 'phone'],
          confidence: 0.8
        },
        // Pattern 8: Simple name and phone (no role)
        {
          name: 'name_phone_only',
          regex: /^([A-Za-z\s\-'\.]{2,})\s+(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gm,
          groups: ['name', 'phone'],
          confidence: 0.7
        },
        // Pattern 9: Email and name combination
        {
          name: 'name_email_combo',
          regex: /^([A-Za-z\s\-'\.]+)\s+([^\s]+@[^\s]+)\s*$/gm,
          groups: ['name', 'email'],
          confidence: 0.7
        },
        // Pattern 10: Name with role in parentheses
        {
          name: 'name_role_parens',
          regex: /^([A-Za-z\s\-'\.]+)\s*\(([^)]+)\)\s*(\(?[\d\s\-\(\)\.]{8,}\)?)?\s*$/gm,
          groups: ['name', 'role', 'phone'],
          confidence: 0.7
        },
        // Pattern 11: Name followed by role and contact
        {
          name: 'name_role_contact',
          regex: /^([A-Za-z\s\-'\.]+)\s+([A-Z][A-Z\s&\/\-]+)\s*[:\-\/]\s*([^\s]+@[^\s]+|[\d\s\-\(\)\.]{8,})/gm,
          groups: ['name', 'role', 'contact'],
          confidence: 0.6
        }
      ],

      // Low-confidence patterns (unstructured)
      unstructured: [
        // Pattern 10: Any text with phone number
        {
          name: 'phone_in_text',
          regex: /([A-Za-z\s\-'\.]{2,})\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['name', 'phone'],
          confidence: 0.5
        },
        // Pattern 11: Any text with email
        {
          name: 'email_in_text',
          regex: /([A-Za-z\s\-'\.]{2,})\s+([^\s]+@[^\s]+)/gm,
          groups: ['name', 'email'],
          confidence: 0.5
        }
      ],

      // Specialized patterns for specific sections
      sections: [
        // Pattern 12: TALENT section
        {
          name: 'talent_section',
          regex: /TALENT:\s*\n([\s\S]*?)(?=\n[A-Z]+\s*:|$)/gm,
          section: 'talent'
        },
        // Pattern 13: CREW section
        {
          name: 'crew_section',
          regex: /CREW:\s*\n([\s\S]*?)(?=\n[A-Z]+\s*:|$)/gm,
          section: 'crew'
        },
        // Pattern 14: PRODUCTION section
        {
          name: 'production_section',
          regex: /PRODUCTION:\s*\n([\s\S]*?)(?=\n[A-Z]+\s*:|$)/gm,
          section: 'production'
        },
        // ✅ NEW: Pattern 15: POSITION section (table format)
        {
          name: 'position_section_table',
          regex: /POSITION\s*\n\s*NAME\s*\n\s*EMAIL\s*\n\s*CELL\s*\n\s*CALL\s*\n\s*WRAP\s*\n\s*LOCATION\s*\n([\s\S]*?)(?=\n\s*[A-Z]+\s*\n|$)/gmi,
          section: 'position'
        },
        // ✅ NEW: Pattern 16: TALENT section (table format)
        {
          name: 'talent_section_table',
          regex: /TALENT\s*\n\s*NAME\s*\n\s*EMAIL\s*\n\s*CELL\s*\n\s*CALL\s*\n\s*WRAP\s*\n\s*LOCATION\s*\n([\s\S]*?)(?=\n\s*[A-Z]+\s*\n|$)/gmi,
          section: 'talent'
        }
      ],
      
      // ✅ NEW: Table row patterns (for structured table formats)
      tableRows: [
        // Pattern 1: Table row with POSITION, NAME, EMAIL, CELL (phone) columns
        // Format: Role\nName\nEmail\nPhone\n...
        {
          name: 'table_row_position_name_email_cell',
          regex: /^([A-Za-z\/\s]+)\s*\n\s*([A-Za-z\s\-'\.]+)\s*\n\s*([^\s\n]+@[^\s\n]+)\s*\n\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'email', 'phone'],
          confidence: 0.95
        },
        // Pattern 2: Table row with NAME, EMAIL, CELL (no position/role)
        {
          name: 'table_row_name_email_cell',
          regex: /^([A-Za-z\s\-'\.]+)\s*\n\s*([^\s\n]+@[^\s\n]+)\s*\n\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['name', 'email', 'phone'],
          confidence: 0.9
        },
        // Pattern 3: Table row with POSITION, NAME, EMAIL (no phone)
        {
          name: 'table_row_position_name_email',
          regex: /^([A-Za-z\/\s]+)\s*\n\s*([A-Za-z\s\-'\.]+)\s*\n\s*([^\s\n]+@[^\s\n]+)\s*$/gmi,
          groups: ['role', 'name', 'email'],
          confidence: 0.85
        },
        // Pattern 4: Table row with POSITION, NAME, CELL (no email)
        {
          name: 'table_row_position_name_cell',
          regex: /^([A-Za-z\/\s]+)\s*\n\s*([A-Za-z\s\-'\.]+)\s*\n\s*([\d\s\-\(\)\.]{8,})\s*$/gmi,
          groups: ['role', 'name', 'phone'],
          confidence: 0.85
        }
      ]
    };
  }

  /**
   * Initialize role normalizer for consistent role mapping
   */
  initializeRoleNormalizer() {
    return {
      'MUA': ['makeup artist', 'hair & makeup', 'makeup', 'muah', 'beauty'],
      'PHOTOGRAPHER': ['photographer', 'photog', 'dp', 'director of photography', 'camera'],
      'STYLIST': ['stylist', 'wardrobe', 'fashion stylist', 'costume'],
      'PRODUCER': ['producer', 'line producer', 'executive producer', 'associate producer'],
      'DIRECTOR': ['director', 'creative director', 'art director'],
      'MODEL': ['model', 'talent', 'subject'],
      'ASSISTANT': ['assistant', 'assistant photographer', 'photo assistant', 'stylist assistant'],
      'AGENT': ['agent', 'representation', 'talent agent', 'model agent'],
      'LOCATION': ['location', 'location manager', 'location scout'],
      'TRANSPORTATION': ['transportation', 'driver', 'transport coordinator']
    };
  }

  /**
   * Main extraction method
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `robust_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('🎯 Starting robust call sheet extraction', {
        extractionId,
        textLength: text.length
      });

      // Step 1: Extract by sections first (if identifiable)
      const sectionResults = this.extractBySections(text, extractionId);
      
      // Step 2: Extract table rows (for tabular formats)
      const tableResults = this.extractTableRows(text, extractionId);
      
      // Step 3: Extract with structured patterns
      const structuredResults = this.extractWithPatterns(text, this.patterns.structured, 'structured', extractionId);
      
      // Step 4: Extract with semi-structured patterns
      const semiStructuredResults = this.extractWithPatterns(text, this.patterns.semiStructured, 'semi-structured', extractionId);
      
      // Step 5: Extract with unstructured patterns (fallback)
      const unstructuredResults = this.extractWithPatterns(text, this.patterns.unstructured, 'unstructured', extractionId);
      
      // Step 6: Merge and deduplicate results
      const allContacts = [
        ...sectionResults.contacts,
        ...tableResults.contacts,
        ...structuredResults.contacts,
        ...semiStructuredResults.contacts,
        ...unstructuredResults.contacts
      ];

      const uniqueContacts = this.deduplicateContacts(allContacts);
      
      // Step 6: Post-process to associate roles from previous lines
      const contactsWithRoles = this.postProcessContacts(uniqueContacts, text);
      
      // Step 7: Normalize roles and clean data
      const normalizedContacts = this.normalizeContacts(contactsWithRoles);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Robust extraction complete', {
        extractionId,
        totalContacts: normalizedContacts.length,
        processingTime,
        patterns: {
          structured: structuredResults.count,
          semiStructured: semiStructuredResults.count,
          unstructured: unstructuredResults.count,
          sections: sectionResults.count,
          tableRows: tableResults.count
        }
      });

      return {
        success: true,
        contacts: normalizedContacts,
        metadata: {
          extractionId,
          strategy: 'robust-pattern-based',
          processingTime,
          textLength: text.length,
          patternsUsed: {
            structured: structuredResults.count,
            semiStructured: semiStructuredResults.count,
            unstructured: unstructuredResults.count,
            sections: sectionResults.count,
            tableRows: tableResults.count
          }
        },
        processingTime,
        extractorsUsed: ['robust-patterns']
      };

    } catch (error) {
      logger.error('❌ Robust extraction failed', {
        extractionId,
        error: error.message
      });

      return {
        success: false,
        contacts: [],
        metadata: {
          extractionId,
          error: error.message,
          processingTime: Date.now() - startTime
        },
        processingTime: Date.now() - startTime,
        errors: [error.message]
      };
    }
  }

  /**
   * Extract table rows from tabular call sheet formats
   * Handles formats where each column is on a separate line
   * Format: POSITION\nNAME\nEMAIL\nCELL\n... (each field on its own line)
   */
  extractTableRows(text, extractionId) {
    const contacts = [];
    const lines = text.split('\n');
    
    // Look for table sections with headers
    let inTableSection = false;
    let tableHeaders = [];
    let currentRow = {};
    let rowIndex = 0;
    let sectionRole = null;
    let dataStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineUpper = line.toUpperCase();
      
      // Detect table section start - POSITION can be both section and column header
      if (lineUpper === 'POSITION' || lineUpper === 'TALENT' || lineUpper.includes('CLIENT')) {
        inTableSection = true;
        tableHeaders = [];
        currentRow = {};
        rowIndex = 0;
        sectionRole = lineUpper.replace(/\/.*/, '').trim();
        dataStartIndex = -1;
        
        // Look ahead for column headers (POSITION might be first column header)
        const expectedHeaders = ['POSITION', 'NAME', 'EMAIL', 'CELL', 'CALL', 'WRAP', 'LOCATION'];
        let headerCount = 0;
        let foundPositionHeader = false;
        
        // Start from current line (POSITION might be first column header)
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const headerLine = lines[j].trim().toUpperCase();
          
          // Check if this is a column header
          if (expectedHeaders.includes(headerLine)) {
            if (!tableHeaders.includes(headerLine)) { // Avoid duplicates
              tableHeaders.push(headerLine);
              headerCount++;
            }
            if (headerLine === 'POSITION') {
              foundPositionHeader = true;
            }
          } else if (headerCount >= 3 && headerLine.length === 0) {
            // Blank line after headers - data starts next
            dataStartIndex = j + 1;
            break;
          } else if (headerCount >= 3 && headerLine.length > 0 && 
                     !headerLine.includes('@') && 
                     !/[\d\s\-\(\)\.]{8,}/.test(headerLine)) {
            // Non-blank line that doesn't look like data - might be new section
            if (headerCount >= 3) {
              dataStartIndex = j;
              break;
            }
          }
        }
        
        if (dataStartIndex > 0 && tableHeaders.length >= 3) {
          i = dataStartIndex - 1;
        } else if (tableHeaders.length < 3) {
          // Didn't find enough headers, reset
          inTableSection = false;
        }
        continue;
      }
      
      // Parse table rows
      if (inTableSection && tableHeaders.length > 0 && i >= dataStartIndex) {
        const columnIndex = rowIndex % tableHeaders.length;
        const header = tableHeaders[columnIndex];
        
        // Map header to contact field
        if (header === 'POSITION' && line.length > 0 && 
            !line.includes('@') && 
            !/[\d\s\-\(\)\.]{8,}/.test(line) &&
            line.length < 50) { // Reasonable role length
          currentRow.role = line;
        } else if (header === 'NAME' && line.length > 0 && 
                   !line.includes('@') && 
                   !/[\d\s\-\(\)\.]{8,}/.test(line) &&
                   line.length < 100) { // Reasonable name length
          // New row starting - save previous if valid
          if (rowIndex > 0 && rowIndex % tableHeaders.length === 0 && currentRow.name) {
            if (currentRow.name && (currentRow.email || currentRow.phone)) {
              const contact = {
                name: currentRow.name,
                role: currentRow.role || sectionRole || 'Contact',
                email: currentRow.email || '',
                phone: currentRow.phone || '',
                source: 'table-rows',
                patternName: 'table_row_parsed',
                confidence: 0.9
              };
              
              if (this.isValidContact(contact)) {
                contacts.push(contact);
                logger.debug('✅ Extracted table row contact', {
                  extractionId,
                  contact: contact.name,
                  role: contact.role,
                  email: contact.email,
                  phone: contact.phone
                });
              }
            }
            currentRow = {};
          }
          currentRow.name = line;
        } else if (header === 'EMAIL' && line.includes('@')) {
          currentRow.email = line.toLowerCase().trim();
        } else if (header === 'CELL' && /[\d\s\-\(\)\.]{8,}/.test(line)) {
          currentRow.phone = this.cleanPhoneNumber(line);
        }
        
        rowIndex++;
        
        // Check if we've completed a full row
        if (rowIndex > 0 && rowIndex % tableHeaders.length === 0) {
          if (currentRow.name && (currentRow.email || currentRow.phone)) {
            const contact = {
              name: currentRow.name,
              role: currentRow.role || sectionRole || 'Contact',
              email: currentRow.email || '',
              phone: currentRow.phone || '',
              source: 'table-rows',
              patternName: 'table_row_parsed',
              confidence: 0.9
            };
            
            if (this.isValidContact(contact)) {
              contacts.push(contact);
            }
          }
          currentRow = {};
        }
        
        // Exit table section if we hit a new major section
        if (lineUpper.match(/^[A-Z\s]{3,}$/) && !expectedHeaders.includes(lineUpper) && lineUpper !== sectionRole) {
          inTableSection = false;
        }
      }
    }
    
    // Don't forget the last row
    if (currentRow.name && (currentRow.email || currentRow.phone)) {
      const contact = {
        name: currentRow.name,
        role: currentRow.role || sectionRole || 'Contact',
        email: currentRow.email || '',
        phone: currentRow.phone || '',
        source: 'table-rows',
        patternName: 'table_row_parsed',
        confidence: 0.9
      };
      
      if (this.isValidContact(contact)) {
        contacts.push(contact);
      }
    }
    
    logger.info('✅ Table row extraction complete', {
      extractionId,
      contactsFound: contacts.length
    });
    
    return { contacts, count: contacts.length };
  }

  /**
   * Extract contacts by document sections
   */
  extractBySections(text, extractionId) {
    const contacts = [];
    let count = 0;

    for (const sectionPattern of this.patterns.sections) {
      const matches = [...text.matchAll(sectionPattern.regex)];
      
      for (const match of matches) {
        const sectionContent = match[1];
        const sectionType = sectionPattern.section;
        
        // Extract contacts from this section using all patterns
        const sectionContacts = this.extractWithPatterns(sectionContent, this.patterns.structured, 'section-structured', extractionId);
        const semiSectionContacts = this.extractWithPatterns(sectionContent, this.patterns.semiStructured, 'section-semi', extractionId);
        
        // Add section context to contacts
        const sectionContactsWithContext = [
          ...sectionContacts.contacts,
          ...semiSectionContacts.contacts
        ].map(contact => ({
          ...contact,
          section: sectionType,
          confidence: Math.min(contact.confidence + 0.1, 1.0) // Boost confidence for section context
        }));

        contacts.push(...sectionContactsWithContext);
        count += sectionContactsWithContext.length;
      }
    }

    return { contacts, count };
  }

  /**
   * Extract contacts using specific pattern set
   */
  extractWithPatterns(text, patterns, category, extractionId = null) {
    const contacts = [];
    let count = 0;
    const patternStats = [];

    logger.info(`🔍 Processing ${category} patterns`, {
      extractionId,
      patternCount: patterns.length,
      textLength: text.length,
      textPreview: text.substring(0, 200) // First 200 chars for debugging
    });

    for (const pattern of patterns) {
      const patternStartTime = Date.now();
      let matchCount = 0;
      let validContactCount = 0;
      
      try {
        const matches = [...text.matchAll(pattern.regex)];
        matchCount = matches.length;
        
        logger.debug(`🔍 Testing pattern: ${pattern.name}`, {
          extractionId,
          category,
          matchCount,
          regex: pattern.regex.toString().substring(0, 100), // First 100 chars of regex
          sampleMatch: matches.length > 0 ? matches[0][0].substring(0, 100) : null
        });
        
        for (const match of matches) {
          try {
            const contact = this.buildContactFromMatch(match, pattern, category);
            if (contact && this.isValidContact(contact)) {
              contacts.push(contact);
              count++;
              validContactCount++;
              
              logger.debug(`✅ Pattern ${pattern.name} extracted contact`, {
                extractionId,
                name: contact.name,
                email: contact.email ? 'present' : 'missing',
                phone: contact.phone ? 'present' : 'missing',
                role: contact.role || 'missing'
              });
            } else {
              logger.debug(`⚠️ Pattern ${pattern.name} match rejected`, {
                extractionId,
                reason: !contact ? 'buildContactFromMatch returned null' : 'isValidContact returned false',
                matchPreview: match[0].substring(0, 100)
              });
            }
          } catch (contactError) {
            logger.warn(`❌ Error building contact from pattern ${pattern.name}`, {
              extractionId,
              error: contactError.message,
              matchPreview: match[0]?.substring(0, 100)
            });
          }
        }
      } catch (patternError) {
        logger.error(`❌ Error testing pattern ${pattern.name}`, {
          extractionId,
          error: patternError.message,
          regex: pattern.regex.toString()
        });
      }
      
      const patternTime = Date.now() - patternStartTime;
      patternStats.push({
        name: pattern.name,
        category,
        matchCount,
        validContactCount,
        time: patternTime
      });
    }

    logger.info(`✅ ${category} patterns completed`, {
      extractionId,
      totalContacts: count,
      patternStats: patternStats.filter(s => s.matchCount > 0 || s.validContactCount > 0)
    });

    return { contacts, count };
  }

  /**
   * Build contact from regex match
   */
  buildContactFromMatch(match, pattern, category) {
    const groups = pattern.groups;
    const contact = {
      source: category,
      patternName: pattern.name,
      confidence: pattern.confidence || 0.5
    };

    groups.forEach((group, index) => {
      if (match[index + 1]) {
        contact[group] = match[index + 1].trim();
      }
    });

    // Clean and format data
    if (contact.phone) {
      contact.phone = this.cleanPhoneNumber(contact.phone);
    }

    if (contact.email) {
      contact.email = contact.email.toLowerCase().trim();
    }

    if (contact.name) {
      contact.name = this.cleanName(contact.name);
    }

    // Handle flexible contact field
    if (contact.contact && !contact.phone && !contact.email) {
      const contactInfo = contact.contact.trim();
      
      // Check if it's an email
      if (contactInfo.includes('@')) {
        contact.email = contactInfo.toLowerCase().trim();
      }
      // Check if it's a phone number
      else if (/[\d\s\-\(\)\.]{8,}/.test(contactInfo)) {
        contact.phone = this.cleanPhoneNumber(contactInfo);
      }
      // Otherwise treat as company/agency
      else {
        contact.company = contactInfo;
      }
    }

    // Infer role if missing
    if (!contact.role && contact.name) {
      contact.role = this.inferRoleFromContext(contact.name, pattern);
    }

    return contact;
  }

  /**
   * Clean phone number
   */
  cleanPhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digits except + at start
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Add country code if missing (assume US)
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
      cleaned = '+1' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Clean name
   */
  cleanName(name) {
    if (!name) return '';
    
    // Remove extra whitespace and normalize
    return name.replace(/\s+/g, ' ').trim();
  }

  /**
   * Infer role from context
   */
  inferRoleFromContext(name, pattern) {
    // If we have a pattern name that suggests a role, use it
    if (pattern.name.includes('role_')) {
      return 'Contact'; // Generic role
    }
    
    // Try to infer role from the name or surrounding text
    const nameLower = name.toLowerCase();
    
    // Common role keywords in names
    if (nameLower.includes('photographer') || nameLower.includes('photog')) return 'PHOTOGRAPHER';
    if (nameLower.includes('mua') || nameLower.includes('makeup')) return 'MUA';
    if (nameLower.includes('stylist')) return 'STYLIST';
    if (nameLower.includes('producer')) return 'PRODUCER';
    if (nameLower.includes('director')) return 'DIRECTOR';
    if (nameLower.includes('model')) return 'MODEL';
    if (nameLower.includes('assistant')) return 'ASSISTANT';
    if (nameLower.includes('agent')) return 'AGENT';
    
    return 'Contact';
  }

  /**
   * Normalize roles using the role normalizer
   */
  normalizeContacts(contacts) {
    return contacts.map(contact => {
      const normalizedRole = this.normalizeRole(contact.role);
      
      return {
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contact.name || 'Unknown',
        role: normalizedRole,
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || contact.agency || '',
        department: contact.department || '',
        notes: contact.notes || '',
        section: contact.section || 'general',
        source: contact.source || 'unknown',
        confidence: contact.confidence || 0.5
      };
    });
  }

  /**
   * Normalize role using role normalizer
   */
  normalizeRole(role) {
    if (!role) return 'Contact';
    
    const roleUpper = role.toUpperCase();
    
    // Check exact matches first
    for (const [normalizedRole, variations] of Object.entries(this.roleNormalizer)) {
      if (variations.some(variation => roleUpper.includes(variation.toUpperCase()))) {
        return normalizedRole;
      }
    }
    
    // Return original if no match found
    return role;
  }

  /**
   * Post-process contacts to associate roles from previous lines
   * Handles formats like:
   *   ROLE (all caps, no colon)
   *   Name / Email / Phone
   */
  postProcessContacts(contacts, text) {
    if (!text || contacts.length === 0) return contacts;

    const lines = text.split('\n');
    const processedContacts = [...contacts];
    
    // Track role context as we scan lines
    let currentRole = null;
    const roleLineIndices = new Map(); // Map role to line index
    
    // First pass: Identify role lines and their positions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a role (all caps, 2+ words, no colon, not an email/phone)
      if (line.length > 3 && 
          line === line.toUpperCase() && 
          !line.includes(':') && 
          !line.includes('@') && 
          !/[\d\s\-\(\)\.]{8,}/.test(line) &&
          line.split(/\s+/).length >= 1) {
        
        // Check if it looks like a role (not a date, location, etc.)
        const roleKeywords = ['DIRECTOR', 'PRODUCER', 'PHOTOGRAPHER', 'STYLIST', 'MUA', 'HAIR', 
                             'MAKEUP', 'ASSISTANT', 'EDITOR', 'TALENT', 'AGENT', 'PUBLICIST',
                             'MANAGER', 'COORDINATOR', 'TECH', 'GAFFER', 'GRIP'];
        
        if (roleKeywords.some(keyword => line.includes(keyword))) {
          currentRole = line;
          roleLineIndices.set(i, currentRole);
        }
      }
      
      // Reset role if we hit a blank line or a new section
      if (line.length === 0 && currentRole) {
        // Keep role for a few lines after blank line
        // (in case contact info is on next line)
      }
    }
    
    // Second pass: Associate roles with contacts that don't have roles
    // Match contacts to lines by name/email/phone
    for (const contact of processedContacts) {
      if (!contact.role || contact.role === 'Contact' || contact.role === 'Unknown') {
        // Try to find this contact's line in the text
        const contactName = contact.name?.toLowerCase();
        const contactEmail = contact.email?.toLowerCase();
        const contactPhone = contact.phone?.replace(/\D/g, '');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          
          // Check if this line contains the contact's name, email, or phone
          const nameMatch = contactName && line.includes(contactName);
          const emailMatch = contactEmail && line.includes(contactEmail);
          const phoneMatch = contactPhone && line.includes(contactPhone.replace(/\D/g, ''));
          
          if (nameMatch || emailMatch || phoneMatch) {
            // Look backwards for the most recent role (within 5 lines)
            for (let j = Math.max(0, i - 5); j < i; j++) {
              if (roleLineIndices.has(j)) {
                contact.role = roleLineIndices.get(j);
                logger.debug('✅ Associated role from previous line', {
                  contact: contact.name,
                  role: contact.role,
                  lineIndex: i,
                  roleLineIndex: j
                });
                break;
              }
            }
            break;
          }
        }
      }
    }
    
    return processedContacts;
  }

  /**
   * Remove duplicate contacts
   */
  deduplicateContacts(contacts) {
    const unique = [];
    
    for (const contact of contacts) {
      const exists = unique.some(existing => 
        this.areContactsSimilar(existing, contact)
      );
      
      if (!exists) {
        unique.push(contact);
      }
    }
    
    return unique;
  }

  /**
   * Check if two contacts are similar
   */
  areContactsSimilar(contact1, contact2) {
    const name1 = (contact1.name || '').toLowerCase();
    const name2 = (contact2.name || '').toLowerCase();
    const phone1 = (contact1.phone || '').replace(/\D/g, '');
    const phone2 = (contact2.phone || '').replace(/\D/g, '');
    const email1 = (contact1.email || '').toLowerCase();
    const email2 = (contact2.email || '').toLowerCase();

    // Same name
    if (name1 && name2 && name1 === name2) return true;
    
    // Same phone
    if (phone1 && phone2 && phone1 === phone2) return true;
    
    // Same email
    if (email1 && email2 && email1 === email2) return true;

    return false;
  }

  /**
   * Validate contact data
   */
  isValidContact(contact) {
    if (!contact) return false;
    
    const hasName = !!(contact.name && contact.name.trim().length > 1);
    const hasContact = !!(contact.email || contact.phone);
    
    // For call sheets, we'll be more lenient - accept contacts with just names
    // if they have roles, as phone/email might not always be present
    if (hasName && contact.role && contact.role !== 'Unknown') {
      return true;
    }
    
    return hasName && hasContact;
  }
}

module.exports = RobustCallSheetExtractor;
