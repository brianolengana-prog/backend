/**
 * Clean Extraction Service
 * 
 * A unified, robust extraction system that combines:
 * - Document processing (PDF, DOCX, XLSX, images, etc.)
 * - Adaptive pattern recognition
 * - AI-enhanced extraction
 * - Clean, maintainable architecture
 */

const fs = require('fs').promises;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

class ExtractionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.libraries = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // Initialize libraries
    this.initializeLibraries().catch(error => {
      console.error('❌ Failed to initialize extraction libraries:', error.message);
    });
  }

  /**
   * Initialize all required libraries
   */
  async initializeLibraries() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._loadLibraries();
    await this.initializationPromise;
    this.isInitialized = true;
    
    return this.initializationPromise;
  }

  async _loadLibraries() {
    const libraryConfigs = [
      { name: 'pdfjs', module: 'pdfjs-dist', required: true },
      { name: 'mammoth', module: 'mammoth', required: true },
      { name: 'xlsx', module: 'xlsx', required: true },
      { name: 'tesseract', module: 'tesseract.js', required: false }
    ];

    const loadPromises = libraryConfigs.map(async ({ name, module, required }) => {
      try {
        let lib;
        if (name === 'pdfjs') {
          // pdfjs-dist is ESM, so we need to use dynamic import
          const pdfjsModule = await import(module);
          lib = pdfjsModule.default || pdfjsModule;
        } else {
          lib = require(module);
        }
        this.libraries.set(name, lib);
        console.log(`✅ ${name} library loaded successfully`);
        return { name, success: true };
      } catch (error) {
        if (required) {
          console.error(`❌ Required library ${name} failed to load:`, error.message);
          throw new Error(`Required library ${name} not available: ${error.message}`);
        } else {
          console.warn(`⚠️ Optional library ${name} not available:`, error.message);
          return { name, success: false, error: error.message };
        }
      }
    });

    const results = await Promise.allSettled(loadPromises);
    const failures = results.filter(result => result.status === 'rejected');
    
    if (failures.length > 0) {
      console.error('❌ Some required libraries failed to load:', failures);
      throw new Error('Failed to load required extraction libraries');
    }

    console.log('✅ All extraction libraries initialized successfully');
  }

  /**
   * Ensure library is loaded before use
   */
  async ensureLibrary(libraryName, required = true) {
    if (this.libraries.has(libraryName)) {
      return this.libraries.get(libraryName);
    }

    if (this.initializationPromise && !this.isInitialized) {
      await this.initializationPromise;
      if (this.libraries.has(libraryName)) {
        return this.libraries.get(libraryName);
      }
    }

    try {
      const libraryConfigs = {
        pdfjs: 'pdfjs-dist',
        mammoth: 'mammoth',
        xlsx: 'xlsx',
        tesseract: 'tesseract.js'
      };

      const moduleName = libraryConfigs[libraryName];
      if (!moduleName) {
        throw new Error(`Unknown library: ${libraryName}`);
      }

      const lib = require(moduleName);
      this.libraries.set(libraryName, lib);
      console.log(`✅ ${libraryName} library loaded on-demand`);
      return lib;
    } catch (error) {
      const message = `${libraryName} processing library not available: ${error.message}`;
      if (required) {
        throw new Error(message);
      } else {
        console.warn(`⚠️ ${message}`);
        return null;
      }
    }
  }

  /**
   * Main extraction method - processes file and extracts contacts
   */
  async extractContacts(fileBuffer, mimeType, fileName, options = {}) {
    try {
      console.log('🚀 Starting extraction process...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Extract text from document
      const extractedText = await this.processFile(fileBuffer, mimeType, fileName);
      
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error('Could not extract meaningful text from document');
      }

      console.log('📄 Text extracted, length:', extractedText.length);

      // Step 2: Analyze document structure
      const documentAnalysis = this.analyzeDocumentStructure(extractedText);
      console.log('📊 Document analysis:', documentAnalysis);

      // Step 3: Extract contacts using adaptive patterns
      const contacts = await this.extractContactsFromText(extractedText, documentAnalysis, options);

      // Step 4: Validate and clean contacts
      const validatedContacts = this.validateContacts(contacts);

      // Step 5: Calculate confidence scores
      const scoredContacts = this.calculateConfidenceScores(validatedContacts);

      console.log(`✅ Extraction completed: ${scoredContacts.length} contacts found`);

      return {
        success: true,
        contacts: scoredContacts,
        metadata: {
          documentType: documentAnalysis.type,
          productionType: documentAnalysis.productionType,
          extractionMethod: 'adaptive-pattern',
          processingTime: Date.now(),
          confidence: this.calculateOverallConfidence(scoredContacts)
        }
      };

    } catch (error) {
      console.error('❌ Extraction failed:', error);
      return {
        success: false,
        error: error.message,
        contacts: []
      };
    }
  }

  /**
   * Process file and extract text based on file type
   */
  async processFile(fileBuffer, mimeType, fileName) {
    try {
      console.log(`📄 Processing file: ${fileName} (${mimeType})`);
      
      // Check file size limits
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (fileBuffer.length > maxFileSize) {
        throw new Error(`File too large: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. Maximum allowed size is 50MB.`);
      }
      
      // Ensure libraries are loaded
      await this.initializeLibraries();
      
      const fileExtension = path.extname(fileName).toLowerCase();
      let extractedText = '';

      // Use the unified extraction method
      extractedText = await this.extractTextFromDocument(fileBuffer, mimeType);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      console.log(`✅ File processed successfully: ${extractedText.length} characters extracted`);
      return extractedText.trim();

    } catch (error) {
      console.error('❌ File processing error:', error);
      throw new Error(`File processing failed: ${error.message}`);
    }
  }

  /**
   * Get file type from MIME type
   */
  getFileTypeFromMimeType(mimeType) {
    const mimeTypeMap = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'text/csv': 'csv',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'text/plain': 'text'
    };
    return mimeTypeMap[mimeType] || 'text';
  }

  /**
   * Extract text from any document type
   */
  async extractTextFromDocument(fileBuffer, mimeType) {
    const fileType = this.getFileTypeFromMimeType(mimeType);
    
    switch (fileType) {
      case 'pdf':
        return await this.extractTextFromPDF(fileBuffer);
      case 'docx':
        return await this.extractTextFromDOCX(fileBuffer);
      case 'xlsx':
        return await this.extractTextFromXLSX(fileBuffer);
      case 'xls':
        return await this.extractTextFromXLS(fileBuffer);
      case 'csv':
        return await this.extractTextFromCSV(fileBuffer);
      case 'image':
        return await this.extractTextFromImage(fileBuffer);
      case 'text':
        return await this.extractTextFromPlainText(fileBuffer);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Extract text from PDF documents
   */
  async extractTextFromPDF(buffer) {
    const pdfjs = await this.ensureLibrary('pdfjs', true);
    
    try {
      // Ensure we have a proper Uint8Array for pdfjs
      let uint8Array;
      if (buffer instanceof Uint8Array) {
        uint8Array = buffer;
      } else if (buffer instanceof Buffer) {
        uint8Array = new Uint8Array(buffer);
      } else {
        uint8Array = new Uint8Array(buffer);
      }
      
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
      
      console.log('📄 PDF processed successfully');
      return fullText.trim();
    } catch (error) {
      console.error('❌ PDF processing error:', error.message);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX documents
   */
  async extractTextFromDOCX(buffer) {
    const mammoth = await this.ensureLibrary('mammoth', true);
    
    try {
      const result = await mammoth.extractRawText({ buffer });
      console.log('📄 DOCX processed successfully');
      return result.value;
    } catch (error) {
      throw new Error(`DOCX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from XLSX documents
   */
  async extractTextFromXLSX(buffer) {
    const xlsx = await this.ensureLibrary('xlsx', true);
    
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      const headerAliases = {
        name: ['name', 'full name', 'contact name', 'first name', 'last name'],
        role: ['role', 'position', 'title', 'job', 'type of artist'],
        email: ['email', 'e-mail', 'mail'],
        phone: ['phone', 'mobile', 'cell', 'tel', 'telephone']
      };
      const normalizeHeader = (h) => h.toLowerCase().trim();
      const matchHeader = (h) => {
        const key = normalizeHeader(h);
        for (const [field, aliases] of Object.entries(headerAliases)) {
          if (aliases.includes(key)) return field;
        }
        return null;
      };
      
      // Process only first 3 sheets to avoid timeout on large files
      const maxSheets = 3;
      const sheetsToProcess = workbook.SheetNames.slice(0, maxSheets);
      
      for (const sheetName of sheetsToProcess) {
        const worksheet = workbook.Sheets[sheetName];
        // Prefer structured CSV-like text but ensure we include headers
        const json = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!json || json.length === 0) continue;
        
        const headerRow = json[0].map(String);
        const mapped = headerRow.map(h => matchHeader(h) || normalizeHeader(h));
        
        // Process only first 1000 rows to avoid timeout
        const maxRows = 1000;
        const rows = json.slice(1, 1 + maxRows);
        const lines = rows.map(r => r.map(c => String(c)).join('\t')).join('\n');
        
        if (lines.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${headerRow.join('\t')}\n${lines}\n`;
        }
      }
      
      if (workbook.SheetNames.length > maxSheets) {
        fullText += `\n--- Note: ${workbook.SheetNames.length - maxSheets} additional sheets skipped for performance ---\n`;
      }
      
      console.log('📊 XLSX processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`XLSX processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from legacy XLS documents
   */
  async extractTextFromXLS(buffer) {
    const xlsx = await this.ensureLibrary('xlsx', true);
    
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetText = xlsx.utils.sheet_to_txt(worksheet);
        if (sheetText.trim()) {
          fullText += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n`;
        }
      });
      
      console.log('📊 XLS processed successfully');
      return fullText.trim();
    } catch (error) {
      throw new Error(`XLS processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from CSV documents
   */
  async extractTextFromCSV(buffer) {
    try {
      const text = buffer.toString('utf-8');
      console.log('📄 CSV processed successfully');
      return text;
    } catch (error) {
      throw new Error(`CSV processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from images using OCR
   */
  async extractTextFromImage(buffer) {
    const tesseract = await this.ensureLibrary('tesseract', false);
    
    if (!tesseract) {
      throw new Error('OCR processing not available - tesseract.js library not loaded');
    }
    
    try {
      const { data: { text } } = await tesseract.recognize(buffer);
      console.log('📄 Image OCR processed successfully');
      return text.trim();
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractTextFromPlainText(buffer) {
    try {
      const text = buffer.toString('utf-8');
      console.log('📄 Plain text processed successfully');
      return text;
    } catch (error) {
      throw new Error(`Plain text processing failed: ${error.message}`);
    }
  }

  /**
   * Analyze document structure to optimize extraction
   */
  analyzeDocumentStructure(text) {
    const analysis = {
      type: 'unknown',
      productionType: 'unknown',
      hasTableStructure: false,
      hasContactSections: false,
      estimatedContacts: 0,
      complexity: 'low'
    };

    // Detect document type
    if (text.includes('CALL SHEET') || text.includes('Call Sheet')) {
      analysis.type = 'call_sheet';
    } else if (text.includes('PRODUCTION') || text.includes('Production')) {
      analysis.type = 'production_document';
    } else if (text.includes('CAST') || text.includes('CREW')) {
      analysis.type = 'cast_crew_list';
    } else if (text.includes('CONTACTS') || text.includes('Contacts')) {
      analysis.type = 'contact_list';
    }

    // Detect production type
    if (text.includes('FILM') || text.includes('MOVIE') || text.includes('Film')) {
      analysis.productionType = 'film';
    } else if (text.includes('TV') || text.includes('TELEVISION') || text.includes('SERIES')) {
      analysis.productionType = 'television';
    } else if (text.includes('COMMERCIAL') || text.includes('Commercial')) {
      analysis.productionType = 'commercial';
    } else if (text.includes('DOCUMENTARY') || text.includes('Documentary')) {
      analysis.productionType = 'documentary';
    }

    // Detect table structure
    const tableIndicators = ['|', '\t', 'Name\t', 'Role\t', 'Email\t', 'Phone\t'];
    analysis.hasTableStructure = tableIndicators.some(indicator => text.includes(indicator));

    // Detect contact sections
    const contactSectionIndicators = ['PRODUCTION', 'TALENT', 'CREW', 'CLIENTS', 'CONTACTS', 'CAST'];
    analysis.hasContactSections = contactSectionIndicators.some(indicator => 
      text.toUpperCase().includes(indicator)
    );

    // Estimate number of contacts
    const emailMatches = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    analysis.estimatedContacts = emailMatches ? emailMatches.length : 0;

    // Determine complexity
    if (text.length > 10000 || analysis.estimatedContacts > 20) {
      analysis.complexity = 'high';
    } else if (text.length > 3000 || analysis.estimatedContacts > 10) {
      analysis.complexity = 'medium';
    }

    return analysis;
  }

  /**
   * Extract contacts from text using adaptive patterns
   */
  async extractContactsFromText(text, documentAnalysis, options = {}) {
    const contacts = [];
    const lines = text.split('\n');
    
    console.log('🔍 Processing', lines.length, 'lines for contact extraction');

    // Pattern library for different contact formats
    const patterns = [
      // Pattern 1: Role: Name / Company Agent / Phone
      {
        regex: /^([^:]+):\s*([A-Z\s]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/i,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          company: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 2: Role: Name / Phone (simple format)
      {
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/,
        extract: (match) => {
          // Check if this is the complex format (Name / Company / Phone)
          if (match[2].includes('/') && match[3].includes('/')) {
            return null; // Let pattern 2.5 handle this
          }
          return {
            role: match[1].trim(),
            name: this.normalizeName(match[2]),
            phone: this.extractPhone(match[3]),
            confidence: 0.85
          };
        }
      },
      // Pattern 2.5: Role: Name / Company / Phone (for call sheets)
      {
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          company: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 2.6: Role: Name1 / Name2 / Phone (for models with agents)
      {
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/,
        extract: (match) => {
          const role = match[1].trim();
          const name1 = this.normalizeName(match[2]);
          const name2 = this.normalizeName(match[3]);
          const phone = this.extractPhone(match[4]);
          
          // Return both contacts if both have names
          if (name1 && name2) {
            return [
              {
                role: role,
                name: name1,
                phone: phone,
                confidence: 0.85
              },
              {
                role: `${role} Agent`,
                name: name2,
                phone: phone,
                confidence: 0.85
              }
            ];
          } else {
            return {
              role: role,
              name: name1 || name2,
              phone: phone,
              confidence: 0.85
            };
          }
        }
      },
      // Pattern 3: Name | Email | Phone | Role
      {
        regex: /^([^|]+)\|([^|]+)\|([^|]+)\|(.+)$/,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          email: this.extractEmail(match[2]),
          phone: this.extractPhone(match[3]),
          role: match[4].trim(),
          confidence: 0.9
        })
      },
      // Pattern 3b: Name | Company | Role | Email | Phone
      {
        regex: /^([^|]+)\|([^|]+)\|([^|]+)\|([^|\s]+@[^|\s]+)\|(.+)$/,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          company: match[2].trim(),
          role: match[3].trim(),
          email: match[4].trim(),
          phone: this.extractPhone(match[5]),
          confidence: 0.9
        })
      },
      // Pattern 3c: Tab-delimited: Name\tRole\tEmail\tPhone
      {
        regex: /^([^\t]+)\t([^\t]+)\t([^\t\s]+@[^\t\s]+)\t(.+)$/,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          role: match[2].trim(),
          email: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 4: Name    Email    Phone (whitespace separated)
      {
        regex: /^([A-Z][A-Za-z\s'-]+)\s{2,}([^\s]+@[^\s]+)\s{2,}(.+)$/,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          email: match[2].trim(),
          phone: this.extractPhone(match[3]),
          confidence: 0.8
        })
      },
      // Pattern 5: Email with name and phone on same line
      {
        regex: /([A-Za-z\s'-]+)\s*[<(]?\s*([^\s@]+@[^\s>)]+)\s*[>)]?\s*(.+)/,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          email: match[2].trim(),
          phone: this.extractPhone(match[3]),
          confidence: 0.75
        })
      }
    ];

    // Skip patterns (non-contact lines)
    const skipPatterns = [
      /^(Call Time|Location|Date|Shoot Date|Project|Client|Agency):/i,
      /^(Note|Notes|Important|Please|Contact for|Send to):/i,
      /^\d{1,2}:\d{2}\s*(AM|PM)/i,
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
      /^[\d\s\-\/]+$/,
      /^(Table|Row|Column|Page)/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and headers
      if (!line || this.shouldSkipLine(line, skipPatterns)) continue;
      
      // Try each pattern in order
      let contactFound = false;
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const contact = pattern.extract(match);
          
          // Handle both single contact and array of contacts
          const contactsToAdd = Array.isArray(contact) ? contact : [contact];
          
          for (const contactItem of contactsToAdd) {
            if (this.isValidContact(contactItem)) {
              contactItem.lineNumber = i + 1;
              contactItem.rawLine = line;
              contacts.push(contactItem);
              contactFound = true;
            }
          }
          
          if (contactFound) break;
        }
      }
      
      // If no pattern matched, try general extraction
      if (!contactFound) {
        const contact = this.extractGeneralContact(line, i + 1);
        if (contact && this.isValidContact(contact)) {
          contacts.push(contact);
        }
      }
    }

    console.log(`🔍 Found ${contacts.length} contacts using pattern matching`);
    return contacts;
  }

  /**
   * Check if line should be skipped
   */
  shouldSkipLine(line, skipPatterns) {
    return skipPatterns.some(pattern => pattern.test(line));
  }

  /**
   * General contact extraction from a single line
   */
  extractGeneralContact(line, lineNumber) {
    const email = this.extractEmail(line);
    const phone = this.extractPhone(line);
    const name = this.extractNameFromLine(line);
    const role = this.inferRole(line);
    
    if (!name && !email && !phone) return null;
    
    return {
      name: name || '',
      email: email || '',
      phone: phone || '',
      role: role || '',
      lineNumber: lineNumber,
      rawLine: line,
      confidence: (name ? 0.3 : 0) + (email ? 0.3 : 0) + (phone ? 0.2 : 0)
    };
  }

  /**
   * Extract name from line
   */
  extractNameFromLine(line) {
    // Remove email and phone to isolate name
    let cleaned = line
      .replace(/@[^\s]+/g, '')
      .replace(/\+?[\d\s\-().]{10,}/g, '')
      .replace(/^([^:]+):\s*/, ''); // Remove role prefix
    
    // Try different name patterns
    
    // 1. ALL CAPS name (2+ words)
    const allCapsMatch = cleaned.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})+)\b/);
    if (allCapsMatch) {
      return this.normalizeName(allCapsMatch[1]);
    }
    
    // 2. Title case name
    const titleCaseMatch = cleaned.match(/\b([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)+)\b/);
    if (titleCaseMatch) {
      return this.normalizeName(titleCaseMatch[1]);
    }
    
    // 3. Before slash/pipe/dash
    const beforeDelim = cleaned.split(/[\/|–—-]/)[0].trim();
    if (beforeDelim && this.looksLikeName(beforeDelim)) {
      return this.normalizeName(beforeDelim);
    }
    
    return null;
  }

  /**
   * Check if text looks like a name
   */
  looksLikeName(text) {
    if (text.length < 2) return false;
    if (!/^[A-Za-z]/.test(text)) return false;
    
    const nonNameWords = ['AM', 'PM', 'TBD', 'TBA', 'N/A', 'None', 'Remote', 'Location'];
    if (nonNameWords.includes(text.trim())) return false;
    
    const digitCount = (text.match(/\d/g) || []).length;
    if (digitCount > text.length / 2) return false;
    
    return true;
  }

  /**
   * Normalize name (handle ALL CAPS, Title Case, etc.)
   */
  normalizeName(name) {
    if (!name) return '';
    
    const cleaned = name.trim();
    
    // Check if ALL CAPS
    if (cleaned === cleaned.toUpperCase() && cleaned.match(/[A-Z]/)) {
      return cleaned
        .split(/\s+/)
        .map(word => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    return cleaned;
  }

  /**
   * Extract email from text
   */
  extractEmail(text) {
    const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }

  /**
   * Extract phone from text
   */
  extractPhone(text) {
    const match = text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (!match) return null;
    
    // Format as (XXX) XXX-XXXX
    const digits = match[0].replace(/\D/g, '');
    const cleaned = digits.startsWith('1') ? digits.substring(1) : digits;
    
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    
    return match[0];
  }

  /**
   * Infer role from line
   */
  inferRole(line) {
    // Check for role prefix (e.g., "Photographer: ...")
    const rolePrefix = line.match(/^([^:]+):/);
    if (rolePrefix) {
      return rolePrefix[1].trim();
    }
    
    // Check for role keywords
    const roleKeywords = {
      'photographer': 'Photographer',
      'photo assistant': 'Photo Assistant',
      'digitech': 'Digital Technician',
      'videographer': 'Videographer',
      'director': 'Director',
      'producer': 'Producer',
      'model': 'Model',
      'casting': 'Casting Director',
      'makeup': 'Makeup Artist',
      'mua': 'Makeup Artist',
      'hair': 'Hair Artist',
      'hua': 'Hair Artist',
      'hmua': 'Hair & Makeup Artist',
      'stylist': 'Stylist',
      'assistant': 'Production Assistant',
      'driver': 'Driver'
    };
    
    const lineLower = line.toLowerCase();
    for (const [keyword, role] of Object.entries(roleKeywords)) {
      if (lineLower.includes(keyword)) {
        return role;
      }
    }
    
    return '';
  }

  /**
   * Check if contact has minimum required information
   */
  isValidContact(contact) {
    return (contact.name && contact.name.length > 1) || 
           (contact.email || contact.phone);
  }

  /**
   * Validate and clean contacts
   */
  validateContacts(contacts) {
    return contacts
      .filter(contact => this.isValidContact(contact))
      .map(contact => ({
        name: contact.name?.trim() || '',
        email: contact.email?.trim() || '',
        phone: contact.phone?.trim() || '',
        role: contact.role?.trim() || '',
        company: contact.company?.trim() || '',
        confidence: contact.confidence || 0.5,
        lineNumber: contact.lineNumber,
        rawLine: contact.rawLine
      }));
  }

  /**
   * Calculate confidence scores for contacts
   */
  calculateConfidenceScores(contacts) {
    return contacts.map(contact => {
      let score = 0;
      
      if (contact.name && contact.name.length > 2) score += 0.3;
      if (contact.name && contact.name.includes(' ')) score += 0.1; // Full name
      if (contact.email) score += 0.3;
      if (contact.phone) score += 0.2;
      if (contact.role) score += 0.1;
      
      return {
        ...contact,
        confidence: Math.min(score, 1.0)
      };
    });
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
   * Save contacts to database
   */
  async saveContacts(contacts, userId, jobId) {
    try {
      const contactsToSave = contacts.map(contact => ({
        name: contact.name || 'Unknown',
        email: contact.email || null,
        phone: contact.phone || null,
        role: contact.role || null,
        company: contact.company || null,
        isSelected: true,
        jobId: jobId,
        userId: userId
      }));

      await this.prisma.contact.createMany({
        data: contactsToSave,
        skipDuplicates: true
      });

      console.log(`✅ Saved ${contacts.length} contacts to database`);
      return true;
    } catch (error) {
      console.error('❌ Failed to save contacts to database:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      libraries: {
        pdfjs: this.libraries.has('pdfjs'),
        mammoth: this.libraries.has('mammoth'),
        xlsx: this.libraries.has('xlsx'),
        tesseract: this.libraries.has('tesseract')
      }
    };
  }
}

module.exports = new ExtractionService();