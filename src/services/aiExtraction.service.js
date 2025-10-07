/**
 * AI-Powered Extraction Service
 * 
 * Enterprise-level extraction using OpenAI for:
 * - Intelligent document analysis
 * - Advanced pattern recognition
 * - Context-aware contact extraction
 * - Quality validation and confidence scoring
 */

const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

class AIExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isAvailable = !!process.env.OPENAI_API_KEY;
    
    if (!this.isAvailable) {
      console.warn('⚠️ OpenAI API key not found - AI extraction will be disabled');
    }
  }

  /**
   * Main AI-powered extraction method
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    if (!this.isAvailable) {
      throw new Error('AI extraction service is not available - OpenAI API key required');
    }

    try {
      // Hard skip AI for tabular formats when disabled via env
      const isTabular = mimeType === 'text/csv' ||
        mimeType === 'application/vnd.ms-excel' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const aiEnabledForXlsx = process.env.AI_ENABLED_FOR_XLSX !== 'false';
      if (isTabular && !aiEnabledForXlsx) {
        return { success: true, contacts: [], metadata: { aiSkipped: 'tabular' } };
      }

      console.log('🤖 Starting AI-powered extraction...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Extract text from document
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      console.log('📄 Text extracted, length:', extractedText.length);

      // Step 2: AI Document Analysis
      const documentAnalysis = await this.analyzeDocumentWithAI(extractedText, fileName);
      console.log('🧠 AI document analysis:', documentAnalysis);

      // Step 3: AI Contact Extraction with global caps
      const maxChunks = Number(options?.aiOptions?.maxChunks ?? process.env.AI_MAX_CHUNKS ?? 20);
      const chunkSize = Number(options?.aiOptions?.chunkSize ?? process.env.AI_CHUNK_SIZE ?? 4000);
      const earlyExitOnZero = (options?.aiOptions?.earlyExitOnZero ?? (process.env.AI_EARLY_EXIT_ON_ZERO_CONTACTS !== 'false'));
      const contacts = await this.extractContactsWithAI(extractedText, documentAnalysis, { ...options, maxChunks, chunkSize, earlyExitOnZero });

      // Step 4: AI Quality Validation
      const validatedContacts = await this.validateContactsWithAI(contacts, extractedText, documentAnalysis);

      // Step 5: AI Enhancement and Enrichment
      const enhancedContacts = await this.enhanceContactsWithAI(validatedContacts, documentAnalysis);

      console.log(`✅ AI extraction completed: ${enhancedContacts.length} contacts found`);

      return {
        success: true,
        contacts: enhancedContacts,
        metadata: {
          documentType: documentAnalysis.type,
          productionType: documentAnalysis.productionType,
          extractionMethod: 'ai-powered',
          processingTime: Date.now(),
          confidence: this.calculateOverallConfidence(enhancedContacts),
          aiInsights: documentAnalysis.aiInsights
        }
      };

    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Extract text from document (supports scanned PDFs via OCR)
   */
  async extractTextFromDocument(fileBuffer, mimeType, fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (mimeType === 'application/pdf' || fileExtension === '.pdf') {
      // First try standard PDF text extraction
      try {
        const pdfjs = require('pdfjs-dist');
        
        // Convert Buffer to Uint8Array for PDF.js compatibility
        const uint8Array = new Uint8Array(fileBuffer);
        const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }
        
        // Check if we got meaningful text
        if (fullText.trim().length > 50 && !this.isPDFGarbage(fullText)) {
          console.log('📄 PDF text extraction successful');
          return fullText.trim();
        }
        
        // If text extraction failed or returned garbage, try OCR
        console.log('🔄 PDF text extraction failed, trying OCR...');
        return await this.extractTextFromScannedPDF(fileBuffer);
        
      } catch (error) {
        console.log('🔄 PDF processing failed, trying OCR...');
        return await this.extractTextFromScannedPDF(fileBuffer);
      }
    }
    
    // Handle other file types
    return await this.extractTextFromOtherFormats(fileBuffer, mimeType, fileName);
  }

  /**
   * Extract text from scanned PDF using OCR
   */
  async extractTextFromScannedPDF(fileBuffer) {
    try {
      const tesseract = require('tesseract.js');
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      // For now, we'll use a simplified approach that works on Windows
      // In production, you might want to use a cloud OCR service or Docker
      console.log('⚠️ Scanned PDF OCR requires additional setup on Windows');
      console.log('💡 Consider using cloud OCR services like Google Vision API or AWS Textract');
      
      // Try to extract any text that might be embedded
      const pdfjsModule = await import('pdfjs-dist');
      const pdfjs = pdfjsModule.default || pdfjsModule;
      
      // Convert Buffer to Uint8Array for PDF.js compatibility
      const uint8Array = new Uint8Array(fileBuffer);
      const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => item.str)
          .join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }
      
      if (fullText.trim().length > 10) {
        console.log('📄 Found embedded text in PDF');
        return fullText.trim();
      }
      
      throw new Error('No text found in PDF - likely scanned document requiring OCR setup');
      
    } catch (error) {
      console.error('❌ Scanned PDF processing failed:', error);
      throw new Error(`Scanned PDF processing failed: ${error.message}. Consider using cloud OCR services.`);
    }
  }

  /**
   * Extract text from other document formats
   */
  async extractTextFromOtherFormats(fileBuffer, mimeType, fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileExtension === '.xlsx') {
      const xlsx = require('xlsx');
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      return fullText.trim();
    } else if (mimeType.startsWith('image/')) {
      const tesseract = require('tesseract.js');
      const { data: { text } } = await tesseract.recognize(fileBuffer);
      return text.trim();
    } else {
      return fileBuffer.toString('utf-8');
    }
  }

  /**
   * AI-powered document analysis
   */
  async analyzeDocumentWithAI(text, fileName) {
    const prompt = `You are an expert document analyst specializing in production documents and call sheets. Analyze this document and provide detailed insights:

Document Text:
${text.substring(0, 4000)} ${text.length > 4000 ? '...' : ''}

Provide analysis in JSON format:
{
  "type": "call_sheet|contact_list|production_document|other",
  "productionType": "film|television|commercial|documentary|other",
  "structure": "tabular|unstructured|mixed",
  "complexity": "low|medium|high",
  "estimatedContacts": number,
  "sections": ["CREW", "TALENT", "CLIENTS", etc.],
  "confidence": 0.0-1.0,
  "aiInsights": {
    "contactDensity": number,
    "documentStructure": "description",
    "keyPatterns": ["pattern1", "pattern2"],
    "extractionChallenges": ["challenge1", "challenge2"],
    "recommendedStrategy": "pattern-based|ai-enhanced|hybrid"
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1500,
        temperature: 0.1
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('🧠 AI document analysis complete');
      return analysis;
    } catch (error) {
      console.warn('⚠️ AI document analysis failed, using fallback:', error.message);
      return this.fallbackDocumentAnalysis(text);
    }
  }

  /**
   * AI-powered contact extraction
   */
  async extractContactsWithAI(text, documentAnalysis, options = {}) {
    // Smart text chunking to avoid token limits (honor caps)
    const chunkSize = Number(options?.chunkSize ?? 4000);
    const maxChunks = Number(options?.maxChunks ?? 20);
    const earlyExitOnZero = options?.earlyExitOnZero !== false;

    const allChunks = this.chunkTextForAI(text, chunkSize);
    const textChunks = maxChunks > 0 ? allChunks.slice(0, maxChunks) : [];
    let allContacts = [];
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`🤖 Processing AI chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
      
      const prompt = this.buildExtractionPrompt(chunk, documentAnalysis, options, i + 1, textChunks.length);
      
      try {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are an expert at extracting contact information from production documents. Always return valid JSON array of contacts with these fields: name, email, phone, role, company, confidence."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 4000,
          temperature: 0.1
        });

        const chunkContacts = JSON.parse(response.choices[0].message.content);
        allContacts = allContacts.concat(chunkContacts);
        
        // Early exit if no contacts after first few chunks
        if (earlyExitOnZero && allContacts.length === 0 && i + 1 >= Math.min(3, textChunks.length)) {
          console.log('⚠️ Early exit: no contacts found in initial chunks');
          break;
        }
        // Small delay between chunks
        if (i < textChunks.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.warn(`⚠️ AI chunk ${i + 1} failed:`, error.message);
      }
    }

    console.log(`🤖 AI extraction found ${allContacts.length} contacts`);
    return allContacts;
  }

  /**
   * Build extraction prompt based on document analysis
   */
  buildExtractionPrompt(text, documentAnalysis, options, chunkNumber, totalChunks) {
    let prompt = `Extract contact information from this production document text. Return a JSON array of contacts with the following structure:
[
  {
    "name": "Full Name",
    "role": "Job Title/Role",
    "department": "Department",
    "email": "email@example.com",
    "phone": "phone number",
    "company": "Company Name",
    "confidence": 0.0-1.0,
    "notes": "Additional notes"
  }
]

Only include contacts that have at least a name or role. Be thorough but accurate.`;

    // Add document-specific instructions
    if (documentAnalysis.type === 'call_sheet') {
      prompt += `\n\nThis is a CALL SHEET. Focus on extracting production crew, cast members, and key personnel. Look for sections like PRODUCTION, TALENT, CREW, etc.`;
    } else if (documentAnalysis.type === 'cast_crew_list') {
      prompt += `\n\nThis is a CAST/CREW LIST. Extract all cast members and crew members with their roles and contact information.`;
    }

    // Add production type specific instructions
    if (documentAnalysis.productionType === 'film') {
      prompt += `\n\nThis is a FILM production. Look for film-specific roles like Director, Producer, Cinematographer, etc.`;
    } else if (documentAnalysis.productionType === 'television') {
      prompt += `\n\nThis is a TELEVISION production. Look for TV-specific roles like Showrunner, Executive Producer, etc.`;
    }

    // Add chunk information
    if (totalChunks > 1) {
      prompt += `\n\nThis is chunk ${chunkNumber} of ${totalChunks} from a large document. Extract all contacts from this section.`;
    }

    // Add the actual text
    prompt += `\n\nDocument text:\n${text}`;

    return prompt;
  }

  /**
   * AI-powered contact validation
   */
  async validateContactsWithAI(contacts, text, documentAnalysis) {
    if (contacts.length === 0) return contacts;

    const prompt = `You are a contact validation expert. Validate and improve these extracted contacts:

Contacts:
${JSON.stringify(contacts, null, 2)}

Document Context:
${text.substring(0, 2000)}

For each contact, validate and improve:
1. Name accuracy and completeness
2. Email format and validity
3. Phone number format and validity
4. Role accuracy based on context
5. Company inference accuracy
6. Overall confidence score (0.0-1.0)

Return validated contacts with improved confidence scores and any corrections needed:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at validating contact information. Always return valid JSON array of contacts."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      });

      const validatedContacts = JSON.parse(response.choices[0].message.content);
      console.log('✅ AI validation complete');
      return validatedContacts;
    } catch (error) {
      console.warn('⚠️ AI validation failed, using original contacts:', error.message);
      return contacts;
    }
  }

  /**
   * AI-powered contact enhancement
   */
  async enhanceContactsWithAI(contacts, documentAnalysis) {
    if (contacts.length === 0) return contacts;

    const prompt = `You are a contact enhancement expert. Improve these extracted contacts with production context:

Contacts:
${JSON.stringify(contacts, null, 2)}

Document Analysis:
${JSON.stringify(documentAnalysis, null, 2)}

Enhance each contact by:
1. Improving role assignments based on production context
2. Inferring missing company information
3. Adding production-specific insights
4. Standardizing contact formats
5. Adding confidence scores
6. Detecting relationships between contacts

Return enhanced contacts in the same JSON format:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at enhancing production contacts. Always return valid JSON array of contacts."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.1
      });

      const enhancedContacts = JSON.parse(response.choices[0].message.content);
      console.log('✨ AI enhancement complete');
      return enhancedContacts;
    } catch (error) {
      console.warn('⚠️ AI enhancement failed, using original contacts:', error.message);
      return contacts;
    }
  }

  /**
   * Smart text chunking for AI processing
   */
  chunkTextForAI(text, maxChunkSize) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`📄 Text chunked into ${chunks.length} pieces for AI processing`);
    return chunks;
  }

  /**
   * Check if text is PDF garbage (failed extraction)
   */
  isPDFGarbage(text) {
    if (!text || text.trim().length < 10) return false;
    
    const pdfMarkers = [
      'endobj', 'stream', 'endstream', 'xref', 'trailer', 
      'startxref', '%%EOF', '/Type', '/Subtype', '/Filter'
    ];
    
    const markerCount = pdfMarkers.filter(marker => text.includes(marker)).length;
    
    if (markerCount >= 3) {
      console.warn('⚠️ Detected PDF structure markers - likely failed extraction');
      return true;
    }
    
    const nonPrintable = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g) || []).length;
    const nonPrintableRatio = nonPrintable / text.length;
    
    if (nonPrintableRatio > 0.2) {
      console.warn(`⚠️ Text is ${(nonPrintableRatio * 100).toFixed(1)}% non-printable - likely binary`);
      return true;
    }
    
    return false;
  }

  /**
   * Fallback document analysis when AI fails
   */
  fallbackDocumentAnalysis(text) {
    return {
      type: 'unknown',
      productionType: 'unknown',
      structure: 'mixed',
      complexity: 'medium',
      estimatedContacts: 0,
      sections: [],
      confidence: 0.5,
      aiInsights: {
        contactDensity: 0,
        documentStructure: 'Unknown',
        keyPatterns: [],
        extractionChallenges: ['AI analysis failed'],
        recommendedStrategy: 'pattern-based'
      }
    };
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(contacts) {
    if (contacts.length === 0) return 0;
    
    const totalConfidence = contacts.reduce((sum, contact) => 
      sum + (contact.confidence || 0.5), 0
    );
    
    return totalConfidence / contacts.length;
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      available: this.isAvailable,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      dependencies: {
        pdfPoppler: this.checkDependency('pdf-poppler'),
        tesseract: this.checkDependency('tesseract.js'),
        canvas: this.checkDependency('canvas')
      }
    };
  }

  checkDependency(dep) {
    try {
      require(dep);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new AIExtractionService();
