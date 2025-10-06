/**
 * Extraction Orchestrator - Main service that coordinates all extraction components
 * Single Responsibility: Orchestration and workflow management
 */

const DocumentProcessor = require('./DocumentProcessor');
const DocumentAnalyzer = require('./DocumentAnalyzer');
const ContactExtractor = require('./ContactExtractor');
const ContactValidator = require('./ContactValidator');
const { PrismaClient } = require('@prisma/client');

class ExtractionOrchestrator {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Main extraction method - orchestrates the entire extraction workflow
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting extraction process...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Extract text from document
      const extractedText = await DocumentProcessor.extractText(fileBuffer, mimeType, fileName);
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      console.log('📄 Text extracted, length:', extractedText.length);

      // Step 2: Analyze document structure
      const documentAnalysis = DocumentAnalyzer.analyzeDocument(extractedText, fileName);
      console.log('📊 Document analysis:', DocumentAnalyzer.getAnalysisSummary(documentAnalysis));

      // Step 3: Extract contacts using patterns
      const rawContacts = await ContactExtractor.extractContacts(extractedText, {
        maxContacts: options.maxContacts || 1000,
        maxProcessingTime: options.maxProcessingTime || 15000,
        ...options
      });

      // Step 4: Validate and clean contacts
      const validatedContacts = ContactValidator.validateContacts(rawContacts);

      // Step 5: Sort and filter contacts
      let finalContacts = ContactValidator.sortContacts(validatedContacts);
      
      // Apply role preferences if specified
      if (options.rolePreferences && options.rolePreferences.length > 0) {
        finalContacts = ContactValidator.filterByRolePreferences(finalContacts, options.rolePreferences);
      }

      const processingTime = Date.now() - startTime;
      const validationStats = ContactValidator.getValidationStats(rawContacts, finalContacts);

      console.log(`✅ Extraction completed: ${finalContacts.length} contacts found`);
      console.log('📊 Validation stats:', validationStats);

      return {
        success: true,
        contacts: finalContacts,
        metadata: {
          documentType: documentAnalysis.type,
          productionType: documentAnalysis.productionType,
          extractionMethod: 'pattern-based',
          processingTime,
          textLength: extractedText.length,
          confidence: ContactValidator.calculateOverallConfidence(finalContacts),
          validationStats,
          documentAnalysis: DocumentAnalyzer.getAnalysisSummary(documentAnalysis)
        }
      };

    } catch (error) {
      console.error('❌ Extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        metadata: {
          extractionMethod: 'pattern-based',
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Extract text only (for other services to use)
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    return await DocumentProcessor.extractText(fileBuffer, mimeType);
  }

  /**
   * Extract contacts from already extracted text
   */
  async extractContactsFromText(text, documentAnalysis, options = {}) {
    try {
      // Use provided analysis or analyze the text
      const analysis = documentAnalysis || DocumentAnalyzer.analyzeDocument(text);
      
      // Extract contacts using patterns
      const rawContacts = await ContactExtractor.extractContacts(text, options);
      
      // Validate and clean contacts
      const validatedContacts = ContactValidator.validateContacts(rawContacts);
      
      // Sort contacts
      const sortedContacts = ContactValidator.sortContacts(validatedContacts);
      
      return sortedContacts;
    } catch (error) {
      console.error('❌ Text-based extraction failed:', error);
      return [];
    }
  }

  /**
   * Save contacts to database
   */
  async saveContacts(contacts, userId, jobId) {
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return { success: true, saved: 0 };
    }

    try {
      const contactsToSave = contacts.map(contact => ({
        name: contact.name || '',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        section: contact.section || 'OTHER',
        confidence: contact.confidence || 0.5,
        source: contact.source || 'extraction',
        userId,
        jobId
      }));

      const result = await this.prisma.contact.createMany({
        data: contactsToSave,
        skipDuplicates: true
      });

      console.log(`✅ Saved ${result.count} contacts to database`);
      
      return {
        success: true,
        saved: result.count,
        total: contacts.length
      };

    } catch (error) {
      console.error('❌ Failed to save contacts:', error);
      return {
        success: false,
        error: error.message,
        saved: 0,
        total: contacts.length
      };
    }
  }

  /**
   * Get health status of all components
   */
  getHealthStatus() {
    return {
      initialized: true,
      components: {
        documentProcessor: 'available',
        documentAnalyzer: 'available',
        contactExtractor: 'available',
        contactValidator: 'available'
      },
      supportedFormats: [
        'PDF', 'DOCX', 'XLSX', 'XLS', 'CSV', 'Images', 'Plain Text'
      ],
      extractionMethods: [
        'pattern-based', 'hybrid', 'ai-enhanced'
      ]
    };
  }

  /**
   * Get extraction statistics
   */
  async getExtractionStats(userId, timeframe = '30d') {
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(timeframe));

      const jobs = await this.prisma.job.findMany({
        where: {
          userId,
          createdAt: {
            gte: since
          }
        },
        include: {
          contacts: true
        }
      });

      const totalJobs = jobs.length;
      const totalContacts = jobs.reduce((sum, job) => sum + job.contacts.length, 0);
      const avgContactsPerJob = totalJobs > 0 ? totalContacts / totalJobs : 0;

      return {
        success: true,
        stats: {
          totalJobs,
          totalContacts,
          avgContactsPerJob: Math.round(avgContactsPerJob * 100) / 100,
          timeframe,
          period: {
            start: since.toISOString(),
            end: new Date().toISOString()
          }
        }
      };

    } catch (error) {
      console.error('❌ Failed to get extraction stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ExtractionOrchestrator();
