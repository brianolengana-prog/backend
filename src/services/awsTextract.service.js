/**
 * AWS Textract Service
 * 
 * Enterprise-grade OCR and document analysis using AWS Textract
 * - Superior OCR for scanned PDFs
 * - Table detection and extraction
 * - Form analysis capabilities
 * - Cost-effective with free tier
 */

const { TextractClient, AnalyzeDocumentCommand, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');

class AWSTextractService {
  constructor() {
    this.prisma = new PrismaClient();
    this.textractClient = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    this.s3Bucket = process.env.AWS_S3_BUCKET;
    this.isAvailable = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    if (!this.isAvailable) {
      console.warn('⚠️ AWS credentials not found - Textract service will be disabled');
    } else {
      console.log('✅ AWS Textract Service initialized');
      console.log(`  - Region: ${process.env.AWS_REGION || 'us-east-1'}`);
      console.log(`  - S3 Bucket: ${this.s3Bucket || 'Not configured'}`);
    }
  }

  /**
   * Extract text from document using AWS Textract
   */
  async extractTextFromDocument(fileBuffer, mimeType, fileName, options = {}) {
    if (!this.isAvailable) {
      throw new Error('AWS Textract service is not available - credentials required');
    }

    try {
      console.log('🔍 Starting AWS Textract analysis...');
      console.log('📁 File:', fileName, 'Type:', mimeType, 'Size:', fileBuffer.length);

      // Step 1: Upload file to S3
      const s3Key = await this.uploadToS3(fileBuffer, fileName);
      console.log('📤 File uploaded to S3:', s3Key);

      // Step 2: Choose analysis type based on document
      const analysisType = this.determineAnalysisType(mimeType, fileName, options);
      console.log('🎯 Analysis type:', analysisType);

      let result;
      switch (analysisType) {
        case 'tables':
          result = await this.analyzeDocumentWithTables(s3Key);
          break;
        case 'forms':
          result = await this.analyzeDocumentWithForms(s3Key);
          break;
        default:
          result = await this.detectDocumentText(s3Key);
      }

      // Step 3: Clean up S3 object
      await this.deleteFromS3(s3Key);
      console.log('🗑️ S3 object cleaned up');

      // Step 4: Process and format results
      const extractedText = this.formatTextractResults(result, analysisType);
      console.log(`✅ Textract analysis completed: ${extractedText.length} characters extracted`);

      return {
        success: true,
        text: extractedText,
        metadata: {
          analysisType,
          pageCount: result.pageCount || 1,
          confidence: result.confidence || 0.95,
          service: 'aws-textract',
          cost: this.calculateCost(result.pageCount || 1)
        }
      };

    } catch (error) {
      console.error('❌ AWS Textract analysis failed:', error);
      return {
        success: false,
        error: error.message,
        text: '',
        metadata: {
          service: 'aws-textract',
          cost: 0
        }
      };
    }
  }

  /**
   * Upload file to S3 for Textract processing
   */
  async uploadToS3(fileBuffer, fileName) {
    if (!this.s3Bucket) {
      throw new Error('S3 bucket not configured');
    }

    const key = `textract-temp/${Date.now()}-${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: this.getContentType(fileName)
    });

    await this.s3Client.send(command);
    return key;
  }

  /**
   * Delete file from S3 after processing
   */
  async deleteFromS3(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: key
      });
      await this.s3Client.send(command);
    } catch (error) {
      console.warn('⚠️ Failed to delete S3 object:', error.message);
    }
  }

  /**
   * Determine the best analysis type for the document
   */
  determineAnalysisType(mimeType, fileName, options) {
    // Force analysis type if specified
    if (options.analysisType) {
      return options.analysisType;
    }

    // Check file type and name for hints
    const fileNameLower = fileName.toLowerCase();
    
    if (fileNameLower.includes('call') || fileNameLower.includes('sheet')) {
      return 'tables'; // Call sheets are usually tabular
    }
    
    if (fileNameLower.includes('form') || fileNameLower.includes('application')) {
      return 'forms'; // Forms benefit from form analysis
    }
    
    if (mimeType === 'application/pdf') {
      return 'tables'; // PDFs often contain tables
    }
    
    return 'text'; // Default to basic text detection
  }

  /**
   * Basic text detection
   */
  async detectDocumentText(s3Key) {
    const command = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: this.s3Bucket,
          Name: s3Key
        }
      }
    });

    const response = await this.textractClient.send(command);
    return {
      type: 'text',
      blocks: response.Blocks || [],
      pageCount: response.DocumentMetadata?.Pages || 1
    };
  }

  /**
   * Document analysis with table detection
   */
  async analyzeDocumentWithTables(s3Key) {
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: this.s3Bucket,
          Name: s3Key
        }
      },
      FeatureTypes: ['TABLES']
    });

    const response = await this.textractClient.send(command);
    return {
      type: 'tables',
      blocks: response.Blocks || [],
      pageCount: response.DocumentMetadata?.Pages || 1
    };
  }

  /**
   * Document analysis with form detection
   */
  async analyzeDocumentWithForms(s3Key) {
    const command = new AnalyzeDocumentCommand({
      Document: {
        S3Object: {
          Bucket: this.s3Bucket,
          Name: s3Key
        }
      },
      FeatureTypes: ['FORMS']
    });

    const response = await this.textractClient.send(command);
    return {
      type: 'forms',
      blocks: response.Blocks || [],
      pageCount: response.DocumentMetadata?.Pages || 1
    };
  }

  /**
   * Format Textract results into readable text
   */
  formatTextractResults(result, analysisType) {
    let text = '';
    const blocks = result.blocks || [];
    
    // Group blocks by page
    const pages = {};
    blocks.forEach(block => {
      if (block.Page) {
        if (!pages[block.Page]) {
          pages[block.Page] = [];
        }
        pages[block.Page].push(block);
      }
    });

    // Process each page
    Object.keys(pages).forEach(pageNum => {
      text += `\n--- Page ${pageNum} ---\n`;
      const pageBlocks = pages[pageNum];
      
      if (analysisType === 'tables') {
        text += this.formatTableBlocks(pageBlocks);
      } else if (analysisType === 'forms') {
        text += this.formatFormBlocks(pageBlocks);
      } else {
        text += this.formatTextBlocks(pageBlocks);
      }
    });

    return text.trim();
  }

  /**
   * Format table blocks for better structure
   */
  formatTableBlocks(blocks) {
    let text = '';
    const tables = blocks.filter(block => block.BlockType === 'TABLE');
    const cells = blocks.filter(block => block.BlockType === 'CELL');
    const words = blocks.filter(block => block.BlockType === 'WORD');

    // Group cells by table
    const tableCells = {};
    cells.forEach(cell => {
      if (cell.TableId) {
        if (!tableCells[cell.TableId]) {
          tableCells[cell.TableId] = [];
        }
        tableCells[cell.TableId].push(cell);
      }
    });

    // Format each table
    tables.forEach(table => {
      const tableId = table.Id;
      const tableCellList = tableCells[tableId] || [];
      
      // Sort cells by row and column
      tableCellList.sort((a, b) => {
        if (a.RowIndex !== b.RowIndex) {
          return a.RowIndex - b.RowIndex;
        }
        return a.ColumnIndex - b.ColumnIndex;
      });

      // Group by rows
      const rows = {};
      tableCellList.forEach(cell => {
        const rowIndex = cell.RowIndex;
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }
        rows[rowIndex].push(cell);
      });

      // Format rows
      Object.keys(rows).forEach(rowIndex => {
        const rowCells = rows[rowIndex];
        const rowText = rowCells.map(cell => {
          const cellWords = words.filter(word => 
            word.CellId === cell.Id
          ).map(word => word.Text).join(' ');
          return cellWords.trim();
        }).join(' | ');
        text += rowText + '\n';
      });
      
      text += '\n'; // Add spacing between tables
    });

    return text;
  }

  /**
   * Format form blocks
   */
  formatFormBlocks(blocks) {
    let text = '';
    const keyValueSets = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET');
    const words = blocks.filter(block => block.BlockType === 'WORD');

    keyValueSets.forEach(kvSet => {
      const keyWords = words.filter(word => 
        word.KeyId === kvSet.Id
      ).map(word => word.Text).join(' ');
      
      const valueWords = words.filter(word => 
        word.ValueId === kvSet.Id
      ).map(word => word.Text).join(' ');
      
      if (keyWords && valueWords) {
        text += `${keyWords}: ${valueWords}\n`;
      }
    });

    return text;
  }

  /**
   * Format basic text blocks
   */
  formatTextBlocks(blocks) {
    let text = '';
    const words = blocks.filter(block => block.BlockType === 'WORD');
    
    // Sort words by reading order
    words.sort((a, b) => {
      if (a.Page !== b.Page) return a.Page - b.Page;
      if (a.BoundingBox.Top !== b.BoundingBox.Top) {
        return a.BoundingBox.Top - b.BoundingBox.Top;
      }
      return a.BoundingBox.Left - b.BoundingBox.Left;
    });

    // Group words into lines
    let currentLine = '';
    let lastTop = -1;
    
    words.forEach(word => {
      const currentTop = Math.round(word.BoundingBox.Top * 100) / 100;
      
      if (lastTop !== -1 && Math.abs(currentTop - lastTop) > 0.01) {
        text += currentLine.trim() + '\n';
        currentLine = word.Text + ' ';
      } else {
        currentLine += word.Text + ' ';
      }
      
      lastTop = currentTop;
    });
    
    if (currentLine.trim()) {
      text += currentLine.trim() + '\n';
    }

    return text;
  }

  /**
   * Get content type for S3 upload
   */
  getContentType(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    const types = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'tiff': 'image/tiff',
      'tif': 'image/tiff'
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Calculate cost for Textract usage
   */
  calculateCost(pageCount) {
    // AWS Textract pricing: $1.50 per 1,000 pages
    const costPerPage = 0.0015;
    return pageCount * costPerPage;
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      available: this.isAvailable,
      region: process.env.AWS_REGION || 'us-east-1',
      s3Bucket: this.s3Bucket || 'Not configured',
      credentials: {
        accessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: !!process.env.AWS_SECRET_ACCESS_KEY
      }
    };
  }
}

module.exports = new AWSTextractService();
