/**
 * Adaptive Extraction Service
 * Intelligently combines custom patterns with AI to handle any call sheet format
 */

const simpleExtractionService = require('./simpleExtraction.service');
const aiExtractionService = require('./aiExtraction.service');
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

class AdaptiveExtractionService {
  constructor() {
    this.simpleService = simpleExtractionService;
    this.aiService = aiExtractionService;
    
    // Document type classifiers
    this.documentTypes = {
      'call_sheet': {
        keywords: ['call sheet', 'call time', 'location', 'crew', 'talent', 'production'],
        patterns: ['crew', 'talent', 'production', 'call_sheet_crew', 'call_sheet_model'],
        confidence: 0.9
      },
      'contact_list': {
        keywords: ['contacts', 'directory', 'phone list', 'email list'],
        patterns: ['name_email', 'phone_pattern', 'tab_table_name_role_email_phone'],
        confidence: 0.8
      },
      'production_schedule': {
        keywords: ['schedule', 'timeline', 'shooting', 'call times'],
        patterns: ['role_name_contact', 'call_sheet_crew'],
        confidence: 0.7
      },
      'crew_list': {
        keywords: ['crew', 'department', 'photographer', 'stylist', 'mua'],
        patterns: ['call_sheet_crew', 'call_sheet_team', 'role_name_contact'],
        confidence: 0.9
      },
      'talent_sheet': {
        keywords: ['talent', 'model', 'actor', 'agency', 'representation'],
        patterns: ['call_sheet_model', 'name_email', 'role_name_contact'],
        confidence: 0.8
      }
    };

    // Predefined AI prompts for different document types
    this.aiPrompts = {
      'call_sheet': {
        system: `You are an expert at extracting contact information from production call sheets. Focus on:
- Crew members (Photographer, MUA, Stylist, Assistant, etc.)
- Talent/Models with their agencies
- Production team (Producer, Director, etc.)
- Location contacts and vendors
- Any person with a role and contact info`,
        user: `Extract all contacts from this call sheet. Look for:
1. Role: Name / Phone format
2. Model: Name / Agency / Phone format  
3. Team: Role: Name / Phone format
4. Any other people with contact information

Return JSON array with: name, role, phone, email, company, section`
      },
      'contact_list': {
        system: `You are an expert at extracting contacts from contact lists and directories.`,
        user: `Extract all contacts from this list. Look for names, phone numbers, emails, and any role/company information.`
      },
      'crew_list': {
        system: `You are an expert at extracting crew information from production crew lists.`,
        user: `Extract all crew members with their roles, names, and contact information.`
      },
      'talent_sheet': {
        system: `You are an expert at extracting talent information including models, actors, and their representation.`,
        user: `Extract all talent with their names, agencies, and contact information.`
      }
    };

    // Confidence thresholds
    this.thresholds = {
      highConfidence: 0.8,    // Use simple extraction only
      mediumConfidence: 0.6,  // Use simple + AI validation
      lowConfidence: 0.4,     // Use AI enhancement
      veryLowConfidence: 0.2  // Use AI only
    };
  }

  /**
   * Main adaptive extraction method
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = `adaptive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('🧠 Starting adaptive extraction', {
        extractionId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length
      });

      // Step 1: Extract text using core extractor
      const text = await this.extractText(fileBuffer, mimeType);
      
      if (!text || text.trim().length < 10) {
        throw new Error('Insufficient text content for extraction');
      }

      // Step 2: Analyze document structure and type
      const documentAnalysis = await this.analyzeDocument(text, fileName);
      logger.info('📊 Document analysis', {
        extractionId,
        type: documentAnalysis.type,
        confidence: documentAnalysis.confidence,
        complexity: documentAnalysis.complexity,
        estimatedContacts: documentAnalysis.estimatedContacts,
        textLength: text.length
      });

      // If very little text was extracted, this might be a scanned PDF or image
      if (text.length < 100) {
        logger.warn('⚠️ Very little text extracted from PDF', {
          extractionId,
          textLength: text.length,
          textPreview: text.substring(0, 50)
        });
      }

      // Step 3: Select extraction strategy based on analysis
      const strategy = this.selectStrategy(documentAnalysis, options);
      logger.info('🎯 Selected strategy', {
        extractionId,
        strategy: strategy.name,
        reason: strategy.reason
      });

      // Step 4: Execute extraction strategy
      const result = await this.executeStrategy(strategy, text, options, extractionId);

      // Step 5: Post-process and validate results
      const finalResult = await this.postProcessResults(result, documentAnalysis, options);

      const processingTime = Date.now() - startTime;
      logger.info('✅ Adaptive extraction completed', {
        extractionId,
        contactsFound: finalResult.contacts.length,
        strategy: strategy.name,
        processingTime: `${processingTime}ms`,
        confidence: finalResult.confidence
      });

      return {
        success: true,
        contacts: finalResult.contacts,
        metadata: {
          extractionId,
          strategy: strategy.name,
          documentType: documentAnalysis.type,
          confidence: finalResult.confidence,
          processingTime,
          textLength: text.length,
          patternsUsed: result.patternsUsed || []
        }
      };

    } catch (error) {
      logger.error('❌ Adaptive extraction failed', {
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
          strategy: 'adaptive'
        }
      };
    }
  }

  /**
   * Analyze document to determine type and complexity
   */
  async analyzeDocument(text, fileName) {
    const analysis = {
      type: 'unknown',
      confidence: 0.5,
      complexity: 'medium',
      estimatedContacts: 0,
      sections: [],
      keyPatterns: []
    };

    // Analyze text content
    const textLower = text.toLowerCase();
    
    // Check for document type indicators
    for (const [type, config] of Object.entries(this.documentTypes)) {
      const matches = config.keywords.filter(keyword => 
        textLower.includes(keyword.toLowerCase())
      ).length;
      
      const confidence = matches / config.keywords.length;
      if (confidence > analysis.confidence) {
        analysis.type = type;
        analysis.confidence = confidence;
        analysis.keyPatterns = config.patterns;
      }
    }

    // Estimate complexity and contact count
    analysis.estimatedContacts = this.estimateContactCount(text);
    analysis.complexity = this.assessComplexity(text, analysis.estimatedContacts);
    
    // Identify sections
    analysis.sections = this.identifySections(text);

    return analysis;
  }

  /**
   * Select the best extraction strategy
   */
  selectStrategy(documentAnalysis, options) {
    const { type, confidence, complexity, estimatedContacts } = documentAnalysis;
    
    // High confidence + simple document = simple extraction only
    if (confidence >= this.thresholds.highConfidence && complexity === 'low') {
      return {
        name: 'simple_only',
        reason: 'High confidence document type with low complexity',
        useSimple: true,
        useAI: false,
        patterns: documentAnalysis.keyPatterns
      };
    }

    // Medium confidence = simple + AI validation
    if (confidence >= this.thresholds.mediumConfidence) {
      return {
        name: 'simple_with_ai_validation',
        reason: 'Medium confidence, using simple extraction with AI validation',
        useSimple: true,
        useAI: true,
        aiMode: 'validation',
        patterns: documentAnalysis.keyPatterns
      };
    }

    // Low confidence = AI enhancement
    if (confidence >= this.thresholds.lowConfidence) {
      return {
        name: 'ai_enhanced',
        reason: 'Low confidence, using AI to enhance simple extraction',
        useSimple: true,
        useAI: true,
        aiMode: 'enhancement',
        patterns: documentAnalysis.keyPatterns
      };
    }

    // Very low confidence = AI only
    return {
      name: 'ai_only',
      reason: 'Very low confidence, using AI extraction only',
      useSimple: false,
      useAI: true,
      aiMode: 'primary',
      patterns: []
    };
  }

  /**
   * Execute the selected strategy
   */
  async executeStrategy(strategy, text, options, extractionId) {
    let simpleContacts = [];
    let aiContacts = [];
    let patternsUsed = [];

    // Execute simple extraction if needed
    if (strategy.useSimple) {
      try {
        const simpleResult = await this.simpleService.extractContactsFromText(text, {
          ...options,
          maxContacts: 1000,
          maxProcessingTime: 15000
        });
        simpleContacts = simpleResult || [];
        patternsUsed = ['simple_patterns'];
        
        logger.info('📊 Simple extraction results', {
          extractionId,
          contactsFound: simpleContacts.length
        });
      } catch (error) {
        logger.warn('⚠️ Simple extraction failed', {
          extractionId,
          error: error.message
        });
      }
    }

    // Execute AI extraction if needed
    if (strategy.useAI) {
      try {
        const aiPrompt = this.getAIPrompt(strategy, text, simpleContacts);
        // Use the correct method name from AI service
        const aiResult = await this.aiService.extractContacts(null, 'text/plain', 'extracted_text.txt', {
          ...options,
          prompt: aiPrompt,
          mode: strategy.aiMode,
          extractedText: text
        });
        aiContacts = aiResult?.contacts || [];
        
        logger.info('🤖 AI extraction results', {
          extractionId,
          contactsFound: aiContacts.length,
          mode: strategy.aiMode
        });
      } catch (error) {
        logger.warn('⚠️ AI extraction failed', {
          extractionId,
          error: error.message
        });
      }
    }

    // Combine results based on strategy
    return this.combineResults(simpleContacts, aiContacts, strategy);
  }

  /**
   * Get appropriate AI prompt based on strategy and document type
   */
  getAIPrompt(strategy, text, simpleContacts) {
    const documentType = this.analyzeDocument(text).type;
    const basePrompt = this.aiPrompts[documentType] || this.aiPrompts['call_sheet'];

    if (strategy.aiMode === 'validation') {
      return {
        system: basePrompt.system + '\n\nValidate and enhance the following contacts:',
        user: `${basePrompt.user}\n\nCurrent contacts found: ${JSON.stringify(simpleContacts, null, 2)}\n\nPlease validate, correct, and add any missing contacts.`
      };
    }

    if (strategy.aiMode === 'enhancement') {
      return {
        system: basePrompt.system + '\n\nEnhance the following extraction results:',
        user: `${basePrompt.user}\n\nInitial contacts found: ${JSON.stringify(simpleContacts, null, 2)}\n\nPlease enhance and add any missing contacts.`
      };
    }

    return basePrompt;
  }

  /**
   * Combine simple and AI results intelligently
   */
  combineResults(simpleContacts, aiContacts, strategy) {
    if (strategy.name === 'simple_only') {
      return { contacts: simpleContacts, confidence: 0.9 };
    }

    if (strategy.name === 'ai_only') {
      return { contacts: aiContacts, confidence: 0.8 };
    }

    // Merge and deduplicate contacts
    const mergedContacts = this.mergeContacts(simpleContacts, aiContacts);
    const confidence = this.calculateConfidence(simpleContacts, aiContacts, mergedContacts);

    return { contacts: mergedContacts, confidence };
  }

  /**
   * Merge contacts from different sources, removing duplicates
   */
  mergeContacts(simpleContacts, aiContacts) {
    const contactMap = new Map();
    
    // Add simple contacts first
    simpleContacts.forEach(contact => {
      const key = this.getContactKey(contact);
      contactMap.set(key, { ...contact, source: 'simple' });
    });

    // Add AI contacts, preferring them for conflicts
    aiContacts.forEach(contact => {
      const key = this.getContactKey(contact);
      const existing = contactMap.get(key);
      
      if (!existing) {
        contactMap.set(key, { ...contact, source: 'ai' });
      } else {
        // Merge information, preferring AI for quality
        contactMap.set(key, {
          ...existing,
          ...contact,
          source: 'hybrid',
          merged: true
        });
      }
    });

    return Array.from(contactMap.values());
  }

  /**
   * Generate unique key for contact deduplication
   */
  getContactKey(contact) {
    const name = (contact.name || '').toLowerCase().trim();
    const phone = (contact.phone || '').replace(/\D/g, '');
    const email = (contact.email || '').toLowerCase().trim();
    
    return `${name}_${phone}_${email}`;
  }

  /**
   * Calculate confidence score for merged results
   */
  calculateConfidence(simpleContacts, aiContacts, mergedContacts) {
    const simpleCount = simpleContacts.length;
    const aiCount = aiContacts.length;
    const mergedCount = mergedContacts.length;
    
    if (mergedCount === 0) return 0;
    
    // Base confidence on overlap and total count
    const overlap = Math.min(simpleCount, aiCount) / Math.max(simpleCount, aiCount, 1);
    const countScore = Math.min(mergedCount / 20, 1); // Cap at 20 contacts
    
    return (overlap * 0.6 + countScore * 0.4);
  }

  /**
   * Post-process results for quality and consistency
   */
  async postProcessResults(result, documentAnalysis, options) {
    let contacts = result.contacts || [];
    
    // Clean and normalize contacts
    contacts = contacts.map(contact => this.normalizeContact(contact));
    
    // Remove invalid contacts
    contacts = contacts.filter(contact => this.isValidContact(contact));
    
    // Sort by confidence and role importance
    contacts = this.sortContacts(contacts);
    
    // Apply role preferences if specified
    if (options.rolePreferences && options.rolePreferences.length > 0) {
      contacts = this.filterByRolePreferences(contacts, options.rolePreferences);
    }

    return {
      contacts,
      confidence: result.confidence || 0.5
    };
  }

  /**
   * Normalize contact information
   */
  normalizeContact(contact) {
    return {
      name: this.cleanName(contact.name),
      role: this.cleanRole(contact.role),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhone(contact.phone),
      company: this.cleanCompany(contact.company),
      section: contact.section || this.inferSection(contact.role),
      source: contact.source || 'adaptive',
      confidence: contact.confidence || 0.5
    };
  }

  /**
   * Clean and normalize contact fields
   */
  cleanName(name) {
    if (!name) return '';
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .trim();
  }

  cleanRole(role) {
    if (!role) return 'Contact';
    return role.trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();
  }

  cleanEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  cleanPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      const us = digits.substring(1);
      return `(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}`;
    }
    return phone;
  }

  cleanCompany(company) {
    if (!company) return '';
    return company.trim().replace(/\s+/g, ' ');
  }

  /**
   * Infer section based on role
   */
  inferSection(role) {
    if (!role) return 'OTHER';
    
    const roleUpper = role.toUpperCase();
    
    if (roleUpper.includes('PHOTOGRAPHER') || roleUpper.includes('CAMERA')) return 'CREW';
    if (roleUpper.includes('MODEL') || roleUpper.includes('TALENT')) return 'TALENT';
    if (roleUpper.includes('PRODUCER') || roleUpper.includes('DIRECTOR')) return 'PRODUCTION';
    if (roleUpper.includes('STYLIST') || roleUpper.includes('MUA')) return 'CREW';
    if (roleUpper.includes('CLIENT') || roleUpper.includes('AGENCY')) return 'CLIENT';
    
    return 'CREW';
  }

  /**
   * Validate contact has required information
   */
  isValidContact(contact) {
    return contact.name && 
           contact.name.length > 1 && 
           (contact.phone || contact.email);
  }

  /**
   * Sort contacts by importance and confidence
   */
  sortContacts(contacts) {
    const rolePriority = {
      'PRODUCER': 1,
      'DIRECTOR': 2,
      'PHOTOGRAPHER': 3,
      'CREATIVE DIRECTOR': 4,
      'STYLIST': 5,
      'MUA': 6,
      'MODEL': 7,
      'TALENT': 8,
      'ASSISTANT': 9,
      'CONTACT': 10
    };

    return contacts.sort((a, b) => {
      const aPriority = rolePriority[a.role] || 99;
      const bPriority = rolePriority[b.role] || 99;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }

  /**
   * Filter contacts by role preferences
   */
  filterByRolePreferences(contacts, preferences) {
    const prefSet = new Set(preferences.map(p => p.toUpperCase()));
    return contacts.filter(contact => 
      prefSet.has(contact.role) || 
      preferences.some(pref => 
        contact.role.includes(pref.toUpperCase())
      )
    );
  }

  /**
   * Estimate number of contacts in document
   */
  estimateContactCount(text) {
    const phoneMatches = (text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g) || []).length;
    const emailMatches = (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || []).length;
    const nameMatches = (text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []).length;
    
    return Math.min(Math.max(phoneMatches, emailMatches, nameMatches), 100);
  }

  /**
   * Assess document complexity
   */
  assessComplexity(text, estimatedContacts) {
    const textLength = text.length;
    const lineCount = text.split('\n').length;
    const wordCount = text.split(/\s+/).length;
    
    if (textLength < 1000 && lineCount < 20 && estimatedContacts < 10) {
      return 'low';
    }
    
    if (textLength > 10000 || lineCount > 100 || estimatedContacts > 50) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Identify document sections
   */
  identifySections(text) {
    const sections = [];
    const sectionKeywords = {
      'CREW': ['crew', 'photographer', 'stylist', 'mua', 'assistant'],
      'TALENT': ['talent', 'model', 'actor', 'agency'],
      'PRODUCTION': ['producer', 'director', 'creative', 'production'],
      'CLIENT': ['client', 'brand', 'company', 'agency']
    };

    for (const [section, keywords] of Object.entries(sectionKeywords)) {
      const matches = keywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      if (matches > 0) {
        sections.push(section);
      }
    }

    return sections;
  }

  /**
   * Extract text from file using core extractor
   */
  async extractText(fileBuffer, mimeType) {
    const coreExtractor = require('./extraction.service');
    
    // Add debugging for PDF files
    if (mimeType === 'application/pdf') {
      console.log('🔍 PDF Buffer analysis:', {
        type: fileBuffer.constructor.name,
        isBuffer: fileBuffer instanceof Buffer,
        isUint8Array: fileBuffer instanceof Uint8Array,
        length: fileBuffer.length,
        hasBuffer: 'buffer' in fileBuffer,
        hasByteOffset: 'byteOffset' in fileBuffer
      });
    }
    
    return await coreExtractor.extractTextFromDocument(fileBuffer, mimeType);
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      available: true,
      simpleService: this.simpleService ? 'available' : 'unavailable',
      aiService: this.aiService ? 'available' : 'unavailable',
      documentTypes: Object.keys(this.documentTypes).length,
      strategies: ['simple_only', 'simple_with_ai_validation', 'ai_enhanced', 'ai_only']
    };
  }
}

module.exports = new AdaptiveExtractionService();
