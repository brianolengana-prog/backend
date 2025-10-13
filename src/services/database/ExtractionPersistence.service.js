/**
 * Extraction Persistence Service
 * 
 * Handles atomic database operations for extraction results
 * Implements transactional integrity to prevent data corruption
 * 
 * @module ExtractionPersistenceService
 * @follows Single Responsibility Principle
 */

const { PrismaClient, Prisma } = require('@prisma/client');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const prisma = new PrismaClient();

class ExtractionPersistenceService {
  /**
   * Save extraction results atomically
   * 
   * All operations succeed or all fail (ACID compliance)
   * Prevents orphaned jobs without contacts
   * 
   * @param {Object} params - Extraction parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.fileData - File metadata
   * @param {Object} params.extractionResult - Extraction result with contacts
   * @param {Object} params.options - Additional options
   * @returns {Promise<Object>} Saved job with contacts
   * @throws {Error} If transaction fails
   */
  async saveExtractionWithTransaction(params) {
    const { userId, fileData, extractionResult, options = {} } = params;
    const startTime = Date.now();
    
    try {
      logger.info('💾 Starting atomic save operation', {
        userId,
        fileName: fileData.originalname,
        contactCount: extractionResult.contacts?.length || 0
      });

      // Execute all operations in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: Ensure user profile exists (FK requirement)
        await this.ensureProfile(tx, userId);
        
        // Step 2: Create job record
        const job = await tx.job.create({
          data: {
            userId,
            title: options.title || `Extraction - ${fileData.originalname}`,
            fileName: fileData.originalname,
            // ✅ FIXED: Removed invalid fields (fileType, extractionMethod, etc.)
            // Store metadata in processedContacts JSON field instead
            fileSize: fileData.size,
            fileHash: options.fileHash,
            status: 'COMPLETED',
            processedContacts: {
              // Store all extraction metadata in JSON field
              extractionMethod: extractionResult.metadata?.extractionMethod || 'unknown',
              processingTime: extractionResult.metadata?.processingTime || 0,
              documentType: extractionResult.metadata?.documentType,
              metadata: extractionResult.metadata || {},
              startedAt: options.startedAt || new Date(),
              completedAt: new Date(),
              mimetype: fileData.mimetype
            }
          }
        });
        
        logger.info('✅ Job created', { jobId: job.id });
        
        // Step 3: Create contacts (if any)
        if (extractionResult.contacts && extractionResult.contacts.length > 0) {
          const contactsData = this.prepareContactsData(
            extractionResult.contacts,
            job.id,
            userId
          );
          
          await tx.contact.createMany({
            data: contactsData,
            skipDuplicates: true  // Skip if exact duplicate exists
          });
          
          logger.info('✅ Contacts created', { 
            jobId: job.id,
            contactCount: contactsData.length 
          });
        }
        
        // Step 4: Load created contacts with relations
        const savedContacts = await tx.contact.findMany({
          where: { jobId: job.id },
          orderBy: { createdAt: 'asc' }
        });
        
        // Step 5: Create production record if detected
        if (extractionResult.metadata?.productionName) {
          await tx.production.create({
            data: {
              userId,
              name: extractionResult.metadata.productionName,
              jobId: job.id
            }
          }).catch(err => {
            // Production creation is optional, log but don't fail
            logger.warn('⚠️ Failed to create production record', {
              error: err.message
            });
          });
        }
        
        return {
          job,
          contacts: savedContacts
        };
        
      }, {
        maxWait: 5000,      // Wait max 5 seconds for transaction to start
        timeout: 30000,     // Transaction must complete within 30 seconds
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });
      
      const duration = Date.now() - startTime;
      logger.info('✅ Atomic save completed', {
        jobId: result.job.id,
        contactCount: result.contacts.length,
        duration: `${duration}ms`
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Atomic save failed - transaction rolled back', {
        userId,
        fileName: fileData.originalname,
        error: error.message,
        duration: `${duration}ms`
      });
      
      // Re-throw with context
      const enhancedError = new Error(`Database save failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = { userId, fileName: fileData.originalname };
      throw enhancedError;
    }
  }
  
  /**
   * Ensure user profile exists (FK requirement for jobs.user_id)
   * 
   * @private
   * @param {Object} tx - Prisma transaction client
   * @param {string} userId - User ID
   */
  async ensureProfile(tx, userId) {
    try {
      await tx.profile.upsert({
        where: { userId },
        update: {},  // No update needed, just ensure exists
        create: { userId }
      });
    } catch (error) {
      logger.error('❌ Failed to ensure profile', {
        userId,
        error: error.message
      });
      throw new Error('User profile validation failed');
    }
  }
  
  /**
   * Prepare contacts data for batch insert
   * Validates and normalizes contact data
   * 
   * @private
   * @param {Array} contacts - Raw contacts from extraction
   * @param {string} jobId - Job ID to associate contacts with
   * @param {string} userId - User ID
   * @returns {Array} Prepared contact data
   */
  prepareContactsData(contacts, jobId, userId) {
    return contacts
      .map(contact => ({
        jobId,
        userId,
        name: this.normalizeName(contact.name),
        role: this.normalizeRole(contact.role),
        email: this.normalizeEmail(contact.email),
        phone: this.normalizePhone(contact.phone),
        company: this.normalizeCompany(contact.company),
        department: contact.department || null,
        confidence: this.normalizeConfidence(contact.confidence),
        metadata: contact.metadata || {}
      }))
      .filter(contact => this.isValidContact(contact));
  }
  
  /**
   * Normalize and validate contact name
   * @private
   */
  normalizeName(name) {
    if (!name) return null;
    return String(name)
      .trim()
      .replace(/\s+/g, ' ')  // Normalize multiple spaces
      .substring(0, 255);     // Enforce DB limit
  }
  
  /**
   * Normalize role
   * @private
   */
  normalizeRole(role) {
    if (!role) return null;
    return String(role)
      .trim()
      .substring(0, 100);
  }
  
  /**
   * Normalize and validate email
   * @private
   */
  normalizeEmail(email) {
    if (!email) return null;
    
    const normalized = String(email)
      .toLowerCase()
      .trim()
      .replace(/[\t\n\r]+/g, '')  // Remove whitespace
      .substring(0, 255);
    
    // Basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(normalized) ? normalized : null;
  }
  
  /**
   * Normalize phone number
   * @private
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    return String(phone)
      .trim()
      .substring(0, 50);
  }
  
  /**
   * Normalize company name
   * @private
   */
  normalizeCompany(company) {
    if (!company) return null;
    return String(company)
      .trim()
      .substring(0, 255);
  }
  
  /**
   * Normalize confidence score
   * @private
   */
  normalizeConfidence(confidence) {
    if (confidence === null || confidence === undefined) return 0.5;
    
    const numeric = parseFloat(confidence);
    if (isNaN(numeric)) return 0.5;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, numeric));
  }
  
  /**
   * Validate contact has minimum required data
   * @private
   */
  isValidContact(contact) {
    // Must have a name
    if (!contact.name || contact.name.length < 2) {
      return false;
    }
    
    // Must have at least email OR phone
    if (!contact.email && !contact.phone) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Health check
   * @returns {Promise<Object>} Service health status
   */
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new ExtractionPersistenceService();

