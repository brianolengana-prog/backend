/**
 * Robust Call Sheet Extractor
 * 
 * Comprehensive pattern-based extraction specifically designed for call sheets
 * Handles the infinite variety of call sheet formats found in production
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
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
      
      // Step 2: Extract with structured patterns
      const structuredResults = this.extractWithPatterns(text, this.patterns.structured, 'structured');
      
      // Step 3: Extract with semi-structured patterns
      const semiStructuredResults = this.extractWithPatterns(text, this.patterns.semiStructured, 'semi-structured');
      
      // Step 4: Extract with unstructured patterns (fallback)
      const unstructuredResults = this.extractWithPatterns(text, this.patterns.unstructured, 'unstructured');
      
      // Step 5: Merge and deduplicate results
      const allContacts = [
        ...sectionResults.contacts,
        ...structuredResults.contacts,
        ...semiStructuredResults.contacts,
        ...unstructuredResults.contacts
      ];

      const uniqueContacts = this.deduplicateContacts(allContacts);
      
      // Step 6: Normalize roles and clean data
      const normalizedContacts = this.normalizeContacts(uniqueContacts);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Robust extraction complete', {
        extractionId,
        totalContacts: normalizedContacts.length,
        processingTime,
        patterns: {
          structured: structuredResults.count,
          semiStructured: semiStructuredResults.count,
          unstructured: unstructuredResults.count,
          sections: sectionResults.count
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
            sections: sectionResults.count
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
        const sectionContacts = this.extractWithPatterns(sectionContent, this.patterns.structured, 'section-structured');
        const semiSectionContacts = this.extractWithPatterns(sectionContent, this.patterns.semiStructured, 'section-semi');
        
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
  extractWithPatterns(text, patterns, category) {
    const contacts = [];
    let count = 0;

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern.regex)];
      
      for (const match of matches) {
        const contact = this.buildContactFromMatch(match, pattern, category);
        if (contact && this.isValidContact(contact)) {
          contacts.push(contact);
          count++;
        }
      }
    }

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
