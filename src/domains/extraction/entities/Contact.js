/**
 * Contact Entity (Extraction Domain)
 * 
 * Domain entity representing a contact extracted from a document
 * Contains business logic for contact validation and manipulation
 * 
 * Best Practice: Domain entities contain business rules
 */
class Contact {
  constructor(data) {
    this.id = data.id;
    this.jobId = data.jobId;
    this.userId = data.userId;
    this.name = data.name || '';
    this.email = data.email || null;
    this.phone = data.phone || null;
    this.role = data.role || null;
    this.company = data.company || null;
    this.isSelected = data.isSelected !== undefined ? data.isSelected : true;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Check if contact has valid contact information
   * @returns {boolean}
   */
  hasContactInfo() {
    return !!(this.email || this.phone);
  }

  /**
   * Check if contact has email
   * @returns {boolean}
   */
  hasEmail() {
    return !!this.email;
  }

  /**
   * Check if contact has phone
   * @returns {boolean}
   */
  hasPhone() {
    return !!this.phone;
  }

  /**
   * Check if contact is complete (has name and contact info)
   * @returns {boolean}
   */
  isComplete() {
    return !!(this.name && this.hasContactInfo());
  }

  /**
   * Check if contact is valid for export
   * @returns {boolean}
   */
  isValidForExport() {
    return this.isComplete() && this.isSelected;
  }

  /**
   * Normalize phone number (basic)
   * @returns {string|null}
   */
  getNormalizedPhone() {
    if (!this.phone) return null;
    // Remove common formatting
    return this.phone.replace(/[\s\-\(\)\.]/g, '');
  }

  /**
   * Get display name (name or email or phone)
   * @returns {string}
   */
  getDisplayName() {
    if (this.name) return this.name;
    if (this.email) return this.email;
    if (this.phone) return this.phone;
    return 'Unknown Contact';
  }

  /**
   * Mark contact as selected
   */
  select() {
    this.isSelected = true;
    this.updatedAt = new Date();
  }

  /**
   * Mark contact as unselected
   */
  unselect() {
    this.isSelected = false;
    this.updatedAt = new Date();
  }

  /**
   * Convert to plain object (for serialization)
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.id,
      jobId: this.jobId,
      userId: this.userId,
      name: this.name,
      email: this.email,
      phone: this.phone,
      role: this.role,
      company: this.company,
      isSelected: this.isSelected,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create from Prisma model
   * @param {object} prismaModel - Prisma model instance
   * @returns {Contact}
   */
  static fromPrisma(prismaModel) {
    return new Contact(prismaModel);
  }

  /**
   * Create from raw extraction data
   * @param {object} rawData - Raw contact data from extraction
   * @param {string} jobId - Job ID
   * @param {string} userId - User ID
   * @returns {Contact}
   */
  static fromExtraction(rawData, jobId, userId) {
    return new Contact({
      jobId,
      userId,
      name: rawData.name || '',
      email: rawData.email || null,
      phone: rawData.phone || null,
      role: rawData.role || null,
      company: rawData.company || null,
      isSelected: true
    });
  }
}

module.exports = Contact;

