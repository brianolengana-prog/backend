const winston = require('winston');
const coreExtractor = require('./extraction.service');

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

class SimpleExtractionService {
  constructor() {
    this.contactPatterns = [
      // Pattern 1: Role on one line, name and contact info on next lines
      {
        name: 'role_name_contact',
        regex: /^([A-Z][A-Z\s]+)\s*\n\s*([A-Za-z\s]+)\s*\n\s*([^\n@]+@[^\n]+)\s*\n\s*([+\d\s\-\(\)]+)/gm,
        groups: ['role', 'name', 'email', 'phone']
      },
      // Pattern 2: Name - Role - Contact info on same line
      {
        name: 'name_role_contact',
        regex: /([A-Za-z\s]+)\s*[-–—]\s*([A-Z][A-Z\s]+)\s*[-–—]\s*([^\n@]+@[^\n]+)\s*[-–—]\s*([+\d\s\-\(\)]+)/gm,
        groups: ['name', 'role', 'email', 'phone']
      },
      // Pattern 3: Role: Name, Email, Phone
      {
        name: 'role_colon_format',
        regex: /([A-Z][A-Z\s]+):\s*([A-Za-z\s]+),\s*([^\n@]+@[^\n]+),\s*([+\d\s\-\(\)]+)/gm,
        groups: ['role', 'name', 'email', 'phone']
      },
      // Pattern 4: Simple name and email pairs
      {
        name: 'name_email',
        regex: /([A-Za-z\s]{2,})\s*\n\s*([^\n@]+@[^\n]+)/gm,
        groups: ['name', 'email']
      },
      // Pattern 5: Phone number patterns
      {
        name: 'phone_pattern',
        regex: /([+\d\s\-\(\)]{10,})/gm,
        groups: ['phone']
      },
      // Pattern 6: Table with tabs: Name\tRole\tEmail\tPhone
      {
        name: 'tab_table_name_role_email_phone',
        regex: /^([^\t]+)\t([^\t]+)\t([^\t\s]+@[^\t\s]+)\t(.+)$/gm,
        groups: ['name', 'role', 'email', 'phone']
      },
      // Pattern 7: Table with multi-space columns: Name  Role  Email  Phone
      {
        name: 'space_table_name_role_email_phone',
        regex: /^([A-Z][A-Za-z .'-]+)\s{2,}([A-Za-z &/]+)\s{2,}([^\s]+@[^\s]+)\s{2,}(.+)$/gm,
        groups: ['name', 'role', 'email', 'phone']
      },
      // Pattern 8: Role: Name / Company / Email / Phone
      {
        name: 'role_name_company_email_phone',
        regex: /^([^:]+):\s*([^\/|,]+)\s*[\/|,]\s*([^\/|,]+)\s*[\/|,]\s*([^\s@]+@[^\s,|\/]+)\s*[\/|,]\s*(.+)$/gm,
        groups: ['role', 'name', 'company', 'email', 'phone']
      },
      // Pattern 9: Name | Company | Role | Email | Phone
      {
        name: 'pipe_name_company_role_email_phone',
        regex: /^([^|]+)\|([^|]+)\|([^|]+)\|([^|\s]+@[^|\s]+)\|(.+)$/gm,
        groups: ['name', 'company', 'role', 'email', 'phone']
      }
    ];

    this.roleKeywords = [
      'PHOTOGRAPHER', 'PHOTO', 'CAMERA',
      'MUA', 'MAKEUP', 'MAKE-UP', 'MAKE UP',
      'STYLIST', 'STYLE', 'WARDROBE',
      'PRODUCER', 'PROD', 'PRODUCTION',
      'DIRECTOR', 'DIR',
      'ASSISTANT', 'ASSIST', 'ASST',
      'MODEL', 'TALENT',
      'HAIR', 'HAIRSTYLIST',
      'WARDROBE', 'STYLING',
      'CREATIVE DIRECTOR', 'CD',
      'ART DIRECTOR', 'AD'
    ];
  }

  /**
   * Main extraction method
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('🚀 Starting simple extraction', {
        extractionId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        userId: options.userId
      });

      // Step 1: Extract text from file
      const text = await this.extractTextFromFile(fileBuffer, mimeType);
      
      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      const maskedPreview = this.maskPII(text.substring(0, 200));
      logger.info('📄 Text extracted', {
        extractionId,
        textLength: text.length,
        preview: maskedPreview + '...'
      });

      // Step 2: Extract contacts using patterns
      const contacts = await this.extractContactsFromText(text, options);

      // Step 3: Clean and validate contacts
      const cleanedContacts = this.cleanContacts(contacts);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Simple extraction completed', {
        extractionId,
        contactsFound: cleanedContacts.length,
        processingTime: `${processingTime}ms`
      });

      return {
        success: true,
        contacts: cleanedContacts,
        processingTime,
        metadata: {
          extractionId,
          strategy: 'simple-pattern',
          textLength: text.length,
          patternsUsed: this.contactPatterns.length
        }
      };

    } catch (error) {
      logger.error('❌ Simple extraction failed', {
        extractionId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        contacts: [],
        error: error.message,
        metadata: {
          extractionId,
          strategy: 'simple-pattern'
        }
      };
    }
  }

  /**
   * Extract text from different file types
   */
  async extractTextFromFile(fileBuffer, mimeType) {
    try {
      // Delegate to core extractor to support PDF, DOCX, XLSX, CSV, images
      const text = await coreExtractor.extractTextFromDocument(fileBuffer, mimeType);
      return text;
    } catch (error) {
      logger.warn('⚠️ Core text extraction failed, trying fallback', { error: error.message });
      try {
        // Minimal fallback: PDF handler, else utf-8
        if (mimeType === 'application/pdf') {
          return await this.extractTextFromPDF(fileBuffer);
        }
        return fileBuffer.toString('utf-8');
      } catch (fallbackError) {
        logger.warn('⚠️ Fallback text extraction failed', { error: fallbackError.message });
        return fileBuffer.toString('utf-8');
      }
    }
  }

  /**
   * Extract text from PDF using pdfjs-dist
   */
  async extractTextFromPDF(fileBuffer) {
    try {
      const pdfjs = await import('pdfjs-dist');
      const uint8Array = new Uint8Array(fileBuffer);
      const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }
      
      return fullText.trim();
    } catch (error) {
      logger.warn('⚠️ PDF extraction failed, using fallback', { error: error.message });
      return fileBuffer.toString('utf-8');
    }
  }

  /**
   * Mask PII in log previews
   */
  maskPII(text) {
    if (!text) return '';
    const emailMasked = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '***@***');
    const phoneMasked = emailMasked.replace(/[+]?\d[\d\s().-]{6,}\d/g, '***-***-****');
    return phoneMasked;
  }

  /**
   * Extract contacts from text using patterns with early exit optimization
   */
  async extractContactsFromText(text, options = {}) {
    const contacts = [];
    const rolePreferences = options.rolePreferences || [];
    const maxContacts = options.maxContacts || 1000; // Early exit limit
    const maxProcessingTime = options.maxProcessingTime || 15000; // 15 second timeout
    const startTime = Date.now();

    logger.info('🔍 Extracting contacts from text', {
      textLength: text.length,
      rolePreferences: rolePreferences.length,
      maxContacts,
      maxProcessingTime
    });

    // Try each pattern with early exit and detailed logging
    for (let i = 0; i < this.contactPatterns.length; i++) {
      const pattern = this.contactPatterns[i];
      const patternStartTime = Date.now();
      
      // Check for timeout before processing each pattern
      if (Date.now() - startTime > maxProcessingTime) {
        logger.warn('⏰ Pattern extraction timeout reached', {
          processedPatterns: i,
          totalPatterns: this.contactPatterns.length,
          contactsFound: contacts.length,
          processingTime: `${Date.now() - startTime}ms`
        });
        break;
      }
      
      try {
        logger.info(`🔍 Testing pattern ${i + 1}/${this.contactPatterns.length}: ${pattern.name}`);
        
        const matches = [...text.matchAll(pattern.regex)];
        logger.info(`📊 Pattern ${pattern.name} found ${matches.length} matches`);
        
        // Limit matches per pattern to prevent hanging
        const maxMatchesPerPattern = 500;
        const limitedMatches = matches.slice(0, maxMatchesPerPattern);
        
        if (matches.length > maxMatchesPerPattern) {
          logger.info(`⚠️ Limiting pattern ${pattern.name} to ${maxMatchesPerPattern} matches (found ${matches.length})`);
        }
        
        for (let j = 0; j < limitedMatches.length; j++) {
          const match = limitedMatches[j];
          const contact = this.buildContactFromMatch(match, pattern, rolePreferences);
          
          if (contact && this.isValidContact(contact)) {
            contacts.push(contact);
            
            // Log every 50 contacts found
            if (contacts.length % 50 === 0) {
              logger.info(`📈 Found ${contacts.length} contacts so far`, {
                pattern: pattern.name,
                processingTime: `${Date.now() - startTime}ms`
              });
            }
            
            // Early exit if we have enough contacts
            if (contacts.length >= maxContacts) {
              logger.info('⚡ Early exit: reached max contacts', { 
                found: contacts.length, 
                maxContacts,
                processingTime: `${Date.now() - startTime}ms`
              });
              break;
            }
          }
        }
        
        const patternTime = Date.now() - patternStartTime;
        logger.info(`✅ Pattern ${pattern.name} completed in ${patternTime}ms`, {
          matches: limitedMatches.length,
          validContacts: contacts.length
        });
        
        // Break outer loop if we hit the limit
        if (contacts.length >= maxContacts) break;
        
      } catch (error) {
        logger.warn('⚠️ Pattern failed', { 
          pattern: pattern.name, 
          error: error.message,
          processingTime: `${Date.now() - patternStartTime}ms`
        });
      }
    }

    // Remove duplicates
    const uniqueContacts = this.removeDuplicateContacts(contacts);

    logger.info('📊 Pattern extraction results', {
      totalMatches: contacts.length,
      uniqueContacts: uniqueContacts.length,
      processingTime: `${Date.now() - startTime}ms`
    });

    return uniqueContacts;
  }

  /**
   * Build contact object from regex match
   */
  buildContactFromMatch(match, pattern, rolePreferences = []) {
    const contact = {
      name: '',
      role: '',
      email: '',
      phone: '',
      company: '',
      source: pattern.name
    };

    // Map groups to contact fields
    pattern.groups.forEach((group, index) => {
      const value = match[index + 1]?.trim();
      if (value) {
        switch (group) {
          case 'name':
            contact.name = value;
            break;
          case 'role':
            contact.role = value;
            break;
          case 'email':
            contact.email = value;
            break;
          case 'phone':
            contact.phone = value;
            break;
        }
      }
    });

    // If no role found, try to infer from context
    if (!contact.role && contact.name) {
      contact.role = this.inferRoleFromContext(contact.name, rolePreferences);
    }

    return contact;
  }

  /**
   * Infer role from context or preferences
   */
  inferRoleFromContext(name, rolePreferences = []) {
    // Check if any role preferences match
    for (const preference of rolePreferences) {
      if (name.toLowerCase().includes(preference.toLowerCase())) {
        return preference;
      }
    }

    // Default to 'Contact' if no role found
    return 'Contact';
  }

  /**
   * Validate contact has required fields
   */
  isValidContact(contact) {
    return contact.name && contact.name.length > 1 && 
           (contact.email || contact.phone);
  }

  /**
   * Clean and normalize contacts
   */
  cleanContacts(contacts) {
    const sectioned = this.assignSections(contacts);
    return sectioned.map(contact => ({
      name: this.cleanName(contact.name),
      role: this.cleanRole(contact.role),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhone(contact.phone),
      company: contact.company || '',
      section: contact.section || undefined,
      source: contact.source || 'simple-pattern'
    }));
  }

  /**
   * Clean name field
   */
  cleanName(name) {
    if (!name) return '';
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .trim();
  }

  /**
   * Clean role field
   */
  cleanRole(role) {
    if (!role) return 'Contact';
    return role.trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();
  }

  /**
   * Clean email field
   */
  cleanEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  /**
   * Clean phone field
   */
  cleanPhone(phone) {
    if (!phone) return '';
    const raw = phone.trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      const us = digits.substring(1);
      return `(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}`;
    }
    // Fall back to compact form
    return (raw.startsWith('+') ? '+' : '') + digits;
  }

  /**
   * Remove duplicate contacts
   */
  removeDuplicateContacts(contacts) {
    const seen = new Set();
    return contacts.filter(contact => {
      const key = `${contact.name}-${contact.email}-${contact.phone}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Assign section labels based on nearby headers without AI
   */
  assignSections(contacts) {
    // Use rawLine and simple heuristics to infer sections
    const sections = ['PRODUCTION', 'CLIENT', 'TALENT', 'CREW', 'AGENCY', 'CONTACTS'];
    return contacts.map(c => {
      const line = (c.rawLine || '').toUpperCase();
      for (const s of sections) {
        if (line.includes(s)) {
          return { ...c, section: s };
        }
      }
      // Fallback: infer from role
      const role = (c.role || '').toUpperCase();
      if (role.includes('PRODUCER') || role.includes('PRODUCTION')) return { ...c, section: 'PRODUCTION' };
      if (role.includes('MODEL') || role.includes('TALENT')) return { ...c, section: 'TALENT' };
      if (role.includes('AGENCY') || role.includes('CLIENT')) return { ...c, section: 'CLIENT' };
      if (role.includes('ASSIST') || role.includes('CREW') || role.includes('GAFFER') || role.includes('GRIP')) return { ...c, section: 'CREW' };
      return c;
    });
  }
}

module.exports = new SimpleExtractionService();
