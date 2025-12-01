/**
 * ExtractionMetadata Value Object
 * 
 * Immutable value object containing extraction metadata
 * Includes document analysis, processing info, and quality metrics
 * 
 * Best Practice: Metadata as value object ensures immutability
 */
class ExtractionMetadata {
  constructor(data) {
    this.documentType = data.documentType || 'unknown';
    this.productionType = data.productionType || null;
    this.extractionMethod = data.extractionMethod || 'unknown';
    this.textLength = data.textLength || 0;
    this.quality = data.quality || 0;
    this.confidence = data.confidence || 0;
    this.stages = data.stages || {};
    this.processingTime = data.processingTime || 0;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.extractionId = data.extractionId || null;
    
    // Freeze to prevent mutation
    Object.freeze(this);
  }

  /**
   * Check if document is call sheet
   * @returns {boolean}
   */
  isCallSheet() {
    return this.documentType === 'call_sheet';
  }

  /**
   * Check if document is talent list
   * @returns {boolean}
   */
  isTalentList() {
    return this.documentType === 'talent_list';
  }

  /**
   * Check if metadata has quality score
   * @returns {boolean}
   */
  hasQualityScore() {
    return this.quality > 0;
  }

  /**
   * Check if metadata has confidence score
   * @returns {boolean}
   */
  hasConfidenceScore() {
    return this.confidence > 0;
  }

  /**
   * Get processing time in seconds
   * @returns {number}
   */
  getProcessingTimeSeconds() {
    return this.processingTime / 1000;
  }

  /**
   * Check if extraction was fast (< 5 seconds)
   * @returns {boolean}
   */
  isFast() {
    return this.getProcessingTimeSeconds() < 5;
  }

  /**
   * Create from document analysis
   * @param {object} documentAnalysis - Document analysis result
   * @param {string} extractionMethod - Extraction method used
   * @param {number} processingTime - Processing time in ms
   * @returns {ExtractionMetadata}
   */
  static fromAnalysis(documentAnalysis, extractionMethod, processingTime = 0) {
    return new ExtractionMetadata({
      documentType: documentAnalysis.type || 'unknown',
      productionType: documentAnalysis.productionType || null,
      extractionMethod,
      textLength: documentAnalysis.textLength || 0,
      quality: documentAnalysis.quality || 0,
      confidence: documentAnalysis.confidence || 0,
      processingTime,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Convert to plain object
   * @returns {object}
   */
  toJSON() {
    return {
      documentType: this.documentType,
      productionType: this.productionType,
      extractionMethod: this.extractionMethod,
      textLength: this.textLength,
      quality: this.quality,
      confidence: this.confidence,
      stages: this.stages,
      processingTime: this.processingTime,
      timestamp: this.timestamp,
      extractionId: this.extractionId
    };
  }
}

module.exports = ExtractionMetadata;

