/**
 * Hybrid Extraction Service
 * 
 * Enterprise-level extraction that intelligently combines:
 * - AI-powered extraction for complex documents
 * - Pattern-based extraction for simple documents
 * - OCR for scanned PDFs
 * - Automatic fallback strategies
 */

const extractionService = require('./extraction.service');
const aiExtractionService = require('./aiExtraction.service');
const optimizedAIExtractionService = require('./optimizedAIExtraction.service');
const { PrismaClient } = require('@prisma/client');

class HybridExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.aiAvailable = aiExtractionService.getHealthStatus().available;
    this.optimizedAIAvailable = optimizedAIExtractionService.getHealthStatus().available;
    this.patternAvailable = true; // Pattern extraction is always available
    
    console.log(`🔧 Hybrid Extraction Service initialized:`);
    console.log(`  - AI Extraction: ${this.aiAvailable ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`  - Optimized AI: ${this.optimizedAIAvailable ? '✅ Available' : '❌ Unavailable'}`);
    console.log(`  - Pattern Extraction: ${this.patternAvailable ? '✅ Available' : '❌ Unavailable'}`);
  }

  /**
   * Main hybrid extraction method
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    try {
      console.log('🚀 Starting hybrid extraction...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Analyze document to determine best strategy
      const strategy = await this.determineExtractionStrategy(fileBuffer, mimeType, fileName, options);
      console.log('🎯 Selected strategy:', strategy);

      let result;
      let extractionMethod = 'unknown';

      // Step 2: Execute extraction based on strategy
      switch (strategy) {
        case 'ai-only':
          if (this.optimizedAIAvailable) {
            result = await optimizedAIExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
            extractionMethod = 'optimized-ai-only';
          } else if (this.aiAvailable) {
            result = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
            extractionMethod = 'ai-only';
          } else {
            throw new Error('AI extraction requested but not available');
          }
          break;

        case 'pattern-only':
          result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
          extractionMethod = 'pattern-only';
          break;

        case 'ai-primary':
          if (this.optimizedAIAvailable) {
            try {
              result = await optimizedAIExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
              extractionMethod = 'optimized-ai-primary';
            } catch (aiError) {
              console.warn('⚠️ Optimized AI extraction failed, trying standard AI:', aiError.message);
              try {
                result = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
                extractionMethod = 'ai-primary-with-optimized-fallback';
              } catch (standardAIError) {
                console.warn('⚠️ Standard AI extraction failed, falling back to pattern extraction:', standardAIError.message);
                result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
                extractionMethod = 'ai-primary-with-pattern-fallback';
              }
            }
          } else if (this.aiAvailable) {
            try {
              result = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
              extractionMethod = 'ai-primary';
            } catch (aiError) {
              console.warn('⚠️ AI extraction failed, falling back to pattern extraction:', aiError.message);
              result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
              extractionMethod = 'ai-primary-with-fallback';
            }
          } else {
            result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
            extractionMethod = 'pattern-only-ai-unavailable';
          }
          break;

        case 'pattern-primary':
          try {
            result = await extractionService.extractContacts(fileBuffer, mimeType, fileName, options);
            extractionMethod = 'pattern-primary';
            
            // If pattern extraction found few contacts and AI is available, try AI as supplement
            if (this.aiAvailable && result.contacts && result.contacts.length < 5) {
              console.log('🔄 Pattern extraction found few contacts, trying AI supplement...');
              try {
                const aiResult = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
                if (aiResult.contacts && aiResult.contacts.length > result.contacts.length) {
                  console.log('✅ AI supplement found more contacts, using AI result');
                  result = aiResult;
                  extractionMethod = 'pattern-primary-with-ai-supplement';
                }
              } catch (aiError) {
                console.warn('⚠️ AI supplement failed:', aiError.message);
              }
            }
          } catch (patternError) {
            if (this.aiAvailable) {
              console.warn('⚠️ Pattern extraction failed, trying AI fallback:', patternError.message);
              result = await aiExtractionService.extractContacts(fileBuffer, mimeType, fileName, options);
              extractionMethod = 'pattern-primary-with-ai-fallback';
            } else {
              throw patternError;
            }
          }
          break;

        default:
          throw new Error(`Unknown extraction strategy: ${strategy}`);
      }

      // Step 3: Post-process results
      if (result.success) {
        result.metadata = {
          ...result.metadata,
          extractionMethod: extractionMethod,
          strategy: strategy,
          hybridProcessing: true,
          aiAvailable: this.aiAvailable,
          patternAvailable: this.patternAvailable
        };
      }

      console.log(`✅ Hybrid extraction completed using ${extractionMethod}`);
      return result;

    } catch (error) {
      console.error('❌ Hybrid extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        metadata: {
          extractionMethod: 'hybrid-failed',
          strategy: 'unknown',
          hybridProcessing: true
        }
      };
    }
  }

  /**
   * Determine the best extraction strategy based on document characteristics
   */
  async determineExtractionStrategy(fileBuffer, mimeType, fileName, options = {}) {
    // Check if user explicitly requested a method
    if (options.method) {
      switch (options.method.toLowerCase()) {
        case 'ai':
          return this.aiAvailable ? 'ai-only' : 'pattern-only';
        case 'pattern':
          return 'pattern-only';
        default:
          break;
      }
    }

    // Analyze document characteristics
    const characteristics = await this.analyzeDocumentCharacteristics(fileBuffer, mimeType, fileName);
    
    console.log('📊 Document characteristics:', characteristics);

    // Decision logic based on characteristics
    if (characteristics.isScannedPDF) {
      return this.aiAvailable ? 'ai-primary' : 'pattern-only';
    }

    if (characteristics.isComplexDocument) {
      return this.aiAvailable ? 'ai-primary' : 'pattern-only';
    }

    if (characteristics.isSimpleDocument) {
      return 'pattern-primary';
    }

    if (characteristics.isLargeDocument) {
      return this.aiAvailable ? 'ai-primary' : 'pattern-only';
    }

    // Default strategy
    return this.aiAvailable ? 'ai-primary' : 'pattern-only';
  }

  /**
   * Analyze document characteristics to inform strategy selection
   */
  async analyzeDocumentCharacteristics(fileBuffer, mimeType, fileName) {
    const characteristics = {
      isScannedPDF: false,
      isComplexDocument: false,
      isSimpleDocument: false,
      isLargeDocument: false,
      estimatedContacts: 0,
      documentType: 'unknown'
    };

    // Check file size
    characteristics.isLargeDocument = fileBuffer.length > 5 * 1024 * 1024; // 5MB

    // Check if it's a PDF
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      try {
        // Try to extract text to determine if it's scanned
        const pdfjs = require('pdfjs-dist');
        const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
        let text = '';
        
        // Sample first few pages
        const pagesToCheck = Math.min(3, pdf.numPages);
        for (let i = 1; i <= pagesToCheck; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          text += pageText;
        }
        
        // Check if we got meaningful text
        if (text.trim().length < 100 || this.isPDFGarbage(text)) {
          characteristics.isScannedPDF = true;
        }
        
        // Analyze document complexity
        characteristics.isComplexDocument = this.analyzeComplexity(text);
        characteristics.estimatedContacts = this.estimateContacts(text);
        
      } catch (error) {
        // If PDF processing fails, assume it's scanned
        characteristics.isScannedPDF = true;
      }
    } else {
      // For non-PDF documents, try to extract text for analysis
      try {
        const text = await this.extractTextForAnalysis(fileBuffer, mimeType, fileName);
        characteristics.isComplexDocument = this.analyzeComplexity(text);
        characteristics.estimatedContacts = this.estimateContacts(text);
        characteristics.isSimpleDocument = !characteristics.isComplexDocument;
      } catch (error) {
        console.warn('⚠️ Could not analyze document characteristics:', error.message);
      }
    }

    return characteristics;
  }

  /**
   * Extract text for analysis (lightweight)
   */
  async extractTextForAnalysis(fileBuffer, mimeType, fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExtension === '.xlsx') {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        text += sheetText;
      });
      return text;
    } else {
      return fileBuffer.toString('utf-8');
    }
  }

  /**
   * Analyze document complexity
   */
  analyzeComplexity(text) {
    if (!text || text.length < 100) return false;

    // Check for complex patterns
    const complexIndicators = [
      /table|tabular|spreadsheet/i,
      /multiple\s+sections/i,
      /hierarchical/i,
      /nested/i,
      /complex\s+layout/i
    ];

    const hasComplexPatterns = complexIndicators.some(pattern => pattern.test(text));

    // Check for multiple contact types
    const contactTypes = ['crew', 'talent', 'cast', 'production', 'client', 'vendor'];
    const foundTypes = contactTypes.filter(type => text.toLowerCase().includes(type)).length;

    // Check for structured data
    const hasStructuredData = /[|]\s*[|]|\t.*\t/.test(text);

    return hasComplexPatterns || foundTypes > 2 || hasStructuredData;
  }

  /**
   * Estimate number of contacts
   */
  estimateContacts(text) {
    if (!text) return 0;

    // Count email addresses
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    const emailCount = emailMatches ? emailMatches.length : 0;

    // Count phone numbers
    const phoneMatches = text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g);
    const phoneCount = phoneMatches ? phoneMatches.length : 0;

    // Count potential names (2+ words, capitalized)
    const nameMatches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
    const nameCount = nameMatches ? nameMatches.length : 0;

    // Return the maximum of these estimates
    return Math.max(emailCount, phoneCount, Math.floor(nameCount / 2));
  }

  /**
   * Check if text is PDF garbage
   */
  isPDFGarbage(text) {
    if (!text || text.trim().length < 10) return false;
    
    const pdfMarkers = [
      'endobj', 'stream', 'endstream', 'xref', 'trailer', 
      'startxref', '%%EOF', '/Type', '/Subtype', '/Filter'
    ];
    
    const markerCount = pdfMarkers.filter(marker => text.includes(marker)).length;
    return markerCount >= 3;
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      hybrid: true,
      aiAvailable: this.aiAvailable,
      optimizedAIAvailable: this.optimizedAIAvailable,
      patternAvailable: this.patternAvailable,
      aiHealth: aiExtractionService.getHealthStatus(),
      optimizedAIHealth: optimizedAIExtractionService.getHealthStatus(),
      patternHealth: extractionService.getHealthStatus()
    };
  }
}

module.exports = new HybridExtractionService();
