/**
 * Adaptive Pattern Service
 * 
 * Dynamically generates and adapts extraction patterns based on
 * document analysis and learning from successful extractions
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/adaptive-pattern.log' })
  ]
});

class AdaptivePatternService {
  constructor() {
    this.patternLibrary = new Map();
    this.successfulPatterns = new Map();
    this.patternPerformance = new Map();
    
    this.initializeBasePatterns();
    
    logger.info('🎯 Adaptive Pattern Service initialized');
  }

  /**
   * Initialize base pattern library
   */
  initializeBasePatterns() {
    const basePatterns = [
      {
        id: 'role_name_phone',
        name: 'Role: Name / Phone',
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/,
        confidence: 0.85,
        category: 'call_sheet',
        examples: ['Photographer: John Doe / 555-1234']
      },
      {
        id: 'role_name_company_phone',
        name: 'Role: Name / Company / Phone',
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/,
        confidence: 0.9,
        category: 'call_sheet',
        examples: ['Photographer: John Doe / ABC Agency / 555-1234']
      },
      {
        id: 'name_email_phone',
        name: 'Name | Email | Phone',
        regex: /^([^|]+)\|([^|]+)\|([^|]+)$/,
        confidence: 0.9,
        category: 'contact_list',
        examples: ['John Doe | john@example.com | 555-1234']
      },
      {
        id: 'all_caps_name_phone',
        name: 'ALL CAPS NAME / Phone',
        regex: /^([A-Z\s]+)\s*\/\s*(.+)/,
        confidence: 0.8,
        category: 'crew_list',
        examples: ['JOHN DOE / 555-1234']
      }
    ];

    basePatterns.forEach(pattern => {
      this.patternLibrary.set(pattern.id, pattern);
      this.patternPerformance.set(pattern.id, {
        uses: 0,
        successes: 0,
        successRate: 0
      });
    });
  }

  /**
   * Generate patterns based on document analysis
   */
  async generatePatterns(documentAnalysis, sampleText) {
    const patterns = [];
    
    // Extract patterns from document analysis
    if (documentAnalysis.contactPatterns) {
      for (const pattern of documentAnalysis.contactPatterns) {
        const generatedPattern = this.generatePatternFromDescription(pattern, sampleText);
        if (generatedPattern) {
          patterns.push(generatedPattern);
        }
      }
    }

    // Generate patterns based on detected patterns
    if (documentAnalysis.detectedPatterns) {
      const detectedPatterns = this.generatePatternsFromDetected(documentAnalysis.detectedPatterns, sampleText);
      patterns.push(...detectedPatterns);
    }

    // Add context-specific patterns
    const contextPatterns = this.generateContextPatterns(documentAnalysis, sampleText);
    patterns.push(...contextPatterns);

    return patterns;
  }

  /**
   * Generate pattern from description
   */
  generatePatternFromDescription(description, sampleText) {
    try {
      // Use simple heuristics to convert description to regex
      let regex;
      
      if (description.includes('role:') && description.includes('/')) {
        // Role: Name / Phone or Role: Name / Company / Phone
        const parts = description.split('/');
        if (parts.length === 2) {
          regex = /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/;
        } else if (parts.length === 3) {
          regex = /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/;
        }
      } else if (description.includes('|')) {
        // Pipe-separated format
        regex = /^([^|]+)\|([^|]+)\|([^|]+)$/;
      }

      if (regex) {
        return {
          id: `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Generated: ${description}`,
          regex,
          confidence: 0.7,
          category: 'generated',
          examples: [description]
        };
      }
    } catch (error) {
      logger.warn('Failed to generate pattern from description', { description, error: error.message });
    }
    
    return null;
  }

  /**
   * Generate patterns from detected patterns
   */
  generatePatternsFromDetected(detectedPatterns, sampleText) {
    const patterns = [];
    
    if (detectedPatterns.roleColon) {
      // Look for role: name patterns
      const rolePattern = this.analyzeRolePattern(sampleText);
      if (rolePattern) {
        patterns.push(rolePattern);
      }
    }
    
    if (detectedPatterns.slashSeparated) {
      // Look for slash-separated patterns
      const slashPattern = this.analyzeSlashPattern(sampleText);
      if (slashPattern) {
        patterns.push(slashPattern);
      }
    }
    
    if (detectedPatterns.pipeSeparated) {
      // Look for pipe-separated patterns
      const pipePattern = this.analyzePipePattern(sampleText);
      if (pipePattern) {
        patterns.push(pipePattern);
      }
    }
    
    return patterns;
  }

  /**
   * Analyze role pattern in text
   */
  analyzeRolePattern(text) {
    const lines = text.split('\n');
    const roleLines = lines.filter(line => /^[A-Za-z\s]+:\s*.+/.test(line));
    
    if (roleLines.length < 2) return null;
    
    // Analyze the structure of role lines
    const structures = roleLines.map(line => {
      const match = line.match(/^([^:]+):\s*(.+)/);
      if (match) {
        const role = match[1].trim();
        const content = match[2].trim();
        const parts = content.split('/');
        return { role, parts: parts.length, content };
      }
      return null;
    }).filter(Boolean);
    
    // Find most common structure
    const structureCounts = {};
    structures.forEach(s => {
      const key = `${s.parts}_${s.content.includes('@') ? 'email' : 'no_email'}`;
      structureCounts[key] = (structureCounts[key] || 0) + 1;
    });
    
    const mostCommon = Object.entries(structureCounts).sort((a, b) => b[1] - a[1])[0];
    if (!mostCommon) return null;
    
    const [structure, count] = mostCommon;
    const [parts, hasEmail] = structure.split('_');
    
    // Generate regex based on structure
    let regex;
    if (parts === '2') {
      regex = /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/;
    } else if (parts === '3') {
      regex = /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/;
    }
    
    if (regex) {
      return {
        id: `role_${parts}_${hasEmail}`,
        name: `Role Pattern (${parts} parts, ${hasEmail})`,
        regex,
        confidence: Math.min(0.9, 0.5 + (count / roleLines.length) * 0.4),
        category: 'analyzed',
        examples: structures.slice(0, 3).map(s => s.content)
      };
    }
    
    return null;
  }

  /**
   * Analyze slash-separated pattern
   */
  analyzeSlashPattern(text) {
    const lines = text.split('\n');
    const slashLines = lines.filter(line => /[^\/]+\/[^\/]+/.test(line));
    
    if (slashLines.length < 2) return null;
    
    // Analyze slash patterns
    const patterns = slashLines.map(line => {
      const parts = line.split('/');
      return {
        parts: parts.length,
        hasEmail: /@/.test(line),
        hasPhone: /[\d\s\-\(\)\.]{10,}/.test(line)
      };
    });
    
    // Find most common pattern
    const patternCounts = {};
    patterns.forEach(p => {
      const key = `${p.parts}_${p.hasEmail ? 'email' : 'no_email'}_${p.hasPhone ? 'phone' : 'no_phone'}`;
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    });
    
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (!mostCommon) return null;
    
    const [structure, count] = mostCommon;
    const [parts, hasEmail, hasPhone] = structure.split('_');
    
    // Generate regex based on structure
    let regex;
    if (parts === '2') {
      regex = /^([^\/]+)\/(.+)$/;
    } else if (parts === '3') {
      regex = /^([^\/]+)\/([^\/]+)\/(.+)$/;
    }
    
    if (regex) {
      return {
        id: `slash_${parts}_${hasEmail}_${hasPhone}`,
        name: `Slash Pattern (${parts} parts, ${hasEmail}, ${hasPhone})`,
        regex,
        confidence: Math.min(0.9, 0.5 + (count / slashLines.length) * 0.4),
        category: 'analyzed',
        examples: slashLines.slice(0, 3)
      };
    }
    
    return null;
  }

  /**
   * Analyze pipe-separated pattern
   */
  analyzePipePattern(text) {
    const lines = text.split('\n');
    const pipeLines = lines.filter(line => /[^|]+\|[^|]+/.test(line));
    
    if (pipeLines.length < 2) return null;
    
    // Analyze pipe patterns
    const patterns = pipeLines.map(line => {
      const parts = line.split('|');
      return {
        parts: parts.length,
        hasEmail: /@/.test(line),
        hasPhone: /[\d\s\-\(\)\.]{10,}/.test(line)
      };
    });
    
    // Find most common pattern
    const patternCounts = {};
    patterns.forEach(p => {
      const key = `${p.parts}_${p.hasEmail ? 'email' : 'no_email'}_${p.hasPhone ? 'phone' : 'no_phone'}`;
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    });
    
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (!mostCommon) return null;
    
    const [structure, count] = mostCommon;
    const [parts, hasEmail, hasPhone] = structure.split('_');
    
    // Generate regex based on structure
    let regex;
    if (parts === '3') {
      regex = /^([^|]+)\|([^|]+)\|([^|]+)$/;
    } else if (parts === '4') {
      regex = /^([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)$/;
    }
    
    if (regex) {
      return {
        id: `pipe_${parts}_${hasEmail}_${hasPhone}`,
        name: `Pipe Pattern (${parts} parts, ${hasEmail}, ${hasPhone})`,
        regex,
        confidence: Math.min(0.9, 0.5 + (count / pipeLines.length) * 0.4),
        category: 'analyzed',
        examples: pipeLines.slice(0, 3)
      };
    }
    
    return null;
  }

  /**
   * Generate context-specific patterns
   */
  generateContextPatterns(documentAnalysis, sampleText) {
    const patterns = [];
    
    // Production-specific patterns
    if (documentAnalysis.sections?.includes('crew')) {
      patterns.push({
        id: 'crew_position_name',
        name: 'Crew Position: Name',
        regex: /^([A-Za-z\s]+):\s*([A-Za-z\s]+)/,
        confidence: 0.8,
        category: 'crew',
        examples: ['Director: John Smith']
      });
    }
    
    if (documentAnalysis.sections?.includes('cast')) {
      patterns.push({
        id: 'cast_character_actor',
        name: 'Character - Actor',
        regex: /^([A-Za-z\s]+)\s*-\s*([A-Za-z\s]+)/,
        confidence: 0.8,
        category: 'cast',
        examples: ['Hero - John Smith']
      });
    }
    
    return patterns;
  }

  /**
   * Get best patterns for document
   */
  getBestPatterns(documentAnalysis, maxPatterns = 10) {
    const allPatterns = Array.from(this.patternLibrary.values());
    
    // Filter patterns by document type and confidence
    const relevantPatterns = allPatterns.filter(pattern => {
      // Check if pattern matches document structure
      if (documentAnalysis.documentStructure === 'call_sheet' && pattern.category === 'call_sheet') {
        return true;
      }
      if (documentAnalysis.documentStructure === 'crew_list' && pattern.category === 'crew') {
        return true;
      }
      if (documentAnalysis.documentStructure === 'contact_list' && pattern.category === 'contact_list') {
        return true;
      }
      
      // Include high-confidence patterns
      return pattern.confidence > 0.8;
    });
    
    // Sort by performance and confidence
    const sortedPatterns = relevantPatterns.sort((a, b) => {
      const aPerf = this.patternPerformance.get(a.id) || { successRate: 0, uses: 0 };
      const bPerf = this.patternPerformance.get(b.id) || { successRate: 0, uses: 0 };
      
      // Prioritize patterns with good performance
      if (aPerf.uses > 5 && bPerf.uses > 5) {
        return bPerf.successRate - aPerf.successRate;
      }
      
      // Otherwise prioritize by confidence
      return b.confidence - a.confidence;
    });
    
    return sortedPatterns.slice(0, maxPatterns);
  }

  /**
   * Update pattern performance
   */
  updatePatternPerformance(patternId, success) {
    const perf = this.patternPerformance.get(patternId) || { uses: 0, successes: 0, successRate: 0 };
    perf.uses++;
    if (success) perf.successes++;
    perf.successRate = perf.successes / perf.uses;
    
    this.patternPerformance.set(patternId, perf);
    
    logger.info('📊 Pattern performance updated', {
      patternId,
      success,
      successRate: perf.successRate,
      uses: perf.uses
    });
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      available: true,
      patternCount: this.patternLibrary.size,
      performanceTracked: this.patternPerformance.size,
      topPerformingPatterns: Array.from(this.patternPerformance.entries())
        .sort((a, b) => b[1].successRate - a[1].successRate)
        .slice(0, 5)
        .map(([id, perf]) => ({ id, ...perf }))
    };
  }
}

module.exports = new AdaptivePatternService();
