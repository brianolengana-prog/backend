/**
 * Context-Aware AI Extraction Service
 * 
 * Uses OpenAI with document analysis and pattern learning to provide
 * highly accurate, context-aware contact extraction
 */

const openai = require('openai');
const winston = require('winston');
const documentAnalysisService = require('./documentAnalysis.service');
const adaptivePatternService = require('./adaptivePattern.service');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/context-aware-ai.log' })
  ]
});

class ContextAwareAIService {
  constructor() {
    this.client = new openai({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.extractionHistory = [];
    this.contextLearning = new Map();
    
    logger.info('🧠 Context-Aware AI Service initialized');
  }

  /**
   * Extract contacts with full context awareness
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    try {
      // Step 1: Extract text from document
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType);
      
      if (!extractedText || extractedText.length < 50) {
        return {
          success: false,
          error: 'Document text extraction failed or document too short',
          contacts: []
        };
      }

      // Step 2: Analyze document structure
      const documentAnalysis = await documentAnalysisService.analyzeDocument(
        extractedText, 
        fileName, 
        mimeType
      );

      // Step 3: Generate adaptive patterns
      const adaptivePatterns = await adaptivePatternService.generatePatterns(
        documentAnalysis, 
        extractedText
      );

      // Step 4: Extract contacts using context-aware AI
      const contacts = await this.extractContactsWithContext(
        extractedText,
        documentAnalysis,
        adaptivePatterns,
        options
      );

      // Step 5: Validate and enhance contacts
      const validatedContacts = await this.validateAndEnhanceContacts(
        contacts,
        documentAnalysis,
        options
      );

      // Step 6: Learn from this extraction
      await this.learnFromExtraction(documentAnalysis, validatedContacts, fileName);

      logger.info('✅ Context-aware extraction completed', {
        fileName,
        contactsFound: validatedContacts.length,
        confidence: documentAnalysis.confidence
      });

      return {
        success: true,
        contacts: validatedContacts,
        metadata: {
          extractionMethod: 'context_aware_ai',
          documentAnalysis,
          patternsUsed: adaptivePatterns.length,
          confidence: documentAnalysis.confidence,
          processingTime: Date.now()
        }
      };

    } catch (error) {
      logger.error('❌ Context-aware extraction failed', { 
        error: error.message, 
        fileName,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Extract text from document
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    // Use existing extraction service for text extraction
    const extractionService = require('./extraction.service');
    return await extractionService.extractTextFromDocument(fileBuffer, mimeType);
  }

  /**
   * Extract contacts using context-aware AI
   */
  async extractContactsWithContext(text, documentAnalysis, adaptivePatterns, options) {
    const prompt = this.buildContextAwarePrompt(text, documentAnalysis, adaptivePatterns, options);
    
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.buildSystemPrompt(documentAnalysis)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.contacts || [];

    } catch (error) {
      logger.error('❌ AI extraction failed', { error: error.message });
      
      // Fallback to pattern-based extraction
      return await this.fallbackPatternExtraction(text, adaptivePatterns);
    }
  }

  /**
   * Build context-aware prompt
   */
  buildContextAwarePrompt(text, documentAnalysis, adaptivePatterns, options) {
    let prompt = `Extract contact information from this production document with high accuracy.

DOCUMENT ANALYSIS:
- Structure: ${documentAnalysis.documentStructure}
- Format: ${documentAnalysis.format}
- Has Roles: ${documentAnalysis.hasRoles}
- Has Companies: ${documentAnalysis.hasCompanies}
- Has Emails: ${documentAnalysis.hasEmails}
- Has Phones: ${documentAnalysis.hasPhones}
- Confidence: ${documentAnalysis.confidence}

DETECTED PATTERNS:
${adaptivePatterns.map(p => `- ${p.name}: ${p.examples.join(', ')}`).join('\n')}

EXTRACTION HINTS:
${documentAnalysis.extractionHints?.join('\n') || 'None'}

DOCUMENT TEXT:
${text.substring(0, 3000)}${text.length > 3000 ? '\n... (truncated)' : ''}

INSTRUCTIONS:
1. Extract ALL contact information from the document
2. Use the detected patterns as guidance
3. Pay attention to roles, companies, and relationships
4. For each contact, extract: name, role, phone, email, company (if available)
5. Handle multiple contacts per line (e.g., model + agent)
6. Validate phone numbers and email addresses
7. Return ONLY a JSON array of contacts

CONTACT FORMAT:
{
  "name": "Full Name",
  "role": "Job Title/Role",
  "phone": "Phone Number",
  "email": "Email Address",
  "company": "Company/Agency",
  "confidence": 0.0-1.0
}

Return ONLY valid JSON array, no other text.`;

    return prompt;
  }

  /**
   * Build system prompt based on document analysis
   */
  buildSystemPrompt(documentAnalysis) {
    let systemPrompt = "You are an expert at extracting contact information from production documents. ";
    
    if (documentAnalysis.documentStructure === 'call_sheet') {
      systemPrompt += "This is a call sheet - focus on crew, cast, and production contacts. ";
    } else if (documentAnalysis.documentStructure === 'crew_list') {
      systemPrompt += "This is a crew list - focus on production team members and their roles. ";
    } else if (documentAnalysis.documentStructure === 'contact_list') {
      systemPrompt += "This is a contact list - extract all available contact information. ";
    }
    
    if (documentAnalysis.hasRoles) {
      systemPrompt += "Roles are explicitly mentioned - use them to categorize contacts. ";
    }
    
    if (documentAnalysis.hasCompanies) {
      systemPrompt += "Companies/agencies are mentioned - include them in the company field. ";
    }
    
    systemPrompt += "Always return valid JSON array of contacts with the specified format.";
    
    return systemPrompt;
  }

  /**
   * Fallback to pattern-based extraction
   */
  async fallbackPatternExtraction(text, adaptivePatterns) {
    const contacts = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      for (const pattern of adaptivePatterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const contact = this.extractContactFromMatch(match, pattern);
          if (contact) {
            contacts.push(contact);
          }
        }
      }
    }
    
    return contacts;
  }

  /**
   * Extract contact from regex match
   */
  extractContactFromMatch(match, pattern) {
    // This would need to be implemented based on the pattern structure
    // For now, return a basic contact structure
    return {
      name: match[1] || '',
      role: match[2] || '',
      phone: match[3] || '',
      email: match[4] || '',
      company: match[5] || '',
      confidence: pattern.confidence || 0.5
    };
  }

  /**
   * Validate and enhance contacts
   */
  async validateAndEnhanceContacts(contacts, documentAnalysis, options) {
    const validatedContacts = [];
    
    for (const contact of contacts) {
      // Validate contact data
      if (this.isValidContact(contact)) {
        // Enhance with additional context
        const enhancedContact = await this.enhanceContact(contact, documentAnalysis);
        validatedContacts.push(enhancedContact);
      }
    }
    
    // Remove duplicates
    return this.removeDuplicateContacts(validatedContacts);
  }

  /**
   * Check if contact is valid
   */
  isValidContact(contact) {
    return contact && (
      contact.name?.trim() ||
      contact.email?.trim() ||
      contact.phone?.trim()
    );
  }

  /**
   * Enhance contact with additional context
   */
  async enhanceContact(contact, documentAnalysis) {
    const enhanced = { ...contact };
    
    // Add confidence based on available data
    let confidence = 0.5;
    if (enhanced.name) confidence += 0.2;
    if (enhanced.email) confidence += 0.2;
    if (enhanced.phone) confidence += 0.1;
    if (enhanced.role) confidence += 0.1;
    
    enhanced.confidence = Math.min(confidence, 1.0);
    
    // Add context clues
    enhanced.context = {
      documentStructure: documentAnalysis.documentStructure,
      hasRole: !!enhanced.role,
      hasCompany: !!enhanced.company,
      hasEmail: !!enhanced.email,
      hasPhone: !!enhanced.phone
    };
    
    return enhanced;
  }

  /**
   * Remove duplicate contacts
   */
  removeDuplicateContacts(contacts) {
    const seen = new Set();
    return contacts.filter(contact => {
      const key = `${contact.name}_${contact.phone}_${contact.email}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Learn from extraction
   */
  async learnFromExtraction(documentAnalysis, contacts, fileName) {
    const learningEntry = {
      fileName,
      documentAnalysis,
      contacts,
      timestamp: Date.now(),
      successRate: contacts.length > 0 ? 1 : 0
    };
    
    this.extractionHistory.push(learningEntry);
    
    // Keep only last 1000 entries
    if (this.extractionHistory.length > 1000) {
      this.extractionHistory = this.extractionHistory.slice(-1000);
    }
    
    // Update pattern performance
    for (const contact of contacts) {
      if (contact.patternId) {
        adaptivePatternService.updatePatternPerformance(contact.patternId, true);
      }
    }
    
    logger.info('🧠 Learning from extraction', {
      fileName,
      contactsFound: contacts.length,
      successRate: learningEntry.successRate
    });
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      available: !!this.client,
      extractionHistory: this.extractionHistory.length,
      contextLearning: this.contextLearning.size,
      lastExtraction: this.extractionHistory.length > 0 ? 'available' : 'none'
    };
  }
}

module.exports = new ContextAwareAIService();
