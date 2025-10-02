/**
 * Optimized AI Extraction Service
 * 
 * Enterprise-grade extraction optimized for GPT-4o Mini limitations:
 * - Smart token management (128k context window)
 * - Rate limiting compliance (3 RPM + 60k TPM)
 * - Cost optimization
 * - Intelligent chunking and batching
 * - Fallback strategies
 */

const { OpenAI } = require('openai');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

class OptimizedAIExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.isAvailable = !!process.env.OPENAI_API_KEY;
    
    // GPT-4o Mini specific limits
    this.limits = {
      contextWindow: 128000, // 128k tokens
      maxInputTokens: 120000, // Leave buffer for response
      maxOutputTokens: 4000, // 4k output tokens
      requestsPerMinute: 3,
      tokensPerMinute: 60000,
      costPerInputToken: 0.00015 / 1000, // $0.00015 per 1k tokens
      costPerOutputToken: 0.0006 / 1000  // $0.0006 per 1k tokens
    };
    
    // Rate limiting state
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.tokensUsedThisMinute = 0;
    this.minuteStartTime = Date.now();
    
    if (!this.isAvailable) {
      console.warn('⚠️ OpenAI API key not found - AI extraction will be disabled');
    } else {
      console.log('🤖 Optimized AI Extraction Service initialized with GPT-4o Mini');
      console.log(`  - Context Window: ${this.limits.contextWindow.toLocaleString()} tokens`);
      console.log(`  - Rate Limits: ${this.limits.requestsPerMinute} RPM, ${this.limits.tokensPerMinute.toLocaleString()} TPM`);
    }
  }

  /**
   * Main optimized extraction method
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    if (!this.isAvailable) {
      throw new Error('AI extraction service is not available - OpenAI API key required');
    }

    try {
      console.log('🚀 Starting optimized AI extraction...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Extract and preprocess text
      const extractedText = await this.extractTextFromDocument(fileBuffer, mimeType, fileName);
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      console.log('📄 Text extracted, length:', extractedText.length);

      // Step 2: Calculate token usage and plan strategy
      const tokenEstimate = Math.ceil(extractedText.length / 4); // Rough estimate: 4 chars = 1 token
      console.log(`📊 Estimated tokens: ${tokenEstimate.toLocaleString()}`);

      // Step 3: Choose optimal processing strategy
      const strategy = this.chooseProcessingStrategy(extractedText, tokenEstimate, options);
      console.log('🎯 Processing strategy:', strategy);

      let result;
      switch (strategy) {
        case 'single-pass':
          result = await this.singlePassExtraction(extractedText, fileName, options);
          break;
        case 'chunked-processing':
          result = await this.chunkedProcessingExtraction(extractedText, fileName, options);
          break;
        case 'hierarchical-processing':
          result = await this.hierarchicalProcessingExtraction(extractedText, fileName, options);
          break;
        default:
          throw new Error(`Unknown processing strategy: ${strategy}`);
      }

      // Step 4: Post-process and validate results
      const finalResult = await this.postProcessResults(result, extractedText, options);

      console.log(`✅ Optimized AI extraction completed: ${finalResult.contacts.length} contacts found`);
      console.log(`💰 Estimated cost: $${finalResult.metadata.estimatedCost.toFixed(4)}`);

      return finalResult;

    } catch (error) {
      console.error('❌ Optimized AI extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: [],
        metadata: {
          extractionMethod: 'optimized-ai-failed',
          processingTime: Date.now(),
          estimatedCost: 0
        }
      };
    }
  }

  /**
   * Choose optimal processing strategy based on document size and complexity
   */
  chooseProcessingStrategy(text, tokenEstimate, options) {
    // Force single strategy if specified
    if (options.strategy) {
      return options.strategy;
    }

    // Single pass for small documents
    if (tokenEstimate <= this.limits.maxInputTokens * 0.8) {
      return 'single-pass';
    }

    // Chunked processing for medium documents
    if (tokenEstimate <= this.limits.maxInputTokens * 2) {
      return 'chunked-processing';
    }

    // Hierarchical processing for large documents
    return 'hierarchical-processing';
  }

  /**
   * Single pass extraction for small documents
   */
  async singlePassExtraction(text, fileName, options) {
    console.log('🔄 Single pass extraction...');
    
    const prompt = this.buildOptimizedPrompt(text, options);
    const response = await this.makeAPICall(prompt);
    
    const contacts = JSON.parse(response.choices[0].message.content);
    const cost = this.calculateCost(prompt, response);
    
    return {
      success: true,
      contacts: contacts,
      metadata: {
        extractionMethod: 'single-pass',
        processingTime: Date.now(),
        estimatedCost: cost,
        tokensUsed: this.estimateTokens(prompt) + this.estimateTokens(response.choices[0].message.content)
      }
    };
  }

  /**
   * Chunked processing for medium documents
   */
  async chunkedProcessingExtraction(text, fileName, options) {
    console.log('🔄 Chunked processing extraction...');
    
    // Split text into optimal chunks
    const chunks = this.createOptimalChunks(text);
    console.log(`📚 Split into ${chunks.length} chunks`);
    
    let allContacts = [];
    let totalCost = 0;
    let totalTokens = 0;
    
    // Process chunks sequentially to respect rate limits
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🤖 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
      
      // Wait for rate limit if needed
      await this.waitForRateLimit();
      
      const prompt = this.buildChunkPrompt(chunk, i + 1, chunks.length, options);
      const response = await this.makeAPICall(prompt);
      
      const chunkContacts = JSON.parse(response.choices[0].message.content);
      allContacts = allContacts.concat(chunkContacts);
      
      const cost = this.calculateCost(prompt, response);
      totalCost += cost;
      totalTokens += this.estimateTokens(prompt) + this.estimateTokens(response.choices[0].message.content);
      
      console.log(`✅ Chunk ${i + 1} completed: ${chunkContacts.length} contacts, $${cost.toFixed(4)}`);
    }
    
    // Deduplicate contacts
    const uniqueContacts = this.deduplicateContacts(allContacts);
    
    return {
      success: true,
      contacts: uniqueContacts,
      metadata: {
        extractionMethod: 'chunked-processing',
        processingTime: Date.now(),
        estimatedCost: totalCost,
        tokensUsed: totalTokens,
        chunksProcessed: chunks.length
      }
    };
  }

  /**
   * Hierarchical processing for large documents
   */
  async hierarchicalProcessingExtraction(text, fileName, options) {
    console.log('🔄 Hierarchical processing extraction...');
    
    // Step 1: Document overview analysis
    const overviewText = this.createDocumentOverview(text);
    const overviewPrompt = this.buildOverviewPrompt(overviewText, options);
    
    await this.waitForRateLimit();
    const overviewResponse = await this.makeAPICall(overviewPrompt);
    const overview = JSON.parse(overviewResponse.choices[0].message.content);
    
    console.log('📋 Document overview:', overview);
    
    // Step 2: Process key sections identified in overview
    const keySections = this.extractKeySections(text, overview.keySections || []);
    let allContacts = [];
    let totalCost = this.calculateCost(overviewPrompt, overviewResponse);
    let totalTokens = this.estimateTokens(overviewPrompt) + this.estimateTokens(overviewResponse.choices[0].message.content);
    
    for (let i = 0; i < keySections.length; i++) {
      const section = keySections[i];
      console.log(`🔍 Processing section: ${section.name}`);
      
      await this.waitForRateLimit();
      
      const sectionPrompt = this.buildSectionPrompt(section.text, section.name, options);
      const sectionResponse = await this.makeAPICall(sectionPrompt);
      
      const sectionContacts = JSON.parse(sectionResponse.choices[0].message.content);
      allContacts = allContacts.concat(sectionContacts);
      
      const cost = this.calculateCost(sectionPrompt, sectionResponse);
      totalCost += cost;
      totalTokens += this.estimateTokens(sectionPrompt) + this.estimateTokens(sectionResponse.choices[0].message.content);
      
      console.log(`✅ Section completed: ${sectionContacts.length} contacts, $${cost.toFixed(4)}`);
    }
    
    // Deduplicate contacts
    const uniqueContacts = this.deduplicateContacts(allContacts);
    
    return {
      success: true,
      contacts: uniqueContacts,
      metadata: {
        extractionMethod: 'hierarchical-processing',
        processingTime: Date.now(),
        estimatedCost: totalCost,
        tokensUsed: totalTokens,
        sectionsProcessed: keySections.length
      }
    };
  }

  /**
   * Build optimized prompt for single pass
   */
  buildOptimizedPrompt(text, options) {
    return `Extract contact information from this production document. Return ONLY a JSON array of contacts:

[
  {
    "name": "Full Name",
    "role": "Job Title",
    "email": "email@example.com",
    "phone": "phone number",
    "company": "Company Name",
    "confidence": 0.0-1.0
  }
]

Document:
${text}`;
  }

  /**
   * Build prompt for chunk processing
   */
  buildChunkPrompt(chunk, chunkNumber, totalChunks, options) {
    return `Extract contact information from this document chunk (${chunkNumber}/${totalChunks}). Return ONLY a JSON array of contacts:

[
  {
    "name": "Full Name",
    "role": "Job Title", 
    "email": "email@example.com",
    "phone": "phone number",
    "company": "Company Name",
    "confidence": 0.0-1.0
  }
]

Chunk ${chunkNumber}:
${chunk}`;
  }

  /**
   * Build overview prompt for hierarchical processing
   */
  buildOverviewPrompt(text, options) {
    return `Analyze this production document and identify key sections containing contact information. Return ONLY JSON:

{
  "documentType": "call_sheet|contact_list|production_document",
  "keySections": ["CREW", "TALENT", "PRODUCTION", "CLIENTS"],
  "estimatedContacts": number,
  "complexity": "low|medium|high"
}

Document:
${text}`;
  }

  /**
   * Build section prompt for hierarchical processing
   */
  buildSectionPrompt(sectionText, sectionName, options) {
    return `Extract contact information from this ${sectionName} section. Return ONLY a JSON array of contacts:

[
  {
    "name": "Full Name",
    "role": "Job Title",
    "email": "email@example.com", 
    "phone": "phone number",
    "company": "Company Name",
    "confidence": 0.0-1.0
  }
]

${sectionName} Section:
${sectionText}`;
  }

  /**
   * Create optimal chunks for processing
   */
  createOptimalChunks(text) {
    const maxChunkSize = this.limits.maxInputTokens * 4; // 4 chars per token estimate
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
    
    return chunks;
  }

  /**
   * Create document overview for hierarchical processing
   */
  createDocumentOverview(text) {
    // Take first 20% and last 20% of document for overview
    const textLength = text.length;
    const overviewLength = Math.floor(textLength * 0.2);
    
    const beginning = text.substring(0, overviewLength);
    const end = text.substring(textLength - overviewLength);
    
    return `${beginning}\n\n[... middle section ...]\n\n${end}`;
  }

  /**
   * Extract key sections based on overview
   */
  extractKeySections(text, keySections) {
    const sections = [];
    const lines = text.split('\n');
    
    for (const sectionName of keySections) {
      const sectionLines = [];
      let inSection = false;
      
      for (const line of lines) {
        if (line.toUpperCase().includes(sectionName.toUpperCase())) {
          inSection = true;
          continue;
        }
        
        if (inSection) {
          // Check if we hit another section header
          const isNewSection = keySections.some(name => 
            name !== sectionName && line.toUpperCase().includes(name.toUpperCase())
          );
          
          if (isNewSection) {
            break;
          }
          
          sectionLines.push(line);
        }
      }
      
      if (sectionLines.length > 0) {
        sections.push({
          name: sectionName,
          text: sectionLines.join('\n')
        });
      }
    }
    
    return sections;
  }

  /**
   * Make API call with rate limiting
   */
  async makeAPICall(prompt) {
    // Wait for rate limit if needed
    await this.waitForRateLimit();
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting contact information from production documents. Always return valid JSON array of contacts."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: this.limits.maxOutputTokens,
      temperature: 0.1
    });
    
    // Update rate limiting state
    this.lastRequestTime = Date.now();
    this.tokensUsedThisMinute += this.estimateTokens(prompt) + this.estimateTokens(response.choices[0].message.content);
    
    return response;
  }

  /**
   * Wait for rate limit if needed
   */
  async waitForRateLimit() {
    const now = Date.now();
    
    // Reset minute counter if needed
    if (now - this.minuteStartTime >= 60000) {
      this.tokensUsedThisMinute = 0;
      this.minuteStartTime = now;
    }
    
    // Wait for RPM limit (20 seconds between requests)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 20000) {
      const waitTime = 20000 - timeSinceLastRequest;
      console.log(`⏳ Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Wait for TPM limit if needed
    if (this.tokensUsedThisMinute >= this.limits.tokensPerMinute) {
      const waitTime = 60000 - (now - this.minuteStartTime);
      if (waitTime > 0) {
        console.log(`⏳ Waiting ${waitTime}ms for token limit...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.tokensUsedThisMinute = 0;
        this.minuteStartTime = Date.now();
      }
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // 4 characters ≈ 1 token
  }

  /**
   * Calculate cost of API call
   */
  calculateCost(prompt, response) {
    const inputTokens = this.estimateTokens(prompt);
    const outputTokens = this.estimateTokens(response.choices[0].message.content);
    
    const inputCost = inputTokens * this.limits.costPerInputToken;
    const outputCost = outputTokens * this.limits.costPerOutputToken;
    
    return inputCost + outputCost;
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
        seen.set(key, true);
        unique.push(contact);
      }
    }
    
    return unique;
  }

  /**
   * Get unique key for contact deduplication
   */
  getContactKey(contact) {
    const email = contact.email?.toLowerCase() || '';
    const phone = contact.phone?.replace(/\D/g, '') || '';
    const name = contact.name?.toLowerCase().replace(/\s+/g, '') || '';
    
    if (email) return `email:${email}`;
    if (phone) return `phone:${phone}`;
    if (name) return `name:${name}`;
    return `unknown:${Math.random()}`;
  }

  /**
   * Post-process results
   */
  async postProcessResults(result, originalText, options) {
    // Add confidence scores if missing
    result.contacts = result.contacts.map(contact => ({
      ...contact,
      confidence: contact.confidence || this.calculateConfidence(contact)
    }));
    
    // Filter low-confidence contacts if requested
    if (options.minConfidence) {
      result.contacts = result.contacts.filter(contact => 
        contact.confidence >= options.minConfidence
      );
    }
    
    return result;
  }

  /**
   * Calculate confidence score for contact
   */
  calculateConfidence(contact) {
    let score = 0;
    
    if (contact.name && contact.name.length > 2) score += 0.3;
    if (contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) score += 0.3;
    if (contact.phone && contact.phone.length >= 10) score += 0.2;
    if (contact.role && contact.role.length > 0) score += 0.1;
    if (contact.company && contact.company.length > 0) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Extract text from document
   */
  async extractTextFromDocument(fileBuffer, mimeType, fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();
    
    if (mimeType === 'application/pdf' || fileExtension === '.pdf') {
      try {
        const pdfjsModule = await import('pdfjs-dist');
        const pdfjs = pdfjsModule.default || pdfjsModule;
        const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }
        
        return fullText.trim();
      } catch (error) {
        console.warn('⚠️ PDF processing failed:', error.message);
        return fileBuffer.toString('utf-8');
      }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
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
   * Get service health status
   */
  getHealthStatus() {
    return {
      available: this.isAvailable,
      limits: this.limits,
      rateLimitStatus: {
        tokensUsedThisMinute: this.tokensUsedThisMinute,
        tokensRemaining: this.limits.tokensPerMinute - this.tokensUsedThisMinute,
        timeUntilReset: Math.max(0, 60000 - (Date.now() - this.minuteStartTime))
      }
    };
  }
}

module.exports = new OptimizedAIExtractionService();
