/**
 * Enterprise Document Classifier
 * AI-powered document type and structure detection
 */

const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');

class DocumentClassifier {
  constructor() {
    this.models = new Map();
    this.isInitialized = false;
    this.featureExtractor = new natural.TfIdf();
    
    // Document type classifications
    this.documentTypes = {
      'call_sheet': {
        keywords: ['call sheet', 'call time', 'crew', 'talent', 'production', 'location'],
        patterns: ['photographer:', 'mua:', 'stylist:', 'model:', 'producer:'],
        confidence_threshold: 0.8
      },
      'invoice': {
        keywords: ['invoice', 'bill', 'amount due', 'payment', 'total', 'tax'],
        patterns: ['invoice #', 'due date:', 'amount:', '$', 'total:'],
        confidence_threshold: 0.85
      },
      'contract': {
        keywords: ['agreement', 'contract', 'terms', 'conditions', 'party', 'signature'],
        patterns: ['whereas', 'hereby', 'shall', 'agreement dated', 'signature:'],
        confidence_threshold: 0.9
      },
      'resume': {
        keywords: ['experience', 'education', 'skills', 'employment', 'objective'],
        patterns: ['email:', 'phone:', 'address:', 'experience:', 'education:'],
        confidence_threshold: 0.85
      },
      'financial_statement': {
        keywords: ['balance sheet', 'income statement', 'cash flow', 'assets', 'liabilities'],
        patterns: ['total assets', 'net income', 'cash flow', 'balance as of'],
        confidence_threshold: 0.9
      },
      'legal_document': {
        keywords: ['court', 'plaintiff', 'defendant', 'case', 'jurisdiction'],
        patterns: ['case no.', 'vs.', 'court of', 'jurisdiction:', 'filed:'],
        confidence_threshold: 0.95
      },
      'medical_record': {
        keywords: ['patient', 'diagnosis', 'treatment', 'medical', 'doctor', 'prescription'],
        patterns: ['patient:', 'dob:', 'diagnosis:', 'treatment:', 'rx:'],
        confidence_threshold: 0.95
      },
      'technical_spec': {
        keywords: ['specification', 'requirements', 'technical', 'system', 'architecture'],
        patterns: ['version:', 'requirements:', 'specifications:', 'system:'],
        confidence_threshold: 0.8
      }
    };

    // Layout classifications
    this.layoutTypes = {
      'structured_table': {
        indicators: ['consistent_columns', 'header_row', 'aligned_data'],
        extraction_strategy: 'table_parser'
      },
      'form_based': {
        indicators: ['field_labels', 'colon_separated', 'form_structure'],
        extraction_strategy: 'form_parser'
      },
      'free_text': {
        indicators: ['paragraph_structure', 'narrative_flow', 'minimal_structure'],
        extraction_strategy: 'nlp_extraction'
      },
      'multi_column': {
        indicators: ['column_layout', 'newspaper_style', 'magazine_format'],
        extraction_strategy: 'column_aware_parser'
      },
      'mixed_content': {
        indicators: ['tables_and_text', 'images_and_text', 'complex_layout'],
        extraction_strategy: 'hybrid_extraction'
      }
    };

    this.initialize();
  }

  async initialize() {
    try {
      console.log('🧠 Initializing Document Classifier...');
      
      // Load or create classification models
      await this.loadModels();
      
      // Initialize feature extractors
      this.initializeFeatureExtractors();
      
      this.isInitialized = true;
      console.log('✅ Document Classifier initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Document Classifier:', error);
    }
  }

  async loadModels() {
    try {
      // Try to load pre-trained models
      // In production, these would be trained on your specific document types
      
      // For now, we'll use rule-based classification with ML enhancement
      console.log('📚 Loading classification models...');
      
      // Document type classifier (simplified TensorFlow model)
      this.models.set('document_type', await this.createDocumentTypeModel());
      
      // Layout classifier
      this.models.set('layout_type', await this.createLayoutModel());
      
      console.log('✅ Classification models loaded');
    } catch (error) {
      console.warn('⚠️ Using fallback rule-based classification:', error.message);
      // Fallback to rule-based classification
    }
  }

  async createDocumentTypeModel() {
    // Simplified neural network for document classification
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [100], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: Object.keys(this.documentTypes).length, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  async createLayoutModel() {
    // Layout classification model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: Object.keys(this.layoutTypes).length, activation: 'softmax' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  initializeFeatureExtractors() {
    // Initialize TF-IDF for text analysis
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    
    // Pre-populate with common document terms
    Object.values(this.documentTypes).forEach(docType => {
      docType.keywords.forEach(keyword => {
        this.featureExtractor.addDocument(keyword);
      });
    });
  }

  async classifyDocument(text, fileName = '', metadata = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Multi-stage classification
      const results = {
        documentType: await this.classifyDocumentType(text, fileName, metadata),
        layoutType: await this.classifyLayout(text, metadata),
        contentStructure: await this.analyzeContentStructure(text),
        extractionStrategy: null,
        confidence: 0,
        processingTime: 0
      };

      // Determine extraction strategy based on classification
      results.extractionStrategy = this.selectExtractionStrategy(results);
      
      // Calculate overall confidence
      results.confidence = this.calculateOverallConfidence(results);
      
      results.processingTime = Date.now() - startTime;
      
      console.log('🎯 Document classification completed:', {
        type: results.documentType.type,
        layout: results.layoutType.type,
        strategy: results.extractionStrategy,
        confidence: results.confidence,
        processingTime: results.processingTime + 'ms'
      });

      return results;
      
    } catch (error) {
      console.error('❌ Document classification failed:', error);
      return this.getDefaultClassification();
    }
  }

  async classifyDocumentType(text, fileName, metadata) {
    const textLower = text.toLowerCase();
    const fileNameLower = fileName.toLowerCase();
    
    // Rule-based classification with scoring
    const scores = {};
    
    for (const [type, config] of Object.entries(this.documentTypes)) {
      let score = 0;
      
      // Keyword matching
      config.keywords.forEach(keyword => {
        if (textLower.includes(keyword.toLowerCase())) {
          score += 2;
        }
      });
      
      // Pattern matching
      config.patterns.forEach(pattern => {
        const regex = new RegExp(pattern.toLowerCase(), 'gi');
        const matches = (textLower.match(regex) || []).length;
        score += matches * 3;
      });
      
      // Filename analysis
      config.keywords.forEach(keyword => {
        if (fileNameLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      
      scores[type] = score;
    }
    
    // Find best match
    const bestType = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    const confidence = Math.min(scores[bestType] / 10, 1.0);
    
    // ML enhancement (if model is available)
    let mlConfidence = confidence;
    if (this.models.has('document_type')) {
      try {
        const features = this.extractTextFeatures(text);
        const prediction = await this.models.get('document_type').predict(features);
        const mlScores = await prediction.data();
        mlConfidence = Math.max(...mlScores);
      } catch (error) {
        console.warn('⚠️ ML classification failed, using rule-based result');
      }
    }
    
    return {
      type: bestType,
      confidence: Math.max(confidence, mlConfidence),
      scores: scores,
      method: 'hybrid'
    };
  }

  async classifyLayout(text, metadata) {
    const analysis = {
      hasTable: this.detectTableStructure(text),
      hasForm: this.detectFormStructure(text),
      hasColumns: this.detectColumnLayout(text),
      hasMixedContent: this.detectMixedContent(text),
      lineCount: text.split('\n').length,
      avgLineLength: this.calculateAverageLineLength(text)
    };

    // Score each layout type
    const scores = {};
    
    for (const [type, config] of Object.entries(this.layoutTypes)) {
      let score = 0;
      
      switch (type) {
        case 'structured_table':
          if (analysis.hasTable) score += 5;
          if (analysis.avgLineLength > 50) score += 2;
          break;
          
        case 'form_based':
          if (analysis.hasForm) score += 5;
          if (analysis.lineCount < 100) score += 2;
          break;
          
        case 'free_text':
          if (!analysis.hasTable && !analysis.hasForm) score += 3;
          if (analysis.avgLineLength > 80) score += 3;
          break;
          
        case 'multi_column':
          if (analysis.hasColumns) score += 5;
          if (analysis.lineCount > 50) score += 2;
          break;
          
        case 'mixed_content':
          if (analysis.hasMixedContent) score += 5;
          if (analysis.lineCount > 100) score += 2;
          break;
      }
      
      scores[type] = score;
    }
    
    const bestLayout = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    return {
      type: bestLayout,
      confidence: Math.min(scores[bestLayout] / 7, 1.0),
      analysis: analysis,
      extractionStrategy: this.layoutTypes[bestLayout].extraction_strategy
    };
  }

  async analyzeContentStructure(text) {
    return {
      sections: this.identifyDocumentSections(text),
      tables: this.identifyTables(text),
      forms: this.identifyForms(text),
      lists: this.identifyLists(text),
      headers: this.identifyHeaders(text),
      metadata: this.extractDocumentMetadata(text)
    };
  }

  detectTableStructure(text) {
    const tableIndicators = [
      /\|.*\|.*\|/,  // Pipe separators
      /\t.*\t.*\t/,  // Multiple tabs
      /^\s*\w+\s{2,}\w+\s{2,}\w+/m,  // Multiple spaces (columns)
      /^[-=]{3,}/m   // Separator lines
    ];
    
    return tableIndicators.some(pattern => pattern.test(text));
  }

  detectFormStructure(text) {
    const formIndicators = [
      /\w+\s*:\s*\w+/g,  // Field: Value pairs
      /\[\s*\]/g,        // Checkboxes
      /_{3,}/g,          // Underlines for filling
      /__+/g             // Multiple underscores
    ];
    
    const matches = formIndicators.reduce((count, pattern) => {
      return count + (text.match(pattern) || []).length;
    }, 0);
    
    return matches > 5; // Threshold for form detection
  }

  detectColumnLayout(text) {
    const lines = text.split('\n');
    let columnIndicators = 0;
    
    lines.forEach(line => {
      // Check for consistent spacing patterns
      if (line.match(/\w+\s{5,}\w+\s{5,}\w+/)) {
        columnIndicators++;
      }
    });
    
    return columnIndicators > lines.length * 0.3; // 30% of lines show column structure
  }

  detectMixedContent(text) {
    const hasTable = this.detectTableStructure(text);
    const hasForm = this.detectFormStructure(text);
    const hasNarrative = text.split('.').length > 10; // Many sentences
    
    return (hasTable && hasNarrative) || (hasForm && hasNarrative);
  }

  calculateAverageLineLength(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const totalLength = lines.reduce((sum, line) => sum + line.length, 0);
    return lines.length > 0 ? totalLength / lines.length : 0;
  }

  identifyDocumentSections(text) {
    const sections = [];
    const sectionPatterns = [
      /^[A-Z\s]{3,}:?\s*$/gm,  // ALL CAPS headers
      /^#{1,6}\s+.+$/gm,       // Markdown headers
      /^\d+\.\s+[A-Z]/gm,      // Numbered sections
      /^[A-Z][^.!?]*:$/gm      // Title case with colon
    ];
    
    sectionPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        sections.push({
          title: match.trim(),
          type: 'header',
          position: text.indexOf(match)
        });
      });
    });
    
    return sections.sort((a, b) => a.position - b.position);
  }

  identifyTables(text) {
    const tables = [];
    const lines = text.split('\n');
    let currentTable = null;
    
    lines.forEach((line, index) => {
      if (this.isTableRow(line)) {
        if (!currentTable) {
          currentTable = {
            startLine: index,
            rows: [],
            columns: this.getColumnCount(line)
          };
        }
        currentTable.rows.push(line);
      } else if (currentTable) {
        currentTable.endLine = index - 1;
        tables.push(currentTable);
        currentTable = null;
      }
    });
    
    return tables;
  }

  isTableRow(line) {
    return /\|.*\|/.test(line) || /\t.*\t/.test(line) || /\s{3,}.*\s{3,}/.test(line);
  }

  getColumnCount(line) {
    if (line.includes('|')) return line.split('|').length - 1;
    if (line.includes('\t')) return line.split('\t').length;
    return line.split(/\s{3,}/).length;
  }

  identifyForms(text) {
    const forms = [];
    const formPatterns = [
      /(\w+(?:\s+\w+)*)\s*:\s*([^\n]*)/g,  // Field: Value
      /(\w+(?:\s+\w+)*)\s*\[\s*([^\]]*)\s*\]/g,  // Field [Value]
      /(\w+(?:\s+\w+)*)\s*_{3,}/g  // Field ___
    ];
    
    formPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        forms.push({
          field: match[1].trim(),
          value: match[2] ? match[2].trim() : '',
          position: match.index,
          type: 'form_field'
        });
      }
    });
    
    return forms;
  }

  identifyLists(text) {
    const lists = [];
    const listPatterns = [
      /^[\s]*[-*•]\s+(.+)$/gm,  // Bullet points
      /^[\s]*\d+\.\s+(.+)$/gm,  // Numbered lists
      /^[\s]*[a-zA-Z]\.\s+(.+)$/gm  // Lettered lists
    ];
    
    listPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      if (matches.length > 1) {  // At least 2 items to be considered a list
        lists.push({
          type: 'list',
          items: matches,
          count: matches.length
        });
      }
    });
    
    return lists;
  }

  identifyHeaders(text) {
    const headers = [];
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Check for header characteristics
      if (trimmed.length > 0 && trimmed.length < 100) {
        const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
        const endsWithColon = trimmed.endsWith(':');
        const isShort = trimmed.length < 50;
        const hasNoLowercase = !/[a-z]/.test(trimmed);
        
        if ((isAllCaps && isShort) || (endsWithColon && isShort) || hasNoLowercase) {
          headers.push({
            text: trimmed,
            line: index,
            type: 'header',
            confidence: this.calculateHeaderConfidence(trimmed, lines, index)
          });
        }
      }
    });
    
    return headers.filter(h => h.confidence > 0.6);
  }

  calculateHeaderConfidence(text, lines, lineIndex) {
    let confidence = 0.5;
    
    // All caps bonus
    if (text === text.toUpperCase() && /[A-Z]/.test(text)) confidence += 0.2;
    
    // Colon ending bonus
    if (text.endsWith(':')) confidence += 0.1;
    
    // Short text bonus
    if (text.length < 30) confidence += 0.1;
    
    // Surrounded by empty lines bonus
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1].trim() : '';
    const nextLine = lineIndex < lines.length - 1 ? lines[lineIndex + 1].trim() : '';
    if (prevLine === '' || nextLine === '') confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  extractDocumentMetadata(text) {
    const metadata = {};
    
    // Common metadata patterns
    const patterns = {
      date: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b[\+]?[\d\s\-\(\)]{10,}\b/g,
      currency: /\$[\d,]+\.?\d*/g,
      percentage: /\d+\.?\d*%/g
    };
    
    Object.entries(patterns).forEach(([key, pattern]) => {
      const matches = text.match(pattern) || [];
      if (matches.length > 0) {
        metadata[key] = matches;
      }
    });
    
    return metadata;
  }

  extractTextFeatures(text) {
    // Extract features for ML model
    const features = new Array(100).fill(0);
    
    // Basic text statistics
    features[0] = text.length / 10000; // Normalized length
    features[1] = text.split('\n').length / 1000; // Normalized line count
    features[2] = text.split(' ').length / 10000; // Normalized word count
    
    // Character distribution
    features[3] = (text.match(/[A-Z]/g) || []).length / text.length;
    features[4] = (text.match(/[a-z]/g) || []).length / text.length;
    features[5] = (text.match(/\d/g) || []).length / text.length;
    features[6] = (text.match(/[^\w\s]/g) || []).length / text.length;
    
    // Structure indicators
    features[7] = (text.match(/:/g) || []).length / 100;
    features[8] = (text.match(/\|/g) || []).length / 100;
    features[9] = (text.match(/\t/g) || []).length / 100;
    
    // Fill remaining features with TF-IDF scores
    // This would be more sophisticated in production
    
    return tf.tensor2d([features]);
  }

  selectExtractionStrategy(classificationResults) {
    const { documentType, layoutType, contentStructure } = classificationResults;
    
    // Strategy selection matrix
    const strategies = {
      'call_sheet': {
        'structured_table': 'table_aware_extraction',
        'form_based': 'form_pattern_extraction',
        'free_text': 'nlp_enhanced_extraction',
        'multi_column': 'column_aware_extraction',
        'mixed_content': 'hybrid_extraction'
      },
      'invoice': {
        'structured_table': 'financial_table_extraction',
        'form_based': 'invoice_form_extraction',
        'default': 'financial_document_extraction'
      },
      'resume': {
        'structured_table': 'resume_table_extraction',
        'form_based': 'resume_form_extraction',
        'free_text': 'resume_nlp_extraction',
        'default': 'resume_section_extraction'
      },
      'default': {
        'structured_table': 'generic_table_extraction',
        'form_based': 'generic_form_extraction',
        'free_text': 'generic_nlp_extraction',
        'multi_column': 'generic_column_extraction',
        'mixed_content': 'generic_hybrid_extraction',
        'default': 'adaptive_extraction'
      }
    };
    
    const docStrategies = strategies[documentType.type] || strategies.default;
    return docStrategies[layoutType.type] || docStrategies.default || 'adaptive_extraction';
  }

  calculateOverallConfidence(results) {
    const weights = {
      documentType: 0.4,
      layoutType: 0.3,
      contentStructure: 0.3
    };
    
    let totalConfidence = 0;
    totalConfidence += results.documentType.confidence * weights.documentType;
    totalConfidence += results.layoutType.confidence * weights.layoutType;
    
    // Content structure confidence (simplified)
    const structureConfidence = Math.min(
      (results.contentStructure.sections.length + 
       results.contentStructure.tables.length + 
       results.contentStructure.forms.length) / 10,
      1.0
    );
    totalConfidence += structureConfidence * weights.contentStructure;
    
    return Math.min(totalConfidence, 1.0);
  }

  getDefaultClassification() {
    return {
      documentType: { type: 'unknown', confidence: 0.5 },
      layoutType: { type: 'free_text', confidence: 0.5 },
      contentStructure: { sections: [], tables: [], forms: [], lists: [], headers: [] },
      extractionStrategy: 'adaptive_extraction',
      confidence: 0.5,
      processingTime: 0
    };
  }

  // Training methods for continuous improvement
  async trainOnFeedback(documentText, actualType, actualLayout, userFeedback) {
    // Implement continuous learning from user feedback
    console.log('📚 Training classifier with user feedback...');
    
    // Store training data
    const trainingData = {
      text: documentText,
      actualType: actualType,
      actualLayout: actualLayout,
      feedback: userFeedback,
      timestamp: new Date().toISOString()
    };
    
    // In production, this would update the ML models
    // For now, we can adjust rule-based thresholds
    this.adjustClassificationRules(trainingData);
  }

  adjustClassificationRules(trainingData) {
    // Adjust confidence thresholds based on feedback
    if (trainingData.feedback.accuracy < 0.8) {
      // Lower confidence threshold for this document type
      if (this.documentTypes[trainingData.actualType]) {
        this.documentTypes[trainingData.actualType].confidence_threshold *= 0.95;
      }
    }
  }
}

module.exports = new DocumentClassifier();
