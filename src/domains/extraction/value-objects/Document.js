/**
 * Document Value Object
 * 
 * Immutable value object representing a document
 * Value objects have no identity - equality is based on values
 * 
 * Best Practice: Value objects are immutable and compared by value
 */
class Document {
  constructor(data) {
    // Immutable properties
    this.content = data.content || '';
    this.mimeType = data.mimeType || 'application/pdf';
    this.fileName = data.fileName || 'unknown';
    this.size = data.size || 0;
    this.buffer = data.buffer || null;
    
    // Freeze to prevent mutation
    Object.freeze(this);
  }

  /**
   * Check if document has content
   * @returns {boolean}
   */
  hasContent() {
    return this.content.length > 0;
  }

  /**
   * Check if document is PDF
   * @returns {boolean}
   */
  isPDF() {
    return this.mimeType === 'application/pdf';
  }

  /**
   * Check if document is image
   * @returns {boolean}
   */
  isImage() {
    return ['image/jpeg', 'image/png', 'image/tiff'].includes(this.mimeType);
  }

  /**
   * Check if document is Word document
   * @returns {boolean}
   */
  isWord() {
    return this.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  /**
   * Check if document is Excel
   * @returns {boolean}
   */
  isExcel() {
    return this.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  /**
   * Check if document is text-based
   * @returns {boolean}
   */
  isTextBased() {
    return this.isPDF() || this.isWord() || this.mimeType === 'text/plain';
  }

  /**
   * Get content length
   * @returns {number}
   */
  getContentLength() {
    return this.content.length;
  }

  /**
   * Check if document is empty
   * @returns {boolean}
   */
  isEmpty() {
    return !this.hasContent() && this.size === 0;
  }

  /**
   * Check if document is large (> 1MB)
   * @returns {boolean}
   */
  isLarge() {
    return this.size > 1024 * 1024; // 1MB
  }

  /**
   * Create from file buffer
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME type
   * @param {string} fileName - File name
   * @param {string} content - Extracted text content
   * @returns {Document}
   */
  static fromFile(buffer, mimeType, fileName, content = '') {
    return new Document({
      buffer,
      mimeType,
      fileName,
      size: buffer ? buffer.length : 0,
      content
    });
  }

  /**
   * Create from text
   * @param {string} text - Text content
   * @param {string} fileName - File name
   * @returns {Document}
   */
  static fromText(text, fileName = 'text.txt') {
    return new Document({
      content: text,
      mimeType: 'text/plain',
      fileName,
      size: Buffer.from(text).length
    });
  }

  /**
   * Convert to plain object
   * @returns {object}
   */
  toJSON() {
    return {
      content: this.content,
      mimeType: this.mimeType,
      fileName: this.fileName,
      size: this.size,
      hasBuffer: !!this.buffer
    };
  }
}

module.exports = Document;

