const simpleExtractionService = require('./simpleExtraction.service');
const aiExtractionService = require('./aiExtraction.service');
const { PrismaClient } = require('@prisma/client');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/hybrid-extraction.log' })
  ]
});

class HybridExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.simpleService = simpleExtractionService;
    this.aiService = aiExtractionService;
    
    // Performance tracking
    this.stats = {
      totalExtractions: 0,
      simpleSuccess: 0,
      aiSuccess: 0,
      hybridSuccess: 0,
      averageSimpleTime: 0,
      averageAiTime: 0,
      averageHybridTime: 0
    };
  }

  /**
   * Main hybrid extraction method
   * 1. Try simple pattern matching first (fast)
   * 2. If results are poor, enhance with AI
   * 3. Use AI for quality assurance and validation
   * 4. Learn from results to improve future extractions
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    const extractionId = this.generateExtractionId();
    
    try {
      logger.info('🚀 Starting hybrid extraction', {
        extractionId,
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        userId: options.userId
      });

      // Step 1: Fast pattern matching (75ms)
      const simpleResult = await this.simpleService.extractContacts(fileBuffer, mimeType, fileName, options);
      const simpleTime = Date.now() - startTime;
      
      logger.info('⚡ Simple extraction completed', {
        extractionId,
        contactsFound: simpleResult.contacts?.length || 0,
        processingTime: `${simpleTime}ms`
      });

      // Step 2: Evaluate if we need AI enhancement (prefer custom for tabular formats)
      const isTabular = mimeType === 'text/csv' ||
        mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // Optional env flags to control AI usage
      const aiEnabledForXlsx = process.env.AI_ENABLED_FOR_XLSX !== 'false';
      const disableAi = process.env.DISABLE_AI === 'true';

      const aiDecision = isTabular && !aiEnabledForXlsx
        ? { needsAI: false, reason: 'Tabular document - custom parser preferred' }
        : (disableAi ? { needsAI: false, reason: 'AI disabled by env' } : this.evaluateExtractionQuality(simpleResult, fileName, mimeType));
      
      if (!aiDecision.needsAI) {
        // Simple extraction was sufficient
        this.updateStats('simple', simpleTime, simpleResult.contacts?.length || 0);
        
        logger.info('✅ Simple extraction sufficient', {
          extractionId,
          contactsFound: simpleResult.contacts?.length || 0,
          processingTime: `${simpleTime}ms`
        });

        return {
          ...simpleResult,
          metadata: {
            ...simpleResult.metadata,
            extractionMethod: 'simple',
            processingTime: simpleTime,
            extractionId
          }
        };
      }

      // Step 3: AI enhancement for complex cases
      logger.info('🤖 AI enhancement needed', {
        extractionId,
        reason: aiDecision.reason,
        simpleContacts: simpleResult.contacts?.length || 0
      });

      const aiStartTime = Date.now();
      // Apply AI caps from env
      const aiOptions = {
        maxChunks: Number(process.env.AI_MAX_CHUNKS || 20),
        chunkSize: Number(process.env.AI_CHUNK_SIZE || 4000),
        earlyExitOnZero: process.env.AI_EARLY_EXIT_ON_ZERO_CONTACTS !== 'false'
      };
      const aiResult = await this.aiService.extractContacts(fileBuffer, mimeType, fileName, { ...options, aiOptions });
      const aiTime = Date.now() - aiStartTime;

      // Step 4: Hybrid result combination
      const hybridResult = await this.combineResults(simpleResult, aiResult, fileName);
      const totalTime = Date.now() - startTime;

      // Step 5: Quality assurance with AI
      const finalResult = await this.qualityAssurance(hybridResult, fileName, mimeType);

      // Step 6: Learn from this extraction
      await this.learnFromExtraction(simpleResult, aiResult, finalResult, fileName);

      this.updateStats('hybrid', totalTime, finalResult.contacts?.length || 0);

      logger.info('✅ Hybrid extraction completed', {
        extractionId,
        simpleContacts: simpleResult.contacts?.length || 0,
        aiContacts: aiResult.contacts?.length || 0,
        finalContacts: finalResult.contacts?.length || 0,
        processingTime: `${totalTime}ms`,
        aiTime: `${aiTime}ms`
      });

      return {
        ...finalResult,
        metadata: {
          ...finalResult.metadata,
          extractionMethod: 'hybrid',
          processingTime: totalTime,
          simpleTime,
          aiTime,
          extractionId,
          qualityScore: this.calculateQualityScore(finalResult)
        }
      };

    } catch (error) {
      logger.error('❌ Hybrid extraction failed', {
        extractionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Evaluate if simple extraction needs AI enhancement
   */
  evaluateExtractionQuality(result, fileName, mimeType) {
    const contacts = result.contacts || [];
    
    // If no contacts found, definitely need AI
    if (contacts.length === 0) {
      return { needsAI: true, reason: 'No contacts found' };
    }

    // If very few contacts for a large document, might need AI
    if (contacts.length < 3 && fileName.toLowerCase().includes('call')) {
      return { needsAI: true, reason: 'Low contact count for call sheet' };
    }

    // If contacts have poor quality (missing key fields), need AI
    const qualityScore = this.calculateContactQuality(contacts);
    if (qualityScore < 0.6) {
      return { needsAI: true, reason: 'Low contact quality score' };
    }

    // If document is complex (PDF with images, etc.), might need AI
    if (mimeType === 'application/pdf' && fileName.toLowerCase().includes('scan')) {
      return { needsAI: true, reason: 'Scanned PDF detected' };
    }

    return { needsAI: false, reason: 'Simple extraction sufficient' };
  }

  /**
   * Combine simple and AI results intelligently
   */
  async combineResults(simpleResult, aiResult, fileName) {
    const simpleContacts = simpleResult.contacts || [];
    const aiContacts = aiResult.contacts || [];

    // If AI found significantly more contacts, prefer AI
    if (aiContacts.length > simpleContacts.length * 1.5) {
      logger.info('🤖 AI found significantly more contacts, using AI result', {
        simpleCount: simpleContacts.length,
        aiCount: aiContacts.length
      });
      return aiResult;
    }

    // If simple found good contacts, use them as base and enhance with AI
    const combinedContacts = [...simpleContacts];
    
    // Add AI contacts that don't duplicate simple ones
    for (const aiContact of aiContacts) {
      const isDuplicate = combinedContacts.some(simpleContact => 
        this.areContactsSimilar(simpleContact, aiContact)
      );
      
      if (!isDuplicate) {
        combinedContacts.push({
          ...aiContact,
          source: 'ai_enhancement'
        });
      }
    }

    // Use AI's enhanced metadata if available
    const enhancedMetadata = {
      ...simpleResult.metadata,
      ...aiResult.metadata,
      combinedContacts: combinedContacts.length,
      simpleContacts: simpleContacts.length,
      aiContacts: aiContacts.length
    };

    return {
      contacts: combinedContacts,
      metadata: enhancedMetadata,
      success: true
    };
  }

  /**
   * Quality assurance using AI validation
   */
  async qualityAssurance(result, fileName, mimeType) {
    try {
      const contacts = result.contacts || [];
      
      if (contacts.length === 0) {
        return result;
      }

      // Use AI to validate and clean contacts
      const validatedContacts = await this.validateContactsWithAI(contacts, fileName);
      
      return {
        ...result,
        contacts: validatedContacts,
        metadata: {
          ...result.metadata,
          qualityAssured: true,
          originalCount: contacts.length,
          validatedCount: validatedContacts.length
        }
      };
    } catch (error) {
      logger.warn('⚠️ Quality assurance failed, using original result', {
        error: error.message
      });
      return result;
    }
  }

  /**
   * Validate contacts using AI
   */
  async validateContactsWithAI(contacts, fileName) {
    try {
      // Simple validation for now - can be enhanced with AI
      return contacts.map(contact => ({
        ...contact,
        validated: true,
        qualityScore: this.calculateContactQuality([contact])
      }));
    } catch (error) {
      logger.warn('⚠️ AI validation failed', { error: error.message });
      return contacts;
    }
  }

  /**
   * Learn from extraction results to improve future extractions
   */
  async learnFromExtraction(simpleResult, aiResult, finalResult, fileName) {
    try {
      const learningData = {
        fileName,
        timestamp: Date.now(),
        simpleContacts: simpleResult.contacts?.length || 0,
        aiContacts: aiResult.contacts?.length || 0,
        finalContacts: finalResult.contacts?.length || 0,
        qualityScore: this.calculateQualityScore(finalResult)
      };

      // Store learning data for pattern improvement
      // This could be enhanced to update pattern recognition rules
      logger.info('🧠 Learning from extraction', learningData);
      
    } catch (error) {
      logger.warn('⚠️ Failed to learn from extraction', { error: error.message });
    }
  }

  /**
   * Calculate quality score for extraction result
   */
  calculateQualityScore(result) {
    const contacts = result.contacts || [];
    if (contacts.length === 0) return 0;

    const qualityScores = contacts.map(contact => 
      this.calculateContactQuality([contact])
    );
    
    return qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  }

  /**
   * Calculate quality score for individual contacts
   */
  calculateContactQuality(contacts) {
    if (!contacts || contacts.length === 0) return 0;

    let totalScore = 0;
    for (const contact of contacts) {
      let score = 0;
      
      // Name quality (0-0.3)
      if (contact.name && contact.name.trim().length > 0) score += 0.3;
      
      // Email quality (0-0.3)
      if (contact.email && this.isValidEmail(contact.email)) score += 0.3;
      
      // Phone quality (0-0.2)
      if (contact.phone && this.isValidPhone(contact.phone)) score += 0.2;
      
      // Role quality (0-0.2)
      if (contact.role && contact.role.trim().length > 0) score += 0.2;
      
      totalScore += score;
    }
    
    return totalScore / contacts.length;
  }

  /**
   * Check if two contacts are similar (to avoid duplicates)
   */
  areContactsSimilar(contact1, contact2) {
    // Simple similarity check - can be enhanced
    const name1 = (contact1.name || '').toLowerCase().trim();
    const name2 = (contact2.name || '').toLowerCase().trim();
    
    if (name1 && name2 && name1 === name2) return true;
    
    const email1 = (contact1.email || '').toLowerCase().trim();
    const email2 = (contact2.email || '').toLowerCase().trim();
    
    if (email1 && email2 && email1 === email2) return true;
    
    return false;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format
   */
  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Update performance statistics
   */
  updateStats(method, processingTime, contactsFound) {
    this.stats.totalExtractions++;
    
    if (method === 'simple') {
      this.stats.simpleSuccess++;
      this.stats.averageSimpleTime = 
        (this.stats.averageSimpleTime * (this.stats.simpleSuccess - 1) + processingTime) / this.stats.simpleSuccess;
    } else if (method === 'hybrid') {
      this.stats.hybridSuccess++;
      this.stats.averageHybridTime = 
        (this.stats.averageHybridTime * (this.stats.hybridSuccess - 1) + processingTime) / this.stats.hybridSuccess;
    }
  }

  /**
   * Generate unique extraction ID
   */
  generateExtractionId() {
    return `hybrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      simpleSuccessRate: this.stats.totalExtractions > 0 ? 
        (this.stats.simpleSuccess / this.stats.totalExtractions) * 100 : 0,
      hybridSuccessRate: this.stats.totalExtractions > 0 ? 
        (this.stats.hybridSuccess / this.stats.totalExtractions) * 100 : 0
    };
  }
}

module.exports = new HybridExtractionService();