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

      logger.info('📄 Text extracted', {
        extractionId,
        textLength: text.length,
        preview: text.substring(0, 200) + '...'
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
      if (mimeType === 'text/plain') {
        return fileBuffer.toString('utf-8');
      }
      
      if (mimeType === 'application/pdf') {
        return await this.extractTextFromPDF(fileBuffer);
      }
      
      // For other types, try to read as text
      return fileBuffer.toString('utf-8');
    } catch (error) {
      logger.warn('⚠️ Text extraction failed, trying fallback', { error: error.message });
      return fileBuffer.toString('utf-8');
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
   * Extract contacts from text using patterns
   */
  async extractContactsFromText(text, options = {}) {
    const contacts = [];
    const rolePreferences = options.rolePreferences || [];

    logger.info('🔍 Extracting contacts from text', {
      textLength: text.length,
      rolePreferences: rolePreferences.length
    });

    // Try each pattern
    for (const pattern of this.contactPatterns) {
      try {
        const matches = [...text.matchAll(pattern.regex)];
        
        for (const match of matches) {
          const contact = this.buildContactFromMatch(match, pattern, rolePreferences);
          if (contact && this.isValidContact(contact)) {
            contacts.push(contact);
          }
        }
      } catch (error) {
        logger.warn('⚠️ Pattern failed', { pattern: pattern.name, error: error.message });
      }
    }

    // Remove duplicates
    const uniqueContacts = this.removeDuplicateContacts(contacts);

    logger.info('📊 Pattern extraction results', {
      totalMatches: contacts.length,
      uniqueContacts: uniqueContacts.length
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
    return contacts.map(contact => ({
      name: this.cleanName(contact.name),
      role: this.cleanRole(contact.role),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhone(contact.phone),
      company: contact.company || '',
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
    return phone.trim()
      .replace(/\s+/g, ' ')
      .trim();
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
}

module.exports = new SimpleExtractionService();
