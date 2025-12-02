/**
 * Unified Extraction Service
 * 
 * Single, optimized extraction service that:
 * - Uses GPT-4o Mini efficiently
 * - Handles rate limits properly
 * - Optimizes token usage
 * - Provides consistent, accurate results
 * 
 * Designed around GPT-4o Mini limitations:
 * - 128k context window
 * - 3 RPM rate limit
 * - 60k TPM token limit
 * - Cost optimization
 */

const { OpenAI } = require('openai');
const winston = require('winston');
const RobustCallSheetExtractor = require('./robustCallSheetExtractor.service');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

class UnifiedExtractionService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.isAvailable = !!process.env.OPENAI_API_KEY;
    
    // Initialize pattern extractor for fast path and validation
    this.patternExtractor = new RobustCallSheetExtractor();
    
    // GPT-4o Mini limits
    this.limits = {
      contextWindow: 128000,        // 128k tokens
      maxInputTokens: 120000,       // Leave buffer for response
      maxOutputTokens: 4000,        // 4k output tokens (enough for 50-100 contacts)
      requestsPerMinute: 3,         // 3 RPM = 20s between requests
      tokensPerMinute: 60000,       // 60k TPM
      costPerInputToken: 0.00015 / 1000,  // $0.00015 per 1k tokens
      costPerOutputToken: 0.0006 / 1000   // $0.0006 per 1k tokens
    };
    
    // Rate limiting state
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.tokensUsedThisMinute = 0;
    this.minuteStartTime = Date.now();
    this.isProcessing = false;
    
    // Optimized system prompt (minimal tokens)
    this.systemPrompt = this.buildSystemPrompt();
    
    if (!this.isAvailable) {
      logger.warn('⚠️ OpenAI API key not found - AI extraction disabled');
    } else {
      logger.info('✅ Unified Extraction Service initialized', {
        contextWindow: `${this.limits.contextWindow.toLocaleString()} tokens`,
        rateLimit: `${this.limits.requestsPerMinute} RPM, ${this.limits.tokensPerMinute.toLocaleString()} TPM`
      });
    }
  }

  /**
   * Main extraction method - AI-First with Pattern Integration
   * 
   * Architecture:
   * 1. Quick Pattern Pre-Check (fast path for tabular data)
   * 2. AI Extraction (primary method - handles all formats)
   * 3. Pattern Validation (sanity check, catch obvious errors)
   * 4. Quality Scoring & Confidence Assessment
   */
  async extractContacts(text, options = {}) {
    if (!this.isAvailable) {
      throw new Error('OpenAI API key not configured');
    }

    const extractionId = options.extractionId || `extract_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('🚀 Starting AI-first unified extraction', {
        extractionId,
        textLength: text.length,
        estimatedTokens: this.estimateTokens(text)
      });

      // Step 1: Preprocess text
      const preprocessedText = this.preprocessText(text);
      
      // Step 2: Quick pattern pre-check (fast path for tabular/well-structured data)
      const patternCheck = await this.quickPatternCheck(preprocessedText, options);
      
      if (patternCheck.canUse && patternCheck.confidence > 0.9) {
        logger.info('⚡ Using fast path: Pattern-based extraction', {
          extractionId,
          confidence: patternCheck.confidence,
          contactsFound: patternCheck.contacts.length
        });
        
        // Still validate with AI (lightweight check)
        const validated = await this.validateWithAI(patternCheck.contacts, preprocessedText, options);
        
        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          contacts: validated.contacts,
          metadata: {
            extractionId,
            strategy: 'pattern-fast-path',
            processingTime,
            confidence: validated.confidence,
            patternMatches: patternCheck.contacts.length,
            aiValidated: true
          }
        };
      }
      
      // Step 3: AI extraction (primary method)
      logger.info('🤖 Using AI extraction (primary method)', { extractionId });
      
      const strategy = this.chooseStrategy(preprocessedText);
      let aiContacts = [];
      
      if (strategy.name === 'single-pass') {
        aiContacts = await this.extractSinglePass(preprocessedText, options);
      } else if (strategy.name === 'chunked') {
        aiContacts = await this.extractChunked(preprocessedText, options);
      } else {
        throw new Error(`Unknown strategy: ${strategy.name}`);
      }

      // Step 4: Pattern validation (sanity check)
      const validation = await this.validateWithPatterns(aiContacts, preprocessedText, options);
      
      // Step 5: Quality scoring
      const scored = this.scoreContacts(validation.contacts, preprocessedText, validation);
      
      // Step 6: Post-process
      const processedContacts = this.postProcessContacts(scored.contacts);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('✅ AI-first extraction complete', {
        extractionId,
        contactsFound: processedContacts.length,
        processingTime: `${processingTime}ms`,
        strategy: strategy.name,
        qualityScore: scored.qualityScore,
        confidence: scored.confidence
      });

      return {
        success: true,
        contacts: processedContacts,
        metadata: {
          extractionId,
          strategy: `ai-${strategy.name}`,
          processingTime,
          tokensUsed: this.estimateTokens(preprocessedText) + this.estimateTokens(JSON.stringify(aiContacts)),
          qualityScore: scored.qualityScore,
          confidence: scored.confidence,
          patternValidation: {
            matches: validation.matches,
            discrepancies: validation.discrepancies
          }
        }
      };

    } catch (error) {
      logger.error('❌ Extraction failed', {
        extractionId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Preprocess text to optimize for extraction
   */
  preprocessText(text) {
    // Normalize whitespace
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove excessive blank lines
    processed = processed.replace(/\n{3,}/g, '\n\n');
    
    // Remove common headers/footers (optional - can be configurable)
    // processed = processed.replace(/^.*(CONFIDENTIALITY|This call sheet).*$/gmi, '');
    
    return processed.trim();
  }

  /**
   * Choose extraction strategy based on document size
   */
  chooseStrategy(text) {
    const estimatedTokens = this.estimateTokens(text);
    
    // Single-pass for documents < 100k tokens (most call sheets)
    if (estimatedTokens < 100000) {
      return {
        name: 'single-pass',
        reason: `Document size (${estimatedTokens.toLocaleString()} tokens) fits in single request`
      };
    }
    
    // Chunked for large documents
    return {
      name: 'chunked',
      reason: `Document size (${estimatedTokens.toLocaleString()} tokens) requires chunking`
    };
  }

  /**
   * Single-pass extraction (preferred for most documents)
   */
  async extractSinglePass(text, options = {}) {
    const prompt = this.buildExtractionPrompt(text, options);
    
    const response = await this.makeAPICall(prompt);
    
    return this.parseResponse(response);
  }

  /**
   * Chunked extraction for large documents
   */
  async extractChunked(text, options = {}) {
    // Chunk by sections (preserve context)
    const chunks = this.chunkBySections(text);
    
    const allContacts = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPrompt = this.buildExtractionPrompt(chunk.text, {
        ...options,
        chunkNumber: i + 1,
        totalChunks: chunks.length,
        previousContext: i > 0 ? chunks[i - 1].section : null
      });
      
      const response = await this.makeAPICall(chunkPrompt);
      const contacts = this.parseResponse(response);
      
      allContacts.push(...contacts);
      
      // Small delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await this.sleep(500);
      }
    }
    
    return allContacts;
  }

  /**
   * Chunk text by logical sections
   */
  chunkBySections(text) {
    const sections = [];
    const lines = text.split('\n');
    
    let currentSection = { name: 'GENERAL', lines: [] };
    
    const sectionKeywords = [
      'CREW', 'TALENT', 'PRODUCTION', 'VENDORS', 'PHOTOGRAPHER',
      'HAIR', 'MAKEUP', 'STYLIST', 'DIRECTOR', 'PRODUCER'
    ];
    
    for (const line of lines) {
      const upperLine = line.toUpperCase().trim();
      
      // Check if line is a section header
      const isSectionHeader = sectionKeywords.some(keyword => 
        upperLine.includes(keyword) && 
        upperLine.length < 50 && 
        !line.includes('@') &&
        !line.match(/[\d\s-().]{8,}/)
      );
      
      if (isSectionHeader && currentSection.lines.length > 0) {
        // Save current section
        sections.push({
          section: currentSection.name,
          text: currentSection.lines.join('\n')
        });
        
        // Start new section
        currentSection = { name: upperLine, lines: [line] };
      } else {
        currentSection.lines.push(line);
      }
    }
    
    // Add last section
    if (currentSection.lines.length > 0) {
      sections.push({
        section: currentSection.name,
        text: currentSection.lines.join('\n')
      });
    }
    
    return sections;
  }

  /**
   * Build optimized system prompt with examples
   */
  buildSystemPrompt() {
    return `You extract contact information from production call sheets. Return ONLY valid JSON.

Examples of formats to handle:

1. Role on same line:
PHOTOGRAPHER: WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM

2. Role on separate line:
PHOTOGRAPHER
WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM

3. C/O entries (inherit parent role):
PHOTOGRAPHER
WILLIAM ABRANOWICZ / 646 825 1272 / WAINC@ME.COM
C/O BECKY LEWIS / 212.206.0737 / BLEWIS@ARTANDCOMMERCE.COM

4. Tabular format:
Name | Email | Phone
John Doe | john@example.com | 555-1234

5. Name / Email (no phone):
INTERIORS DIRECTOR: PHOEBE MCDOWELL / PHOEBE.MCDOWELL@SUNDAYTIMES.CO.UK

6. Name / Phone (no email):
HAIR: BEN SKERVIN / +1 (646) 284 2004

Rules:
- Extract ALL contacts mentioned in the document
- Remove "(NOT ON SET)" annotations
- Normalize names to "First Last" format (handle ALL CAPS names)
- Standardize roles (PHOTOGRAPHER, HAIR, MAKEUP, STYLIST, PRODUCER, etc.)
- Only include contacts with email OR phone
- Handle C/O entries as separate contacts with same role
- Extract contacts even if format is unusual

Return JSON:
{
  "contacts": [
    {"name": "Full Name", "role": "ROLE", "email": "email@example.com", "phone": "+1 234 567 8900"}
  ]
}`;
  }

  /**
   * Build extraction prompt
   */
  buildExtractionPrompt(text, options = {}) {
    const { chunkNumber, totalChunks, previousContext } = options;
    
    let prompt = `Extract all contacts from this call sheet:\n\n${text}`;
    
    if (chunkNumber && totalChunks) {
      prompt += `\n\n(This is chunk ${chunkNumber} of ${totalChunks})`;
    }
    
    if (previousContext) {
      prompt += `\n\nPrevious section context: ${previousContext}`;
    }
    
    if (options.rolePreferences?.length > 0) {
      prompt += `\n\nFocus on these roles: ${options.rolePreferences.join(', ')}`;
    }
    
    return prompt;
  }

  /**
   * Make API call with rate limiting
   */
  async makeAPICall(prompt) {
    // Wait for rate limit availability
    await this.waitForRateLimit();
    
    const estimatedInputTokens = this.estimateTokens(this.systemPrompt + prompt);
    
    logger.info('📤 Making API call', {
      estimatedTokens: estimatedInputTokens
    });
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' }, // Structured output
        messages: [
          {
            role: 'system',
            content: this.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.limits.maxOutputTokens,
        temperature: 0.1 // Low for consistency
      });
      
      // Update rate limiting state
      const now = Date.now();
      this.lastRequestTime = now;
      
      const outputTokens = response.usage?.completion_tokens || 0;
      const inputTokens = response.usage?.prompt_tokens || estimatedInputTokens;
      
      this.tokensUsedThisMinute += inputTokens + outputTokens;
      
      logger.info('📥 API call complete', {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      });
      
      return response;
      
    } catch (error) {
      logger.error('❌ API call failed', {
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Wait for rate limit availability
   */
  async waitForRateLimit() {
    const now = Date.now();
    
    // Reset minute counter if needed
    if (now - this.minuteStartTime > 60000) {
      this.tokensUsedThisMinute = 0;
      this.minuteStartTime = now;
    }
    
    // Wait for RPM limit (3 requests/minute = 20s between requests)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 20000 && this.lastRequestTime > 0) {
      const waitTime = 20000 - timeSinceLastRequest;
      logger.info('⏳ Waiting for rate limit', { waitTime: `${waitTime}ms` });
      await this.sleep(waitTime);
    }
    
    // Check TPM limit (60k tokens/minute)
    // Note: We estimate before the call, so this is approximate
    if (this.tokensUsedThisMinute > 55000) { // Leave buffer
      const waitTime = 60000 - (now - this.minuteStartTime);
      if (waitTime > 0) {
        logger.info('⏳ Waiting for token limit', { waitTime: `${waitTime}ms` });
        await this.sleep(waitTime);
        this.tokensUsedThisMinute = 0;
        this.minuteStartTime = Date.now();
      }
    }
  }

  /**
   * Parse AI response
   */
  parseResponse(response) {
    try {
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content');
      }
      
      // Remove markdown code blocks if present
      const cleaned = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const parsed = JSON.parse(cleaned);
      
      if (!parsed.contacts || !Array.isArray(parsed.contacts)) {
        throw new Error('Invalid response format: missing contacts array');
      }
      
      return parsed.contacts;
      
    } catch (error) {
      logger.error('❌ Failed to parse response', {
        error: error.message,
        content: response.choices[0]?.message?.content?.substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Post-process contacts (validate, deduplicate, normalize)
   */
  postProcessContacts(contacts) {
    // Validate
    const valid = contacts.filter(contact => {
      const name = (contact.name || '').trim();
      const email = (contact.email || '').trim();
      const phone = (contact.phone || '').trim();
      
      // Must have name
      if (!name || name.length < 2) return false;
      
      // Must have email OR phone
      const hasEmail = email && email.includes('@') && email.includes('.');
      const hasPhone = phone && phone.replace(/\D/g, '').length >= 10;
      
      if (!hasEmail && !hasPhone) return false;
      
      return true;
    });
    
    // Deduplicate
    const deduplicated = this.deduplicateContacts(valid);
    
    // Normalize
    return deduplicated.map(contact => ({
      name: this.normalizeName(contact.name),
      role: this.normalizeRole(contact.role),
      email: contact.email?.trim() || undefined,
      phone: this.normalizePhone(contact.phone),
      company: contact.company?.trim() || undefined
    }));
  }

  /**
   * Deduplicate contacts
   */
  deduplicateContacts(contacts) {
    const seen = new Map();
    const unique = [];
    
    for (const contact of contacts) {
      const key = this.getContactKey(contact);
      
      if (!seen.has(key)) {
        seen.set(key, contact);
        unique.push(contact);
      } else {
        // Merge with existing (prefer more complete data)
        const existing = seen.get(key);
        const merged = this.mergeContacts(existing, contact);
        const index = unique.indexOf(existing);
        unique[index] = merged;
        seen.set(key, merged);
      }
    }
    
    return unique;
  }

  /**
   * Generate unique key for contact
   */
  getContactKey(contact) {
    const email = (contact.email || '').toLowerCase().trim();
    const phone = (contact.phone || '').replace(/\D/g, '');
    const name = (contact.name || '').toLowerCase().replace(/[^a-z]/g, '');
    
    if (email) return `email:${email}`;
    if (phone && phone.length >= 10) return `phone:${phone}`;
    if (name && name.length >= 4) return `name:${name}`;
    
    return null;
  }

  /**
   * Merge two contacts (prefer more complete data)
   */
  mergeContacts(contact1, contact2) {
    return {
      name: contact1.name || contact2.name,
      role: contact1.role || contact2.role,
      email: contact1.email || contact2.email,
      phone: contact1.phone || contact2.phone,
      company: contact1.company || contact2.company
    };
  }

  /**
   * Normalize name
   */
  normalizeName(name) {
    if (!name) return '';
    
    return name
      .trim()
      .replace(/\s*\(NOT ON SET\)\s*/gi, '')
      .replace(/\s*\([^)]*\)\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize role
   */
  normalizeRole(role) {
    if (!role) return undefined;
    
    const normalized = role.toUpperCase().trim();
    
    // Standardize common roles
    const roleMap = {
      'MUA': 'MAKEUP',
      'HMU': 'HAIR & MAKEUP',
      'STYL': 'STYLIST',
      'PHOTO': 'PHOTOGRAPHER',
      'PROD': 'PRODUCER',
      'DIR': 'DIRECTOR'
    };
    
    return roleMap[normalized] || normalized;
  }

  /**
   * Normalize phone
   */
  normalizePhone(phone) {
    if (!phone) return undefined;
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length < 10) return undefined;
    
    // Format: +1 (234) 567-8900
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    return phone; // Return as-is if can't normalize
  }

  /**
   * Estimate tokens (rough: 1 token ≈ 4 characters)
   */
  estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  }

  /**
   * Quick pattern pre-check (fast path for tabular/well-structured data)
   * Only use patterns if document is highly structured and confidence is high
   */
  async quickPatternCheck(text, options = {}) {
    try {
      // Detect if document is tabular/well-structured
      const isTabular = this.detectTabularFormat(text);
      const structureScore = this.analyzeStructure(text);
      
      // Only use fast path for highly structured documents (>90% confidence)
      if (isTabular && structureScore > 0.9) {
        const patternResult = await this.patternExtractor.extractContacts(text, {
          ...options,
          extractionId: `pattern_check_${Date.now()}`
        });
        
        if (patternResult.success && patternResult.contacts.length > 0) {
          const confidence = this.calculatePatternConfidence(patternResult.contacts, text);
          
          return {
            canUse: confidence > 0.9,
            confidence,
            contacts: patternResult.contacts
          };
        }
      }
      
      return {
        canUse: false,
        confidence: 0,
        contacts: []
      };
    } catch (error) {
      logger.warn('Pattern pre-check failed, falling back to AI', { error: error.message });
      return {
        canUse: false,
        confidence: 0,
        contacts: []
      };
    }
  }

  /**
   * Detect if document is tabular format
   */
  detectTabularFormat(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length < 3) return false;
    
    // Check for pipe-separated or tab-separated formats
    const pipeSeparated = lines.filter(line => line.includes('|')).length;
    const tabSeparated = lines.filter(line => line.includes('\t')).length;
    
    // If >50% of lines have separators, likely tabular
    const separatorRatio = Math.max(pipeSeparated, tabSeparated) / lines.length;
    
    return separatorRatio > 0.5;
  }

  /**
   * Analyze document structure score (0-1)
   */
  analyzeStructure(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return 0;
    
    let structureScore = 0;
    let checks = 0;
    
    // Check 1: Consistent separators
    const separators = ['|', '\t', '/', ':'];
    const separatorCounts = separators.map(sep => 
      lines.filter(line => line.includes(sep)).length
    );
    const maxSeparatorRatio = Math.max(...separatorCounts) / lines.length;
    structureScore += maxSeparatorRatio * 0.4;
    checks++;
    
    // Check 2: Consistent line length (tabular)
    const avgLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    const lengthVariance = lines.reduce((sum, line) => {
      const diff = Math.abs(line.length - avgLength);
      return sum + (diff / avgLength);
    }, 0) / lines.length;
    const consistencyScore = Math.max(0, 1 - lengthVariance);
    structureScore += consistencyScore * 0.3;
    checks++;
    
    // Check 3: Role patterns (structured call sheets)
    const rolePattern = /^[A-Z][A-Z\s&\/\-]+:/;
    const roleLines = lines.filter(line => rolePattern.test(line.trim())).length;
    const roleRatio = roleLines / lines.length;
    structureScore += roleRatio * 0.3;
    checks++;
    
    return Math.min(1, structureScore / checks);
  }

  /**
   * Calculate pattern confidence
   */
  calculatePatternConfidence(contacts, text) {
    if (contacts.length === 0) return 0;
    
    // Base confidence on contact quality
    const validContacts = contacts.filter(c => {
      const hasEmail = c.email && c.email.includes('@');
      const hasPhone = c.phone && c.phone.replace(/\D/g, '').length >= 10;
      return hasEmail || hasPhone;
    });
    
    const validityRatio = validContacts.length / contacts.length;
    
    // Confidence based on validity and quantity
    const quantityScore = Math.min(contacts.length / 10, 1); // Optimal around 10 contacts
    
    return (validityRatio * 0.7 + quantityScore * 0.3);
  }

  /**
   * Validate AI contacts with patterns (sanity check)
   */
  async validateWithPatterns(aiContacts, text, options = {}) {
    try {
      const patternResult = await this.patternExtractor.extractContacts(text, {
        ...options,
        extractionId: `pattern_validation_${Date.now()}`
      });
      
      const patternContacts = patternResult.success ? patternResult.contacts : [];
      
      // Compare AI contacts with pattern contacts
      const matches = [];
      const discrepancies = [];
      
      // Create lookup maps
      const aiMap = new Map();
      aiContacts.forEach(contact => {
        const key = this.getContactKey(contact);
        if (key) aiMap.set(key, contact);
      });
      
      const patternMap = new Map();
      patternContacts.forEach(contact => {
        const key = this.getContactKey(contact);
        if (key) patternMap.set(key, contact);
      });
      
      // Find matches
      for (const [key, aiContact] of aiMap) {
        if (patternMap.has(key)) {
          matches.push({ ai: aiContact, pattern: patternMap.get(key) });
        }
      }
      
      // Find discrepancies (AI found but pattern didn't, or vice versa)
      for (const [key, aiContact] of aiMap) {
        if (!patternMap.has(key)) {
          discrepancies.push({ type: 'ai-only', contact: aiContact });
        }
      }
      
      // Use AI contacts as primary, but flag discrepancies
      return {
        contacts: aiContacts,
        matches: matches.length,
        discrepancies: discrepancies.length,
        patternContacts: patternContacts.length
      };
    } catch (error) {
      logger.warn('Pattern validation failed', { error: error.message });
      return {
        contacts: aiContacts,
        matches: 0,
        discrepancies: 0,
        patternContacts: 0
      };
    }
  }

  /**
   * Lightweight AI validation for pattern results
   */
  async validateWithAI(patternContacts, text, options = {}) {
    try {
      // Quick AI check to validate pattern results
      const validationPrompt = `Validate these extracted contacts from a call sheet. Return JSON with validated contacts.

Text excerpt: ${text.substring(0, 500)}...

Contacts to validate: ${JSON.stringify(patternContacts.slice(0, 10))}

Return JSON:
{
  "contacts": [...validated contacts],
  "confidence": 0.0-1.0
}`;

      // Use a simplified system prompt for validation
      const validationSystemPrompt = `You validate contact information extracted from call sheets. Return ONLY valid JSON with validated contacts and confidence score.`;
      
      await this.waitForRateLimit();
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: validationSystemPrompt },
          { role: 'user', content: validationPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.1
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No validation response');
      }
      
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const validated = JSON.parse(cleaned);
      
      return {
        contacts: validated.contacts || patternContacts,
        confidence: validated.confidence || 0.85
      };
    } catch (error) {
      logger.warn('AI validation failed, using pattern results', { error: error.message });
      return {
        contacts: patternContacts,
        confidence: 0.8
      };
    }
  }

  /**
   * Score contacts for quality
   */
  scoreContacts(contacts, text, validation = {}) {
    if (contacts.length === 0) {
      return {
        contacts: [],
        qualityScore: 0,
        confidence: 0
      };
    }
    
    // Calculate quality metrics
    const validContacts = contacts.filter(c => {
      const hasEmail = c.email && c.email.includes('@') && c.email.includes('.');
      const hasPhone = c.phone && c.phone.replace(/\D/g, '').length >= 10;
      return hasEmail || hasPhone;
    });
    
    const validityRatio = validContacts.length / contacts.length;
    
    // Completeness score (email + phone)
    const completeContacts = contacts.filter(c => {
      const hasEmail = c.email && c.email.includes('@');
      const hasPhone = c.phone && c.phone.replace(/\D/g, '').length >= 10;
      return hasEmail && hasPhone;
    }).length;
    const completenessRatio = completeContacts / contacts.length;
    
    // Pattern validation score
    const patternMatchRatio = validation.patternContacts > 0
      ? validation.matches / validation.patternContacts
      : 0.5; // Neutral if no pattern contacts
    
    // Overall quality score
    const qualityScore = (
      validityRatio * 0.4 +
      completenessRatio * 0.3 +
      patternMatchRatio * 0.3
    );
    
    // Confidence based on quality and validation
    const confidence = Math.min(1, qualityScore + (validation.matches > 0 ? 0.1 : 0));
    
    return {
      contacts: validContacts,
      qualityScore,
      confidence
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new UnifiedExtractionService();

