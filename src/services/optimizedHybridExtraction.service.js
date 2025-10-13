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

      // Step 0: Normalize text to fix PDF extraction artifacts
      const normalizedText = this.normalizeExtractedText(text);
      
      logger.info('🧹 Text normalized', {
        extractionId,
        originalLength: text.length,
        normalizedLength: normalizedText.length,
        fixedSpacing: text.length !== normalizedText.length
      });

      // Step 1: Robust pattern-based extraction (comprehensive call sheet patterns)
      const patternResults = await this.robustExtractor.extractContacts(normalizedText, {
        extractionId,
        ...options
      });
      
      // Step 2: Calculate confidence and quality scores
      const confidenceScore = this.calculateConfidenceScore(patternResults);
      let finalContacts = patternResults.contacts || [];
      const qualityScore = this.calculateContactQualityScore(finalContacts);
      const qualityMetrics = this.getQualityMetrics(finalContacts);
      
      logger.info('📊 Robust pattern extraction results', {
        extractionId,
        contactsFound: finalContacts.length,
        confidenceScore: confidenceScore.toFixed(2),
        qualityScore: qualityScore.toFixed(2),
        qualityMetrics,
        patternsUsed: patternResults.metadata?.patternsUsed
      });

      let aiUsed = false;

      // Step 3: AI enhancement based on QUALITY not just quantity
      const needsAIEnhancement = this.shouldUseAI(finalContacts, confidenceScore);
      
      if (needsAIEnhancement && this.isAIAvailable) {
        const reason = qualityScore < 0.5 ? 'low_quality_contacts' : 
                       finalContacts.length < 5 ? 'few_contacts' : 
                       qualityScore < 0.6 ? 'incomplete_data' : 'low_confidence';
        
        logger.info('🤖 Applying AI enhancement', { 
          extractionId,
          reason,
          qualityScore: qualityScore.toFixed(2),
          contactsWithEmail: qualityMetrics.withEmail,
          contactsWithPhone: qualityMetrics.withPhone
        });
        
        const aiResults = await this.enhanceWithAI(text, finalContacts, extractionId);
        finalContacts = this.mergeContacts(finalContacts, aiResults);
        aiUsed = true;
      } else {
        logger.info('✅ Skipping AI enhancement - quality sufficient', {
          extractionId,
          qualityScore: qualityScore.toFixed(2),
          contactCount: finalContacts.length,
          completeProfiles: qualityMetrics.completeProfiles
        });
      }

      // Step 4: Clean and validate results
      const cleanedContacts = this.cleanAndValidateContacts(finalContacts);

      const processingTime = Date.now() - startTime;
      const finalQualityMetrics = this.getQualityMetrics(cleanedContacts);
      const finalQualityScore = this.calculateContactQualityScore(cleanedContacts);

      logger.info('✅ Optimized extraction complete', {
        extractionId,
        finalContactCount: cleanedContacts.length,
        finalQualityScore: finalQualityScore.toFixed(2),
        finalQualityMetrics,
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
          qualityScore: finalQualityScore,
          qualityMetrics: finalQualityMetrics,
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
   * Normalize extracted text to fix PDF extraction artifacts
   * Fixes common issues from client-side pdf.js extraction
   */
  normalizeExtractedText(text) {
    let normalized = text;
    
    // Fix excessive spacing between letters (e.g., "p hotog ra phe r" → "photographer")
    // Match pattern: single letter + space + single letter
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])/gi, (match, l1, l2, l3) => {
      // Check if this looks like a spaced-out word
      const rest = match.split(/\s+/);
      if (rest.every(part => part.length === 1)) {
        return match.replace(/\s+/g, '');
      }
      return match;
    });
    
    // More aggressive: Fix any single letters with spaces (common in PDF OCR)
    // "a s s i s t a n t" → "assistant"
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\b/gi, '$1$2');
    
    // Fix specific known role keywords with spacing issues
    const roleKeywords = [
      'photographer', 'videographer', 'assistant', 'digitech',
      'production', 'casting', 'director', 'stylist', 'makeup',
      'model', 'driver', 'manager', 'designer', 'creative',
      'social', 'chief', 'junior'
    ];
    
    roleKeywords.forEach(keyword => {
      // Match keyword with spaces between EVERY letter
      const spacedPattern = keyword.split('').join('\\s*');
      const regex = new RegExp(spacedPattern, 'gi');
      normalized = normalized.replace(regex, keyword);
    });
    
    // Fix common name spacing issues
    // "ma r iolga" → "mariolga"
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3$4$5$6$7');
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3$4$5$6');
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3$4$5');
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3$4');
    normalized = normalized.replace(/\b([a-z])\s+([a-z])\s+([a-z])\b/gi, '$1$2$3');
    
    return normalized;
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
   * Calculate contact quality score (0-1)
   * Quality = completeness of contact data (email, phone, role, company)
   */
  calculateContactQualityScore(contacts) {
    if (!contacts || contacts.length === 0) return 0;
    
    let qualityPoints = 0;
    let maxPoints = contacts.length * 3; // 3 points per contact max
    
    contacts.forEach(contact => {
      // 1 point for having valid email
      if (contact.email && this.isValidEmail(contact.email)) {
        qualityPoints += 1;
      }
      
      // 1 point for having valid phone
      if (contact.phone && this.isValidPhone(contact.phone)) {
        qualityPoints += 1;
      }
      
      // 1 point for having company or role
      if (contact.company || contact.role) {
        qualityPoints += 1;
      }
    });
    
    return qualityPoints / maxPoints;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate phone format
   */
  isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Valid if 10+ digits
    return digits.length >= 10;
  }

  /**
   * Determine if AI enhancement is needed based on quality
   */
  shouldUseAI(contacts, confidenceScore) {
    const contactCount = contacts.length;
    const qualityScore = this.calculateContactQualityScore(contacts);
    
    // Use AI if:
    // 1. Very few contacts (< 5)
    // 2. Low quality contacts (score < 0.5) - missing email/phone
    // 3. Medium quality but incomplete (score < 0.6 and count < 20)
    // 4. Low pattern confidence
    
    const veryFewContacts = contactCount < 5;
    const lowQuality = qualityScore < 0.5;
    const mediumQualityButIncomplete = qualityScore < 0.6 && contactCount < 20;
    const lowConfidence = confidenceScore < 0.6;
    
    return veryFewContacts || lowQuality || mediumQualityButIncomplete || lowConfidence;
  }

  /**
   * Get detailed quality metrics
   */
  getQualityMetrics(contacts) {
    if (!contacts || contacts.length === 0) {
      return {
        total: 0,
        withEmail: 0,
        withPhone: 0,
        withBoth: 0,
        withCompany: 0,
        withRole: 0,
        completeProfiles: 0
      };
    }

    return {
      total: contacts.length,
      withEmail: contacts.filter(c => c.email && this.isValidEmail(c.email)).length,
      withPhone: contacts.filter(c => c.phone && this.isValidPhone(c.phone)).length,
      withBoth: contacts.filter(c => 
        c.email && this.isValidEmail(c.email) && 
        c.phone && this.isValidPhone(c.phone)
      ).length,
      withCompany: contacts.filter(c => c.company).length,
      withRole: contacts.filter(c => c.role).length,
      completeProfiles: contacts.filter(c => 
        c.email && this.isValidEmail(c.email) &&
        c.phone && this.isValidPhone(c.phone) &&
        (c.company || c.role)
      ).length
    };
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
      .map(contact => this.cleanContact(contact))
      .filter(contact => contact !== null && this.isValidContact(contact))
      .map(contact => ({
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contact.name || 'Unknown',
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
   * Clean individual contact fields
   */
  cleanContact(contact) {
    if (!contact || typeof contact !== 'object') {
      return null;
    }

    const cleaned = {
      ...contact,
      name: this.cleanName(contact.name),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhoneNumber(contact.phone),  // ⭐ FIX: Use existing method name
      role: this.cleanRole(contact.role),
      company: this.cleanCompany(contact.company)
    };

    return cleaned;
  }

  /**
   * Clean name field
   */
  cleanName(name) {
    if (!name || typeof name !== 'string') return '';
    
    let cleaned = name.trim();
    
    // Remove excessive spacing (like "Ma r iolga" -> "Mariolga")
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove role prefixes if duplicated
    const roleWords = ['Producer', 'Photographer', 'Director', 'Assistant', 'Makeup', 'Stylist', 'MUA', 'HMUA', 'HUA'];
    roleWords.forEach(role => {
      const regex = new RegExp(`^${role}\\s*:\\s*`, 'i');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Remove common non-name artifacts
    cleaned = cleaned.replace(/^(com|gmail\.com|page|line)\s+/i, '');
    
    // Title case
    if (cleaned.length > 0 && cleaned.length < 80) {
      cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return cleaned.trim();
  }

  /**
   * Clean email field with STRICT validation
   */
  cleanEmail(email) {
    if (!email || typeof email !== 'string') return '';
    
    const cleaned = email.trim().toLowerCase();
    
    // STRICT: Email must be < 100 characters (prevents text dumps)
    if (cleaned.length > 100) {
      logger.warn('⚠️ Rejected email (too long):', cleaned.substring(0, 50) + '...');
      return '';
    }
    
    // STRICT: Basic email validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(cleaned)) {
      // Not a valid email format
      return '';
    }
    
    return cleaned;
  }

  /**
   * Clean role field
   */
  cleanRole(role) {
    if (!role || typeof role !== 'string') return '';
    
    let cleaned = role.trim().toUpperCase();
    
    // STRICT: Reject roles that look like addresses or other non-role text
    if (cleaned.length > 100) {
      logger.warn('⚠️ Rejected role (too long):', cleaned.substring(0, 50) + '...');
      return '';
    }
    
    // Reject if it contains address-like patterns
    if (cleaned.includes('STREET') || cleaned.includes('AVENUE') || cleaned.includes('AVE,') || 
        cleaned.includes('BROOKLYN') || cleaned.includes('NY ') || /\d{5}/.test(cleaned)) {
      logger.warn('⚠️ Rejected role (looks like address):', cleaned.substring(0, 50));
      return '';
    }
    
    // Normalize common variations
    cleaned = cleaned
      .replace(/MAKE UP ARTIST/g, 'MUA')
      .replace(/MAKEUP ARTIST/g, 'MUA')
      .replace(/HAIR MAKEUP/g, 'HMUA')
      .replace(/PHOTO GRAPHER/g, 'PHOTOGRAPHER');
    
    return cleaned;
  }

  /**
   * Clean company field
   */
  cleanCompany(company) {
    if (!company || typeof company !== 'string') return '';
    
    return company.trim()
      .replace(/\s+/g, ' ')
      .substring(0, 100) // Limit length
      .trim();
  }

  /**
   * Validate contact data with STRICT rules
   */
  isValidContact(contact) {
    if (!contact || typeof contact !== 'object') {
      return false;
    }

    // Must have a name
    const name = contact.name || '';
    if (name.length < 2) {
      return false;
    }

    // Reject single-word names unless they have strong contact info
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length === 1 && nameParts[0].length < 4) {
      // Single short name (like "Tray") - only accept if has valid email or phone
      const hasValidEmail = contact.email && contact.email.includes('@');
      const hasValidPhone = contact.phone && contact.phone.length >= 10;
      
      if (!hasValidEmail && !hasValidPhone) {
        logger.warn('⚠️ Rejected single-word name without contact info:', name);
        return false;
      }
    }

    // STRICT: Reject if email looks invalid (common for garbage extraction)
    if (contact.email && contact.email.length > 0) {
      // If email doesn't contain @, it's not an email
      if (!contact.email.includes('@')) {
        logger.warn('⚠️ Rejected contact with invalid email:', {
          name: contact.name,
          email: contact.email.substring(0, 50)
        });
        return false;
      }
    }

    // STRICT: Reject if role looks like an address or long text
    if (contact.role && contact.role.length > 80) {
      logger.warn('⚠️ Rejected contact with suspicious role:', {
        name: contact.name,
        role: contact.role.substring(0, 50)
      });
      return false;
    }

    // Must have at least email OR phone
    const hasEmail = contact.email && contact.email.length > 0;
    const hasPhone = contact.phone && contact.phone.length > 0;
    
    if (!hasEmail && !hasPhone) {
      return false;
    }

    return true;
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