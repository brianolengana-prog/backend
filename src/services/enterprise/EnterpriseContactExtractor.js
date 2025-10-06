/**
 * Enterprise Contact Extractor
 * 
 * Advanced contact extraction system with:
 * - Intelligent pattern matching
 * - Data validation and cleaning
 * - Confidence scoring
 * - OpenAI enhancement
 * - Enterprise reliability
 */

const { OpenAI } = require('openai');
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

class EnterpriseContactExtractor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isAIAvailable = !!process.env.OPENAI_API_KEY;
    
    // Enterprise-grade extraction patterns
    this.patterns = this.initializePatterns();
    this.validators = this.initializeValidators();
    this.cleaners = this.initializeCleaners();
  }

  /**
   * Initialize advanced extraction patterns
   */
  initializePatterns() {
    return {
      // High-confidence patterns for structured data
      structured: [
        {
          name: 'call_sheet_role_name_phone',
          regex: /^([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+(?:\s+[A-Za-z\s\-'\.]+)*)\s*(?:\/|\s|-)?\s*(\(?[\d\s\-\(\)\.]{8,}\)?)\s*$/gm,
          groups: ['role', 'name', 'phone'],
          confidence: 0.9,
          section: 'crew'
        },
        {
          name: 'tabular_name_role_email_phone',
          regex: /^([A-Za-z\s\-'\.]+)\t+([A-Za-z\s&\/\-]+)\t+([^\t\s]+@[^\t\s]+)\t+(.+)$/gm,
          groups: ['name', 'role', 'email', 'phone'],
          confidence: 0.95,
          section: 'talent'
        },
        {
          name: 'contact_card_format',
          regex: /^([A-Za-z\s\-'\.]+)\n([A-Za-z\s&\/\-]+)\n([^\s]+@[^\s]+)\n(\(?[\d\s\-\(\)\.]{8,}\)?)$/gm,
          groups: ['name', 'role', 'email', 'phone'],
          confidence: 0.9,
          section: 'contacts'
        }
      ],

      // Medium-confidence patterns for semi-structured data
      semiStructured: [
        {
          name: 'name_phone_email_line',
          regex: /([A-Za-z\s\-'\.]{2,})\s+(\(?[\d\s\-\(\)\.]{8,}\)?)\s+([^\s]+@[^\s]+)/gm,
          groups: ['name', 'phone', 'email'],
          confidence: 0.7,
          section: 'mixed'
        },
        {
          name: 'role_colon_contact_info',
          regex: /([A-Z][A-Z\s&\/\-]+):\s*([A-Za-z\s\-'\.]+)\s*[,\/\-]\s*([^\s]+@[^\s]+|[\d\s\-\(\)\.]{8,})/gm,
          groups: ['role', 'name', 'contact'],
          confidence: 0.6,
          section: 'crew'
        }
      ],

      // Specialized patterns for different document types
      callSheet: [
        {
          name: 'crew_department_format',
          regex: /^(CREW|TALENT|PRODUCTION)\s*\n((?:[A-Z][A-Z\s&\/\-]+:\s*[A-Za-z\s\-'\.]+(?:\s*[\d\s\-\(\)\.]{8,})?\s*\n?)+)/gm,
          groups: ['section', 'entries'],
          confidence: 0.8,
          section: 'department'
        },
        {
          name: 'model_agency_format',
          regex: /([A-Za-z\s\-'\.]+)\s*\/\s*([A-Za-z\s&]+)\s*-\s*([A-Za-z\s\-'\.]+)\s*\/\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['name', 'agency', 'agent', 'phone'],
          confidence: 0.85,
          section: 'talent'
        }
      ],

      // Fallback patterns for unstructured data
      fallback: [
        {
          name: 'email_extraction',
          regex: /([A-Za-z\s\-'\.]{2,})\s*[:\-]?\s*([^\s]+@[^\s]+)/gm,
          groups: ['name', 'email'],
          confidence: 0.4,
          section: 'contacts'
        },
        {
          name: 'phone_extraction',
          regex: /([A-Za-z\s\-'\.]{2,})\s*[:\-]?\s*(\(?[\d\s\-\(\)\.]{8,}\)?)/gm,
          groups: ['name', 'phone'],
          confidence: 0.3,
          section: 'contacts'
        }
      ]
    };
  }

  /**
   * Initialize data validators
   */
  initializeValidators() {
    return {
      name: (name) => {
        if (!name || typeof name !== 'string') return false;
        const cleaned = name.trim();
        
        // Must be 2-50 characters
        if (cleaned.length < 2 || cleaned.length > 50) return false;
        
        // Must contain at least one letter
        if (!/[A-Za-z]/.test(cleaned)) return false;
        
        // Should not contain excessive special characters
        if ((cleaned.match(/[^A-Za-z\s\-'\.]/g) || []).length > 2) return false;
        
        // Should not be common non-names
        const nonNames = ['equipment', 'travel', 'approx', 'ubers', 'lh', 'sj', 'paid via'];
        if (nonNames.some(nonName => cleaned.toLowerCase().includes(nonName))) return false;
        
        return true;
      },

      email: (email) => {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim()) && !email.includes('\t');
      },

      phone: (phone) => {
        if (!phone || typeof phone !== 'string') return false;
        const cleaned = phone.replace(/\D/g, '');
        
        // Must be 7-15 digits
        if (cleaned.length < 7 || cleaned.length > 15) return false;
        
        // Should not contain tab characters or excessive formatting
        if (phone.includes('\t') || phone.includes('\n')) return false;
        
        return true;
      },

      role: (role) => {
        if (!role || typeof role !== 'string') return false;
        const cleaned = role.trim().toUpperCase();
        
        // Must be 2-30 characters
        if (cleaned.length < 2 || cleaned.length > 30) return false;
        
        // Common valid roles
        const validRoles = [
          'DIRECTOR', 'PRODUCER', 'PHOTOGRAPHER', 'STYLIST', 'MUA', 'MAKEUP',
          'HAIR', 'ASSISTANT', 'TALENT', 'MODEL', 'ACTOR', 'CLIENT',
          'AGENCY', 'AGENT', 'COORDINATOR', 'MANAGER', 'SUPERVISOR'
        ];
        
        return validRoles.some(validRole => 
          cleaned.includes(validRole) || validRole.includes(cleaned)
        );
      }
    };
  }

  /**
   * Initialize data cleaners
   */
  initializeCleaners() {
    return {
      name: (name) => {
        if (!name) return '';
        return name
          .trim()
          .replace(/^[^A-Za-z]+/, '') // Remove leading non-letters
          .replace(/[^A-Za-z\s\-'\.]/g, ' ') // Replace invalid chars with space
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      },

      email: (email) => {
        if (!email) return '';
        return email
          .trim()
          .replace(/[\t\n\r]/g, '') // Remove tab/newline chars
          .toLowerCase();
      },

      phone: (phone) => {
        if (!phone) return '';
        
        // Remove tab characters and normalize
        let cleaned = phone.replace(/[\t\n\r]/g, '').trim();
        
        // Extract just the digits and common formatting
        const digits = cleaned.replace(/\D/g, '');
        
        // Format US phone numbers
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length === 11 && digits[0] === '1') {
          return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        
        return cleaned;
      },

      role: (role) => {
        if (!role) return '';
        return role
          .trim()
          .toUpperCase()
          .replace(/[^A-Z\s&\/\-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
    };
  }

  /**
   * Main extraction method
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `enterprise_${Date.now()}`;
    
    logger.info('🏢 Starting enterprise contact extraction', {
      extractionId,
      textLength: text.length,
      options
    });

    try {
      // Step 1: Pattern-based extraction
      const patternResults = await this.extractWithPatterns(text, extractionId);
      
      // Step 2: Data validation and cleaning
      const cleanedContacts = this.validateAndCleanContacts(patternResults, extractionId);
      
      // Step 3: Deduplication
      const deduplicatedContacts = this.deduplicateContacts(cleanedContacts, extractionId);
      
      // Step 4: AI enhancement (if available and enabled)
      let finalContacts = deduplicatedContacts;
      if (this.isAIAvailable && options.useAI !== false) {
        finalContacts = await this.enhanceWithAI(text, deduplicatedContacts, extractionId);
      }
      
      // Step 5: Final confidence scoring
      const scoredContacts = this.calculateFinalConfidence(finalContacts, extractionId);
      
      logger.info('✅ Enterprise extraction completed', {
        extractionId,
        contactsFound: scoredContacts.length,
        averageConfidence: scoredContacts.reduce((sum, c) => sum + c.confidence, 0) / scoredContacts.length
      });

      return {
        contacts: scoredContacts,
        metadata: {
          extractionId,
          totalFound: scoredContacts.length,
          averageConfidence: scoredContacts.reduce((sum, c) => sum + c.confidence, 0) / scoredContacts.length,
          processingSteps: ['pattern_extraction', 'validation', 'deduplication', 'ai_enhancement', 'confidence_scoring']
        }
      };

    } catch (error) {
      logger.error('❌ Enterprise extraction failed', {
        extractionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract contacts using advanced patterns
   */
  async extractWithPatterns(text, extractionId) {
    const results = [];
    
    // Process each pattern category
    for (const [category, patterns] of Object.entries(this.patterns)) {
      logger.info(`🔍 Processing ${category} patterns`, { extractionId });
      
      for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern.regex)];
        
        for (const match of matches) {
          const contact = this.buildContactFromMatch(match, pattern);
          if (contact) {
            contact.source = 'pattern';
            contact.patternName = pattern.name;
            contact.patternCategory = category;
            contact.baseConfidence = pattern.confidence;
            results.push(contact);
          }
        }
        
        logger.info(`📊 Pattern ${pattern.name} found ${matches.length} matches`, {
          extractionId,
          patternName: pattern.name
        });
      }
    }
    
    return results;
  }

  /**
   * Build contact object from regex match
   */
  buildContactFromMatch(match, pattern) {
    const contact = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      role: '',
      email: '',
      phone: '',
      company: '',
      section: pattern.section || 'general'
    };

    // Map groups to contact fields
    pattern.groups.forEach((field, index) => {
      const value = match[index + 1];
      if (value && field in contact) {
        contact[field] = value.trim();
      }
    });

    // Handle special cases
    if (pattern.groups.includes('contact')) {
      const contactInfo = match[pattern.groups.indexOf('contact') + 1];
      if (contactInfo) {
        if (contactInfo.includes('@')) {
          contact.email = contactInfo;
        } else if (/[\d\-\(\)]/.test(contactInfo)) {
          contact.phone = contactInfo;
        }
      }
    }

    return contact;
  }

  /**
   * Validate and clean extracted contacts
   */
  validateAndCleanContacts(contacts, extractionId) {
    logger.info('🧹 Validating and cleaning contacts', {
      extractionId,
      inputCount: contacts.length
    });

    const cleaned = contacts
      .map(contact => {
        // Clean each field
        const cleanedContact = {
          ...contact,
          name: this.cleaners.name(contact.name),
          email: this.cleaners.email(contact.email),
          phone: this.cleaners.phone(contact.phone),
          role: this.cleaners.role(contact.role)
        };

        // Validate required fields
        const isValidName = this.validators.name(cleanedContact.name);
        const hasValidContact = this.validators.email(cleanedContact.email) || 
                               this.validators.phone(cleanedContact.phone);

        if (isValidName && hasValidContact) {
          // Calculate validation confidence
          let validationScore = 0.5; // Base score
          
          if (this.validators.name(cleanedContact.name)) validationScore += 0.2;
          if (this.validators.email(cleanedContact.email)) validationScore += 0.15;
          if (this.validators.phone(cleanedContact.phone)) validationScore += 0.15;
          if (this.validators.role(cleanedContact.role)) validationScore += 0.1;
          
          cleanedContact.validationScore = Math.min(validationScore, 1.0);
          return cleanedContact;
        }

        return null;
      })
      .filter(Boolean);

    logger.info('✅ Contact validation completed', {
      extractionId,
      inputCount: contacts.length,
      outputCount: cleaned.length,
      rejectionRate: ((contacts.length - cleaned.length) / contacts.length * 100).toFixed(1) + '%'
    });

    return cleaned;
  }

  /**
   * Remove duplicate contacts
   */
  deduplicateContacts(contacts, extractionId) {
    logger.info('🔄 Deduplicating contacts', {
      extractionId,
      inputCount: contacts.length
    });

    const contactMap = new Map();
    
    contacts.forEach(contact => {
      const key = this.generateContactKey(contact);
      const existing = contactMap.get(key);
      
      if (!existing) {
        contactMap.set(key, contact);
      } else {
        // Merge contacts, keeping the one with higher confidence
        const merged = this.mergeContacts(existing, contact);
        contactMap.set(key, merged);
      }
    });

    const deduplicated = Array.from(contactMap.values());
    
    logger.info('✅ Deduplication completed', {
      extractionId,
      inputCount: contacts.length,
      outputCount: deduplicated.length,
      duplicatesRemoved: contacts.length - deduplicated.length
    });

    return deduplicated;
  }

  /**
   * Generate unique key for contact deduplication
   */
  generateContactKey(contact) {
    const name = (contact.name || '').toLowerCase().replace(/[^a-z]/g, '');
    const phone = (contact.phone || '').replace(/\D/g, '');
    const email = (contact.email || '').toLowerCase();
    
    return `${name}_${phone}_${email}`;
  }

  /**
   * Merge two similar contacts
   */
  mergeContacts(contact1, contact2) {
    const merged = { ...contact1 };
    
    // Use the contact with higher confidence as base
    const primary = (contact1.baseConfidence || 0) >= (contact2.baseConfidence || 0) ? contact1 : contact2;
    const secondary = primary === contact1 ? contact2 : contact1;
    
    // Merge fields, preferring non-empty values from higher confidence contact
    Object.keys(merged).forEach(key => {
      if (!merged[key] && secondary[key]) {
        merged[key] = secondary[key];
      }
    });
    
    // Combine confidence scores
    merged.baseConfidence = Math.max(contact1.baseConfidence || 0, contact2.baseConfidence || 0);
    merged.validationScore = Math.max(contact1.validationScore || 0, contact2.validationScore || 0);
    merged.source = 'merged';
    merged.mergedFrom = [contact1.patternName, contact2.patternName].filter(Boolean);
    
    return merged;
  }

  /**
   * Enhance contacts using OpenAI
   */
  async enhanceWithAI(text, contacts, extractionId) {
    if (!this.isAIAvailable) {
      logger.warn('⚠️ AI enhancement skipped - OpenAI not available', { extractionId });
      return contacts;
    }

    logger.info('🤖 Enhancing contacts with AI', {
      extractionId,
      contactCount: contacts.length
    });

    try {
      const prompt = this.buildAIEnhancementPrompt(text, contacts);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting and enhancing contact information from production documents. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      
      // Merge AI enhancements with existing contacts
      const enhanced = this.mergeAIEnhancements(contacts, aiResult.contacts || [], extractionId);
      
      logger.info('✅ AI enhancement completed', {
        extractionId,
        originalCount: contacts.length,
        enhancedCount: enhanced.length
      });

      return enhanced;

    } catch (error) {
      logger.error('❌ AI enhancement failed', {
        extractionId,
        error: error.message
      });
      
      // Return original contacts if AI fails
      return contacts;
    }
  }

  /**
   * Build AI enhancement prompt
   */
  buildAIEnhancementPrompt(text, contacts) {
    return `
Analyze this production document and enhance the extracted contacts. 

DOCUMENT TEXT:
${text.substring(0, 3000)}

EXTRACTED CONTACTS:
${JSON.stringify(contacts.slice(0, 20), null, 2)}

Please:
1. Validate and correct any extraction errors
2. Fill in missing information (roles, emails, phones)
3. Add any missed contacts
4. Ensure names are properly formatted
5. Standardize roles (DIRECTOR, PRODUCER, PHOTOGRAPHER, STYLIST, MUA, etc.)

Return JSON format:
{
  "contacts": [
    {
      "name": "Full Name",
      "role": "STANDARDIZED_ROLE",
      "email": "email@domain.com",
      "phone": "(555) 123-4567",
      "company": "Company Name",
      "confidence": 0.95,
      "source": "ai_enhanced"
    }
  ]
}
`;
  }

  /**
   * Merge AI enhancements with existing contacts
   */
  mergeAIEnhancements(originalContacts, aiContacts, extractionId) {
    const contactMap = new Map();
    
    // Add original contacts
    originalContacts.forEach(contact => {
      const key = this.generateContactKey(contact);
      contactMap.set(key, { ...contact, source: 'pattern' });
    });
    
    // Merge AI enhancements
    aiContacts.forEach(aiContact => {
      const key = this.generateContactKey(aiContact);
      const existing = contactMap.get(key);
      
      if (existing) {
        // Enhance existing contact
        const enhanced = {
          ...existing,
          ...aiContact,
          id: existing.id, // Keep original ID
          source: 'ai_enhanced',
          originalSource: existing.source,
          aiConfidence: aiContact.confidence || 0.8
        };
        contactMap.set(key, enhanced);
      } else {
        // Add new AI-discovered contact
        contactMap.set(key, {
          ...aiContact,
          id: `ai_contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'ai_discovered'
        });
      }
    });
    
    return Array.from(contactMap.values());
  }

  /**
   * Calculate final confidence scores
   */
  calculateFinalConfidence(contacts, extractionId) {
    return contacts.map(contact => {
      let confidence = 0;
      
      // Base confidence from pattern or AI
      confidence += (contact.baseConfidence || contact.confidence || 0.5) * 0.4;
      
      // Validation score
      confidence += (contact.validationScore || 0.5) * 0.3;
      
      // Completeness bonus
      let completeness = 0;
      if (contact.name) completeness += 0.4;
      if (contact.email) completeness += 0.3;
      if (contact.phone) completeness += 0.2;
      if (contact.role) completeness += 0.1;
      confidence += completeness * 0.2;
      
      // Source bonus
      if (contact.source === 'ai_enhanced') confidence += 0.1;
      if (contact.source === 'merged') confidence += 0.05;
      
      // Ensure confidence is between 0 and 1
      contact.confidence = Math.max(0, Math.min(1, confidence));
      
      return contact;
    });
  }
}

module.exports = EnterpriseContactExtractor;
