/**
 * ExtractionJob Entity
 * 
 * Domain entity representing an extraction job
 * Encapsulates business logic related to extraction jobs
 * 
 * Best Practice: Domain entities contain business logic, not data access
 */
class ExtractionJob {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.title = data.title;
    this.fileName = data.fileName;
    this.fileUrl = data.fileUrl;
    this.fileHash = data.fileHash;
    this.fileSize = data.fileSize;
    this.status = data.status || 'PROCESSING';
    this.processedContacts = data.processedContacts || null;
    this.productionId = data.productionId || null;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Check if job is completed
   * @returns {boolean}
   */
  isCompleted() {
    return this.status === 'COMPLETED';
  }

  /**
   * Check if job failed
   * @returns {boolean}
   */
  isFailed() {
    return this.status === 'FAILED';
  }

  /**
   * Check if job is processing
   * @returns {boolean}
   */
  isProcessing() {
    return this.status === 'PROCESSING';
  }

  /**
   * Mark job as completed
   * @param {number} contactCount - Number of contacts extracted
   */
  markCompleted(contactCount = 0) {
    this.status = 'COMPLETED';
    this.processedContacts = contactCount;
    this.updatedAt = new Date();
  }

  /**
   * Mark job as failed
   * @param {string} reason - Failure reason
   */
  markFailed(reason = null) {
    this.status = 'FAILED';
    this.updatedAt = new Date();
    if (reason) {
      this.processedContacts = { error: reason };
    }
  }

  /**
   * Check if job has file hash (for deduplication)
   * @returns {boolean}
   */
  hasFileHash() {
    return !!this.fileHash;
  }

  /**
   * Get job age in milliseconds
   * @returns {number}
   */
  getAge() {
    if (!this.createdAt) return 0;
    return Date.now() - new Date(this.createdAt).getTime();
  }

  /**
   * Check if job is recent (within 24 hours)
   * @returns {boolean}
   */
  isRecent() {
    const age = this.getAge();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return age < twentyFourHours;
  }

  /**
   * Convert to plain object (for serialization)
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      fileName: this.fileName,
      fileUrl: this.fileUrl,
      fileHash: this.fileHash,
      fileSize: this.fileSize,
      status: this.status,
      processedContacts: this.processedContacts,
      productionId: this.productionId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from Prisma model
   * @param {object} prismaModel - Prisma model instance
   * @returns {ExtractionJob}
   */
  static fromPrisma(prismaModel) {
    return new ExtractionJob(prismaModel);
  }
}

module.exports = ExtractionJob;

