/**
 * Enterprise Extraction Service
 * 
 * Orchestrates extraction with component-first approach
 * Includes fallback strategies and quality monitoring
 * 
 * @version 1.0.0 - Enterprise Grade
 */

const ComponentContactExtractor = require('./ComponentContactExtractor');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

class EnterpriseExtractionService {
  constructor() {
    this.extractor = ComponentContactExtractor;
    
    // Quality thresholds
    this.QUALITY_THRESHOLDS = {
      EXCELLENT: 0.8,    // 80%+ confidence
      GOOD: 0.65,        // 65-80% confidence
      ACCEPTABLE: 0.5,   // 50-65% confidence
      POOR: 0            // Below 50%
    };
    
    // Metrics tracking
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      contactsExtracted: 0
    };
  }

  /**
   * Extract contacts with enterprise-grade reliability
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `enterprise_${Date.now()}`;
    const startTime = Date.now();
    
    this.metrics.totalExtractions++;

    try {
      logger.info('🏢 Starting enterprise extraction', {
        extractionId,
        textLength: text.length,
        options
      });

      // Validate input
      if (!text || text.trim().length === 0) {
        throw new Error('Empty text provided for extraction');
      }

      // ========================================
      // PRIMARY: Component-First Extraction
      // ========================================
      const result = await this.extractor.extract(text, {
        ...options,
        extractionId
      });

      if (!result.success) {
        throw new Error(result.metadata?.error || 'Component extraction failed');
      }

      // ========================================
      // Quality Assessment
      // ========================================
      const quality = this.assessQuality(result);
      
      logger.info('📊 Extraction quality assessment', {
        extractionId,
        contactsFound: result.contacts.length,
        qualityGrade: quality.grade,
        confidence: quality.averageConfidence,
        recommendation: quality.recommendation
      });

      // Update metrics
      this.updateMetrics(result, Date.now() - startTime);

      return {
        success: true,
        contacts: result.contacts,
        metadata: {
          ...result.metadata,
          quality,
          extractionTimestamp: new Date().toISOString()
        },
        quality,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.metrics.failedExtractions++;
      
      logger.error('❌ Enterprise extraction failed', {
        extractionId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        contacts: [],
        metadata: {
          extractionId,
          error: error.message,
          processingTime: Date.now() - startTime
        },
        quality: {
          grade: 'FAILED',
          averageConfidence: 0,
          recommendation: 'Manual review required'
        }
      };
    }
  }

  /**
   * Assess extraction quality
   */
  assessQuality(result) {
    const contacts = result.contacts || [];
    const avgConfidence = contacts.length > 0
      ? contacts.reduce((sum, c) => sum + (c.confidence || 0.5), 0) / contacts.length
      : 0;

    let grade, recommendation;

    if (avgConfidence >= this.QUALITY_THRESHOLDS.EXCELLENT) {
      grade = 'EXCELLENT';
      recommendation = 'High confidence - ready for production use';
    } else if (avgConfidence >= this.QUALITY_THRESHOLDS.GOOD) {
      grade = 'GOOD';
      recommendation = 'Good quality - minor review recommended';
    } else if (avgConfidence >= this.QUALITY_THRESHOLDS.ACCEPTABLE) {
      grade = 'ACCEPTABLE';
      recommendation = 'Acceptable quality - review recommended';
    } else {
      grade = 'POOR';
      recommendation = 'Low confidence - manual review required';
    }

    return {
      grade,
      averageConfidence: avgConfidence.toFixed(2),
      contactsFound: contacts.length,
      recommendation,
      componentsFound: result.metadata?.components || {},
      rejectionRate: result.metadata?.quality?.rejectionRate || '0%'
    };
  }

  /**
   * Update internal metrics
   */
  updateMetrics(result, processingTime) {
    this.metrics.successfulExtractions++;
    this.metrics.contactsExtracted += result.contacts.length;
    
    // Update rolling averages
    const n = this.metrics.successfulExtractions;
    const newAvgConfidence = parseFloat(result.metadata?.quality?.averageConfidence || 0);
    
    this.metrics.averageConfidence = 
      ((this.metrics.averageConfidence * (n - 1)) + newAvgConfidence) / n;
    
    this.metrics.averageProcessingTime = 
      ((this.metrics.averageProcessingTime * (n - 1)) + processingTime) / n;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExtractions > 0
        ? ((this.metrics.successfulExtractions / this.metrics.totalExtractions) * 100).toFixed(1) + '%'
        : '0%',
      averageContactsPerExtraction: this.metrics.successfulExtractions > 0
        ? (this.metrics.contactsExtracted / this.metrics.successfulExtractions).toFixed(1)
        : 0
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      extractor: this.extractor.getStats(),
      metrics: this.getMetrics(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new EnterpriseExtractionService();

