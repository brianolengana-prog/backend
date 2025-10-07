/**
 * Optimized Hybrid Extraction Service
 * 
 * Implements the optimized AI + Pattern hybrid strategy:
 * 1. Run patterns first to extract high-confidence contacts
 * 2. Use AI only for gap-filling and enhancement
 * 3. Optimized token usage with gpt-4o-mini
 * 4. Context-aware prompting
 * 5. Intelligent fallback strategies
 */

const { OpenAI } = require('openai');
const RobustCallSheetExtractor = require('./robustCallSheetExtractor.service');
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

class OptimizedHybridExtractionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isAIAvailable = !!process.env.OPENAI_API_KEY;
    
    // Use robust call sheet extractor for pattern matching
    this.robustExtractor = new RobustCallSheetExtractor();
    this.confidenceThreshold = 0.7; // Only use AI if patterns find < 70% confidence
  }


  /**
   * Main extraction method - optimized hybrid approach
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `opt_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('🚀 Starting optimized hybrid extraction', {
        extractionId,
        textLength: text.length
      });

      // Step 1: Robust pattern-based extraction (comprehensive call sheet patterns)
      const patternResults = await this.robustExtractor.extractContacts(text, {
        extractionId,
        ...options
      });
      
      // Step 2: Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(patternResults);
      
      logger.info('📊 Robust pattern extraction results', {
        extractionId,
        contactsFound: patternResults.contacts?.length || 0,
        confidenceScore,
        needsAI: confidenceScore < this.confidenceThreshold,
        patternsUsed: patternResults.metadata?.patternsUsed
      });

      let finalContacts = patternResults.contacts || [];
      let aiUsed = false;

      // Step 3: AI enhancement only if needed and patterns found few contacts
      if ((confidenceScore < this.confidenceThreshold || finalContacts.length < 3) && this.isAIAvailable) {
        logger.info('🤖 Applying AI enhancement', { 
          extractionId,
          reason: confidenceScore < this.confidenceThreshold ? 'low_confidence' : 'few_contacts'
        });
        
        const aiResults = await this.enhanceWithAI(text, finalContacts, extractionId);
        finalContacts = this.mergeContacts(finalContacts, aiResults);
        aiUsed = true;
      }

      // Step 4: Clean and validate results
      const cleanedContacts = this.cleanAndValidateContacts(finalContacts);

      const processingTime = Date.now() - startTime;

      logger.info('✅ Optimized extraction complete', {
        extractionId,
        finalContactCount: cleanedContacts.length,
        aiUsed,
        processingTime
      });

      return {
        success: true,
        contacts: cleanedContacts,
        metadata: {
          extractionId,
          strategy: aiUsed ? 'hybrid' : 'pattern-only',
          confidenceScore,
          processingTime,
          textLength: text.length
        },
        processingTime,
        extractorsUsed: aiUsed ? ['patterns', 'gpt-4o-mini'] : ['patterns']
      };

    } catch (error) {
      logger.error('❌ Optimized extraction failed', {
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
   * Calculate confidence score based on pattern results
   */
  calculateConfidenceScore(patternResults) {
    if (patternResults.contacts.length === 0) {
      return 0;
    }

    const totalConfidence = patternResults.contacts.reduce((sum, contact) => {
      return sum + (contact.confidence || 0.5);
    }, 0);

    return totalConfidence / patternResults.contacts.length;
  }

  /**
   * Enhance results with AI (only when needed)
   */
  async enhanceWithAI(text, existingContacts, extractionId) {
    try {
      // Create context-aware prompt
      const prompt = this.buildOptimizedAIPrompt(text, existingContacts);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert contact extraction assistant. Return ONLY valid JSON in the specified format. Do not include markdown formatting or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000 // Optimized for gpt-4o-mini
      });

      const aiResult = JSON.parse(response.choices[0].message.content);
      
      logger.info('🤖 AI enhancement complete', {
        extractionId,
        contactsFound: aiResult.contacts?.length || 0
      });

      return aiResult.contacts || [];

    } catch (error) {
      logger.error('❌ AI enhancement failed', {
        extractionId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Build optimized AI prompt with context
   */
  buildOptimizedAIPrompt(text, existingContacts) {
    const existingNames = existingContacts.map(c => c.name || c.role).filter(Boolean);
    
    return `Extract contact information from this production call sheet. Focus on finding contacts NOT already identified.

EXISTING CONTACTS FOUND: ${existingNames.join(', ')}

DOCUMENT TEXT:
${text.substring(0, 8000)} // Limit text to optimize tokens

Return JSON format:
{
  "contacts": [
    {
      "name": "Contact Name",
      "role": "Role/Department", 
      "email": "email@example.com",
      "phone": "phone number"
    }
  ]
}

Focus on:
- Names not in existing list
- Complete contact info (name + phone/email)
- Production crew, talent, vendors
- Valid email addresses and phone numbers

Return empty array if no new contacts found.`;
  }

  /**
   * Merge pattern and AI results
   */
  mergeContacts(patternContacts, aiContacts) {
    const merged = [...patternContacts];
    
    for (const aiContact of aiContacts) {
      // Check if this contact already exists
      const exists = merged.some(existing => 
        this.areContactsSimilar(existing, aiContact)
      );
      
      if (!exists && this.isValidContact(aiContact)) {
        merged.push({
          ...aiContact,
          source: 'ai',
          confidence: 0.7
        });
      }
    }
    
    return merged;
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
   * Remove duplicate contacts
   */
  removeDuplicateContacts(contacts) {
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
   * Clean and validate contacts
   */
  cleanAndValidateContacts(contacts) {
    return contacts
      .filter(contact => this.isValidContact(contact))
      .map(contact => ({
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contact.name || contact.role || 'Unknown',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        department: contact.department || '',
        notes: contact.notes || '',
        source: contact.source || 'unknown',
        confidence: contact.confidence || 0.5
      }));
  }

  /**
   * Validate contact data
   */
  isValidContact(contact) {
    if (!contact) return false;
    
    const hasName = !!(contact.name || contact.role);
    const hasContact = !!(contact.email || contact.phone);
    
    return hasName && hasContact;
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
}

module.exports = OptimizedHybridExtractionService;