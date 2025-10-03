/**
 * Document Analysis Service
 * 
 * Uses OpenAI to intelligently analyze document structure and determine
 * the best extraction strategy for any call sheet format
 */

const openai = require('openai');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/document-analysis.log' })
  ]
});

class DocumentAnalysisService {
  constructor() {
    this.client = new openai({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.analysisCache = new Map();
    this.learningData = [];
    
    logger.info('🧠 Document Analysis Service initialized');
  }

  /**
   * Analyze document structure and determine extraction strategy
   */
  async analyzeDocument(text, fileName, mimeType) {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(text, fileName);
      if (this.analysisCache.has(cacheKey)) {
        return this.analysisCache.get(cacheKey);
      }

      // Use OpenAI to analyze document structure
      const analysis = await this.performDocumentAnalysis(text, fileName, mimeType);
      
      // Cache the result
      this.analysisCache.set(cacheKey, analysis);
      
      // Store for learning
      this.learningData.push({
        fileName,
        mimeType,
        analysis,
        timestamp: Date.now()
      });

      logger.info('📊 Document analysis completed', {
        fileName,
        structure: analysis.documentStructure,
        confidence: analysis.confidence
      });

      return analysis;

    } catch (error) {
      logger.error('❌ Document analysis failed', { error: error.message, fileName });
      
      // Return fallback analysis
      return this.getFallbackAnalysis(text, fileName, mimeType);
    }
  }

  /**
   * Use OpenAI to analyze document structure
   */
  async performDocumentAnalysis(text, fileName, mimeType) {
    const prompt = `Analyze this production call sheet document and provide a structured analysis:

DOCUMENT TEXT:
${text.substring(0, 4000)}...

Please analyze and return a JSON object with:
1. documentStructure: "call_sheet" | "crew_list" | "contact_list" | "mixed" | "unknown"
2. sections: Array of detected sections (e.g., ["crew", "cast", "production", "contacts"])
3. contactPatterns: Array of detected contact patterns (e.g., ["role: name / phone", "name | email | phone"])
4. hasRoles: boolean - whether roles are explicitly mentioned
5. hasCompanies: boolean - whether companies/agencies are mentioned
6. hasEmails: boolean - whether email addresses are present
7. hasPhones: boolean - whether phone numbers are present
8. format: "structured" | "semi_structured" | "unstructured"
9. confidence: number (0-1) - confidence in analysis
10. recommendedStrategy: "ai_primary" | "pattern_primary" | "hybrid" | "textract_primary"
11. extractionHints: Array of specific patterns to look for
12. contextClues: Object with additional context information

Return ONLY valid JSON, no other text.`;

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing production documents and call sheets. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Enhance analysis with additional heuristics
    return this.enhanceAnalysis(analysis, text);
  }

  /**
   * Enhance AI analysis with additional heuristics
   */
  enhanceAnalysis(analysis, text) {
    // Add pattern detection
    analysis.detectedPatterns = this.detectPatterns(text);
    
    // Add confidence adjustments based on heuristics
    analysis.confidence = this.adjustConfidence(analysis, text);
    
    // Add extraction recommendations
    analysis.extractionRecommendations = this.generateExtractionRecommendations(analysis);
    
    return analysis;
  }

  /**
   * Detect common patterns in the text
   */
  detectPatterns(text) {
    const patterns = {
      roleColon: /^[A-Za-z\s]+:\s*.+/gm,
      slashSeparated: /[^\/]+\/[^\/]+/g,
      pipeSeparated: /[^|]+\|[^|]+/g,
      emailPattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phonePattern: /[\+]?[1-9]?[\d\s\-\(\)\.]{10,}/g,
      allCapsNames: /\b[A-Z]{2,}(?:\s+[A-Z]{2,})+\b/g
    };

    const detected = {};
    for (const [name, pattern] of Object.entries(patterns)) {
      detected[name] = pattern.test(text);
    }

    return detected;
  }

  /**
   * Adjust confidence based on heuristics
   */
  adjustConfidence(analysis, text) {
    let confidence = analysis.confidence || 0.5;
    
    // Boost confidence if patterns are detected
    if (analysis.detectedPatterns?.roleColon) confidence += 0.1;
    if (analysis.detectedPatterns?.phonePattern) confidence += 0.1;
    if (analysis.detectedPatterns?.emailPattern) confidence += 0.05;
    
    // Reduce confidence if document is too short
    if (text.length < 100) confidence -= 0.2;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate extraction recommendations based on analysis
   */
  generateExtractionRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.hasRoles && analysis.format === 'structured') {
      recommendations.push('Use role-based extraction patterns');
    }
    
    if (analysis.hasEmails) {
      recommendations.push('Extract email addresses as primary identifiers');
    }
    
    if (analysis.hasPhones) {
      recommendations.push('Use phone numbers for contact validation');
    }
    
    if (analysis.detectedPatterns?.slashSeparated) {
      recommendations.push('Look for slash-separated contact information');
    }
    
    if (analysis.detectedPatterns?.pipeSeparated) {
      recommendations.push('Look for pipe-separated contact information');
    }
    
    return recommendations;
  }

  /**
   * Get fallback analysis when AI fails
   */
  getFallbackAnalysis(text, fileName, mimeType) {
    return {
      documentStructure: 'unknown',
      sections: [],
      contactPatterns: [],
      hasRoles: false,
      hasCompanies: false,
      hasEmails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text),
      hasPhones: /[\+]?[1-9]?[\d\s\-\(\)\.]{10,}/.test(text),
      format: 'unstructured',
      confidence: 0.3,
      recommendedStrategy: 'pattern_primary',
      extractionHints: [],
      contextClues: {},
      detectedPatterns: this.detectPatterns(text),
      extractionRecommendations: ['Use general pattern extraction']
    };
  }

  /**
   * Generate cache key for analysis
   */
  generateCacheKey(text, fileName) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text.substring(0, 1000)).digest('hex');
    return `${fileName}_${hash}`;
  }

  /**
   * Learn from successful extractions
   */
  async learnFromExtraction(originalAnalysis, extractedContacts, successRate) {
    const learningEntry = {
      analysis: originalAnalysis,
      extractedContacts,
      successRate,
      timestamp: Date.now()
    };

    this.learningData.push(learningEntry);

    // Keep only last 1000 learning entries
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-1000);
    }

    logger.info('🧠 Learning from extraction', {
      successRate,
      contactsExtracted: extractedContacts.length
    });
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      available: !!this.client,
      cacheSize: this.analysisCache.size,
      learningEntries: this.learningData.length,
      lastAnalysis: this.analysisCache.size > 0 ? 'available' : 'none'
    };
  }
}

module.exports = new DocumentAnalysisService();
