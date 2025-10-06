/**
 * Document Analyzer - Analyzes document structure and content
 * Single Responsibility: Document analysis and classification
 */

class DocumentAnalyzer {
  constructor() {
    this.documentTypes = {
      'call_sheet': {
        keywords: ['call sheet', 'call time', 'location', 'crew', 'talent', 'production'],
        indicators: ['PHOTOGRAPHER', 'MUA', 'STYLIST', 'MODEL', 'CALL TIME']
      },
      'contact_list': {
        keywords: ['contacts', 'directory', 'phone list', 'email list'],
        indicators: ['@', 'phone', 'email', 'contact']
      },
      'production_document': {
        keywords: ['production', 'filming', 'shooting', 'schedule'],
        indicators: ['PRODUCTION', 'SCHEDULE', 'TIMELINE']
      },
      'cast_crew_list': {
        keywords: ['cast', 'crew', 'team', 'staff'],
        indicators: ['CAST', 'CREW', 'DEPARTMENT']
      }
    };

    this.productionTypes = {
      'film': ['film', 'movie', 'cinema', 'feature'],
      'television': ['tv', 'television', 'series', 'episode'],
      'commercial': ['commercial', 'ad', 'advertisement', 'brand'],
      'documentary': ['documentary', 'doc', 'factual'],
      'photography': ['photo', 'shoot', 'session', 'portrait']
    };
  }

  /**
   * Analyze document structure and content
   */
  analyzeDocument(text, fileName = '') {
    const analysis = {
      type: 'unknown',
      productionType: 'unknown',
      hasTableStructure: false,
      hasContactSections: false,
      estimatedContacts: 0,
      complexity: 'low',
      sections: [],
      confidence: 0
    };

    const textLower = text.toLowerCase();
    const fileNameLower = fileName.toLowerCase();

    // Detect document type
    analysis.type = this.detectDocumentType(textLower, fileNameLower);
    analysis.productionType = this.detectProductionType(textLower, fileNameLower);
    
    // Analyze structure
    analysis.hasTableStructure = this.hasTableStructure(text);
    analysis.hasContactSections = this.hasContactSections(textLower);
    analysis.sections = this.identifySections(textLower);
    
    // Estimate contacts and complexity
    analysis.estimatedContacts = this.estimateContactCount(text);
    analysis.complexity = this.assessComplexity(text, analysis.estimatedContacts);
    
    // Calculate confidence
    analysis.confidence = this.calculateConfidence(analysis, textLower);

    return analysis;
  }

  /**
   * Detect document type based on content and filename
   */
  detectDocumentType(textLower, fileNameLower) {
    let bestMatch = 'unknown';
    let highestScore = 0;

    for (const [type, config] of Object.entries(this.documentTypes)) {
      let score = 0;
      
      // Check keywords in text
      for (const keyword of config.keywords) {
        if (textLower.includes(keyword)) {
          score += 2;
        }
      }
      
      // Check indicators in text
      for (const indicator of config.indicators) {
        if (textLower.includes(indicator.toLowerCase())) {
          score += 3;
        }
      }
      
      // Check filename
      for (const keyword of config.keywords) {
        if (fileNameLower.includes(keyword)) {
          score += 1;
        }
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = type;
      }
    }

    return bestMatch;
  }

  /**
   * Detect production type
   */
  detectProductionType(textLower, fileNameLower) {
    for (const [type, keywords] of Object.entries(this.productionTypes)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword) || fileNameLower.includes(keyword)) {
          return type;
        }
      }
    }
    return 'unknown';
  }

  /**
   * Check if document has table structure
   */
  hasTableStructure(text) {
    const tableIndicators = [
      /\t.*\t.*\t/,  // Multiple tabs
      /\|.*\|.*\|/,  // Pipe separators
      /^\s*Name\s+Role\s+/mi,  // Header-like structure
      /^\s*\w+\s{2,}\w+\s{2,}\w+/m  // Multiple spaces (columns)
    ];
    
    return tableIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Check if document has contact sections
   */
  hasContactSections(textLower) {
    const sectionIndicators = [
      'production', 'talent', 'crew', 'clients', 'contacts', 'cast',
      'team', 'staff', 'department', 'agency'
    ];
    
    return sectionIndicators.some(indicator => textLower.includes(indicator));
  }

  /**
   * Identify document sections
   */
  identifySections(textLower) {
    const sections = [];
    const sectionKeywords = {
      'CREW': ['crew', 'photographer', 'stylist', 'mua', 'assistant', 'camera'],
      'TALENT': ['talent', 'model', 'actor', 'agency', 'casting'],
      'PRODUCTION': ['producer', 'director', 'creative', 'production', 'manager'],
      'CLIENT': ['client', 'brand', 'company', 'agency', 'account'],
      'LOCATION': ['location', 'address', 'venue', 'studio'],
      'SCHEDULE': ['schedule', 'call time', 'timeline', 'agenda']
    };

    for (const [section, keywords] of Object.entries(sectionKeywords)) {
      const matches = keywords.filter(keyword => textLower.includes(keyword)).length;
      if (matches > 0) {
        sections.push({
          name: section,
          confidence: matches / keywords.length,
          keywords: keywords.filter(keyword => textLower.includes(keyword))
        });
      }
    }

    return sections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Estimate number of contacts in document
   */
  estimateContactCount(text) {
    const phoneMatches = (text.match(/\+?[\d\s\-\(\)]{8,}/g) || []).length;
    const emailMatches = (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g) || []).length;
    const nameMatches = (text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []).length;
    const roleMatches = (text.match(/^[A-Z][A-Z\s]+:/gm) || []).length;
    
    // Use the highest indicator as the estimate
    return Math.min(Math.max(phoneMatches, emailMatches, nameMatches, roleMatches), 100);
  }

  /**
   * Assess document complexity
   */
  assessComplexity(text, estimatedContacts) {
    const textLength = text.length;
    const lineCount = text.split('\n').length;
    const wordCount = text.split(/\s+/).length;
    
    // Simple heuristics for complexity
    if (textLength < 1000 && lineCount < 20 && estimatedContacts < 10) {
      return 'low';
    }
    
    if (textLength > 10000 || lineCount > 100 || estimatedContacts > 50) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Calculate confidence score for the analysis
   */
  calculateConfidence(analysis, textLower) {
    let confidence = 0;
    
    // Base confidence on document type detection
    if (analysis.type !== 'unknown') {
      confidence += 0.3;
    }
    
    // Add confidence for production type
    if (analysis.productionType !== 'unknown') {
      confidence += 0.2;
    }
    
    // Add confidence for structure detection
    if (analysis.hasTableStructure) {
      confidence += 0.2;
    }
    
    if (analysis.hasContactSections) {
      confidence += 0.2;
    }
    
    // Add confidence for estimated contacts
    if (analysis.estimatedContacts > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Get analysis summary for logging
   */
  getAnalysisSummary(analysis) {
    return {
      documentType: analysis.type,
      productionType: analysis.productionType,
      complexity: analysis.complexity,
      estimatedContacts: analysis.estimatedContacts,
      confidence: analysis.confidence,
      sectionsFound: analysis.sections.length,
      hasStructure: analysis.hasTableStructure
    };
  }
}

module.exports = new DocumentAnalyzer();
