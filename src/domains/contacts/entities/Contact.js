/**
 * Contact Entity (Contacts Domain)
 * 
 * Represents a contact in the contacts management domain.
 * This is different from the extraction domain's Contact entity,
 * which represents extracted contact data during the extraction process.
 * 
 * This entity represents a persisted contact with business logic.
 */
class Contact {
  /**
   * @param {string} id - Contact ID (UUID)
   * @param {string} userId - User ID who owns this contact
   * @param {string} jobId - Job ID that extracted this contact
   * @param {string} name - Contact name
   * @param {string|null} email - Contact email
   * @param {string|null} phone - Contact phone
   * @param {string|null} role - Contact role
   * @param {string|null} company - Contact company
   * @param {boolean} isSelected - Whether contact is selected
   * @param {Date} createdAt - Creation date
   * @param {Date} updatedAt - Update date
   */
  constructor(
    id,
    userId,
    jobId,
    name,
    email = null,
    phone = null,
    role = null,
    company = null,
    isSelected = true,
    createdAt = null,
    updatedAt = null
  ) {
    this.id = id;
    this.userId = userId;
    this.jobId = jobId;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.role = role;
    this.company = company;
    this.isSelected = isSelected;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  /**
   * Validates the contact entity
   * @returns {object} { valid: boolean, errors: string[] }
   */
  validate() {
    const errors = [];

    if (!this.userId) {
      errors.push('User ID is required');
    }

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    // At least email or phone should be present
    if (!this.email && !this.phone) {
      errors.push('At least email or phone is required');
    }

    // Email validation if provided
    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if contact has valid contact information
   * @returns {boolean}
   */
  hasContactInfo() {
    return !!(this.email || this.phone);
  }

  /**
   * Checks if contact is complete (has both email and phone)
   * @returns {boolean}
   */
  isComplete() {
    return !!(this.email && this.phone);
  }

  /**
   * Validates email format
   * @private
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Converts entity to plain object for API responses
   * @returns {object}
   */
  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      jobId: this.jobId,
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
   * Creates a Contact entity from Prisma model
   * @param {object} prismaContact - Prisma Contact model
   * @returns {Contact}
   */
  static fromPrisma(prismaContact) {
    if (!prismaContact) return null;

    return new Contact(
      prismaContact.id,
      prismaContact.userId,
      prismaContact.jobId,
      prismaContact.name,
      prismaContact.email,
      prismaContact.phone,
      prismaContact.role,
      prismaContact.company,
      prismaContact.isSelected ?? prismaContact.is_selected ?? true,
      prismaContact.createdAt,
      prismaContact.updatedAt
    );
  }

  /**
   * Creates a Contact entity from plain object
   * @param {object} data - Plain object
   * @returns {Contact}
   */
  static fromObject(data) {
    return new Contact(
      data.id,
      data.userId,
      data.jobId,
      data.name,
      data.email,
      data.phone,
      data.role,
      data.company,
      data.isSelected ?? true,
      data.createdAt ? new Date(data.createdAt) : null,
      data.updatedAt ? new Date(data.updatedAt) : null
    );
  }
}

module.exports = Contact;

