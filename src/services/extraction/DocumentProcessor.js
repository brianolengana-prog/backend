/**
 * Document Processor - Handles text extraction from various document types
 * Single Responsibility: Document-to-text conversion
 */

const LibraryManager = require('./LibraryManager');

class DocumentProcessor {
  constructor() {
    this.supportedMimeTypes = {
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
  }

  /**
   * Extract text from any document type
   */
  async extractText(fileBuffer, mimeType, fileName) {
    try {
      console.log(`📄 Processing file: ${fileName} (${mimeType})`);
      
      // Check file size limits
      const maxFileSize = 50 * 1024 * 1024; // 50MB limit
      if (fileBuffer.length > maxFileSize) {
        throw new Error(`File too large: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. Maximum allowed size is 50MB.`);
      }
      
      // Ensure libraries are loaded
      await LibraryManager.initialize();
      
      const fileType = this.getFileType(mimeType);
      let extractedText = '';

      switch (fileType) {
        case 'pdf':
          extractedText = await this.extractFromPDF(fileBuffer);
          break;
        case 'docx':
          extractedText = await this.extractFromDOCX(fileBuffer);
          break;
        case 'xlsx':
          extractedText = await this.extractFromXLSX(fileBuffer);
          break;
        case 'xls':
          extractedText = await this.extractFromXLS(fileBuffer);
          break;
        case 'csv':
          extractedText = await this.extractFromCSV(fileBuffer);
          break;
        case 'image':
          extractedText = await this.extractFromImage(fileBuffer);
          break;
        case 'text':
          extractedText = await this.extractFromPlainText(fileBuffer);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

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
  getFileType(mimeType) {
    return this.supportedMimeTypes[mimeType] || 'text';
  }

  /**
   * Extract text from PDF documents
   */
  async extractFromPDF(buffer) {
    const pdfjs = await LibraryManager.getLibrary('pdfjs', true);
    
    try {
      // Ensure we have a proper Uint8Array for pdfjs
      let uint8Array;
      if (buffer instanceof Uint8Array) {
        uint8Array = buffer;
      } else if (buffer instanceof Buffer) {
        // Create a new Uint8Array from Buffer data
        // This is the most reliable way to convert Buffer to Uint8Array
        uint8Array = new Uint8Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
          uint8Array[i] = buffer[i];
        }
      } else if (buffer instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(buffer);
      } else {
        // Last resort: try to create from whatever we have
        uint8Array = new Uint8Array(buffer);
      }
      
      console.log('🔧 PDF Buffer conversion:', {
        originalType: buffer.constructor.name,
        convertedType: uint8Array.constructor.name,
        bufferLength: buffer.length,
        uint8ArrayLength: uint8Array.length,
        hasBuffer: 'buffer' in buffer,
        hasByteOffset: 'byteOffset' in buffer,
        hasByteLength: 'byteLength' in buffer
      });
      
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
      console.log('📄 Extracted text length:', fullText.length);
      console.log('📄 Extracted text preview:', fullText.substring(0, 200));
      
      // Check if this might be a scanned PDF (very little text extracted)
      const textLength = fullText.trim().length;
      const isLikelyScanned = textLength < 100 || this.isLikelyScannedPDF(fullText);
      
      if (isLikelyScanned) {
        console.log('⚠️ PDF appears to be scanned or image-based');
        console.log(`📊 Text density analysis: ${textLength} characters extracted`);
        console.log('🔄 Attempting OCR fallback for scanned PDF...');
        
        try {
          const ocrText = await this.extractFromScannedPDF(buffer);
          if (ocrText && ocrText.trim().length > textLength) {
            console.log('✅ OCR extraction successful - using OCR results');
            console.log(`📊 OCR improvement: ${textLength} → ${ocrText.trim().length} characters`);
            return ocrText;
          }
        } catch (ocrError) {
          console.warn('⚠️ OCR fallback failed:', ocrError.message);
          console.log('💡 Consider using a different PDF or manually extracting text');
        }
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('❌ PDF processing error:', error.message);
      
      // If it's a Buffer/Uint8Array issue, try a different approach
      if (error.message.includes('Uint8Array') || error.message.includes('Buffer')) {
        try {
          console.log('🔄 Retrying PDF processing with alternative Buffer conversion...');
          
          // Try converting Buffer to Uint8Array using the same reliable method
          let uint8Array;
          if (buffer instanceof Buffer) {
            // Create a new Uint8Array from Buffer data (same as above)
            uint8Array = new Uint8Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
              uint8Array[i] = buffer[i];
            }
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
          
          console.log('📄 PDF processed successfully with fallback method');
          console.log('📄 Fallback extracted text length:', fullText.length);
          console.log('📄 Fallback extracted text preview:', fullText.substring(0, 200));
          return fullText.trim();
        } catch (fallbackError) {
          console.error('❌ PDF fallback processing also failed:', fallbackError.message);
          throw new Error(`PDF processing failed: ${error.message}`);
        }
      }
      
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX documents
   */
  async extractFromDOCX(buffer) {
    const mammoth = await LibraryManager.getLibrary('mammoth', true);
    
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
  async extractFromXLSX(buffer) {
    const xlsx = await LibraryManager.getLibrary('xlsx', true);
    
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
   * Extract text from XLS documents
   */
  async extractFromXLS(buffer) {
    const xlsx = await LibraryManager.getLibrary('xlsx', true);
    
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
  async extractFromCSV(buffer) {
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
  async extractFromImage(buffer) {
    const tesseract = await LibraryManager.getLibrary('tesseract', false);
    
    if (!tesseract) {
      throw new Error('OCR processing not available - tesseract.js library not loaded');
    }
    
    try {
      const { data: { text } } = await tesseract.recognize(buffer, 'eng', {
        logger: m => console.log(`OCR Progress: ${m}`)
      });
      console.log('📄 Image OCR processed successfully');
      return text.trim();
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractFromPlainText(buffer) {
    try {
      const text = buffer.toString('utf-8');
      console.log('📄 Plain text processed successfully');
      return text;
    } catch (error) {
      throw new Error(`Plain text processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from scanned PDFs using OCR
   */
  async extractFromScannedPDF(buffer) {
    const tesseract = await LibraryManager.getLibrary('tesseract', false);
    
    if (!tesseract) {
      throw new Error('OCR processing not available - tesseract.js library not loaded');
    }
    
    try {
      console.log('🔄 Attempting OCR on PDF buffer directly...');
      
      const { data: { text } } = await tesseract.recognize(buffer, 'eng', {
        logger: m => console.log(`OCR Progress: ${m}`)
      });
      
      if (text && text.trim()) {
        console.log('📄 Scanned PDF OCR processed successfully');
        console.log('📄 OCR extracted text length:', text.length);
        console.log('📄 OCR extracted text preview:', text.substring(0, 200));
        return text.trim();
      } else {
        console.log('⚠️ OCR found no text in PDF');
        throw new Error('No text found in scanned PDF');
      }
    } catch (error) {
      console.error('❌ Scanned PDF OCR processing failed:', error.message);
      throw new Error(`Scanned PDF OCR processing failed: ${error.message}. This PDF may require manual text extraction or a different OCR approach.`);
    }
  }

  /**
   * Detect if a PDF is likely scanned based on text characteristics
   */
  isLikelyScannedPDF(text) {
    if (!text || text.trim().length === 0) return true;
    
    // Check for common scanned PDF characteristics
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
    
    // Scanned PDFs often have:
    // - Very short lines (OCR artifacts)
    // - Lots of single characters or short words
    // - High ratio of non-alphanumeric characters
    const shortLines = lines.filter(line => line.length < 10).length;
    const shortLineRatio = shortLines / lines.length;
    
    const nonAlphaRatio = (text.replace(/[a-zA-Z0-9\s]/g, '').length) / text.length;
    
    // Heuristics for scanned PDF detection
    const isScanned = (
      avgLineLength < 20 ||           // Very short average line length
      shortLineRatio > 0.5 ||         // More than 50% short lines
      nonAlphaRatio > 0.3 ||          // High ratio of special characters
      text.length < 200               // Very little text overall
    );
    
    console.log('🔍 Scanned PDF analysis:', {
      avgLineLength: avgLineLength.toFixed(2),
      shortLineRatio: (shortLineRatio * 100).toFixed(1) + '%',
      nonAlphaRatio: (nonAlphaRatio * 100).toFixed(1) + '%',
      textLength: text.length,
      isLikelyScanned: isScanned
    });
    
    return isScanned;
  }
}

module.exports = new DocumentProcessor();
