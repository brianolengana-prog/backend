/**
 * Contact Validation Service
 * 
 * Ensures data quality and consistency
 * Validates, cleans, and normalizes contact data
 * 
 * Best Practice: Single Responsibility - validation only
 * Best Practice: Immutability - returns new cleaned objects
 */
const { logger } = require('../../../shared/infrastructure/logger/logger.service');

class ContactValidationService {
  /**
   * Validates a single contact
   * @param {object} contact - Contact object
   * @returns {object} { valid: boolean, errors: string[] }
   */
  validateContact(contact) {
    const errors = [];

    // Must have name
    if (!contact.name || typeof contact.name !== 'string' || contact.name.trim().length === 0) {
      errors.push('Contact must have a name');
    }

    // Must have at least email OR phone
    const hasEmail = contact.email && contact.email.trim().length > 0;
    const hasPhone = contact.phone && contact.phone.trim().length > 0;

    if (!hasEmail && !hasPhone) {
      errors.push('Contact must have at least email or phone');
    }

    // Email validation if provided
    if (hasEmail && !this.isValidEmail(contact.email)) {
      errors.push('Invalid email format');
    }

    // Phone validation if provided (basic)
    if (hasPhone && !this.isValidPhone(contact.phone)) {
      errors.push('Invalid phone format');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates email format
   * @private
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validates phone format (basic - allows various formats)
   * @private
   */
  isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Remove common formatting characters
    const digitsOnly = phone.replace(/[\s\-\(\)\.\+]/g, '');
    // Must have at least 7 digits (international format)
    return digitsOnly.length >= 7 && /^\d+$/.test(digitsOnly);
  }

  /**
   * Cleans and normalizes contact data
   * @param {object} contact - Contact object
   * @returns {object} Cleaned contact object
   */
  cleanContact(contact) {
    if (!contact) return null;

    const cleaned = {
      id: contact.id,
      userId: contact.userId,
      jobId: contact.jobId,
      name: this.cleanName(contact.name),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhone(contact.phone),
      role: this.cleanRole(contact.role),
      company: this.cleanCompany(contact.company),
      isSelected: contact.isSelected !== undefined ? contact.isSelected : true,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    };

    return cleaned;
  }

  /**
   * Cleans name field
   * @private
   */
  cleanName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s\-'.,]/g, '') // Remove special characters except common ones
      .trim();
  }

  /**
   * Cleans email field
   * @private
   */
  cleanEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const cleaned = email.trim().toLowerCase();
    return this.isValidEmail(cleaned) ? cleaned : null;
  }

  /**
   * Cleans phone field
   * @private
   */
  cleanPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    // Remove common formatting, keep digits and +
    const cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Cleans role field
   * @private
   */
  cleanRole(role) {
    if (!role || typeof role !== 'string') return null;
    return role.trim()
      .replace(/\s+/g, ' ')
      .trim() || null;
  }

  /**
   * Cleans company field
   * @private
   */
  cleanCompany(company) {
    if (!company || typeof company !== 'string') return null;
    return company.trim()
      .replace(/\s+/g, ' ')
      .trim() || null;
  }

  /**
   * Validates and cleans an array of contacts
   * @param {Array} contacts - Array of contact objects
   * @param {object} options - Options
   * @param {boolean} options.removeInvalid - Remove invalid contacts (default: true)
   * @param {boolean} options.deduplicate - Remove duplicates (default: true)
   * @returns {object} { valid: Contact[], invalid: Contact[], cleaned: Contact[] }
   */
  validateAndCleanContacts(contacts, options = {}) {
    const { removeInvalid = true, deduplicate = true } = options;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return { valid: [], invalid: [], cleaned: [] };
    }

    const valid = [];
    const invalid = [];
    const cleaned = [];

    // Step 1: Clean and validate each contact
    for (const contact of contacts) {
      const cleanedContact = this.cleanContact(contact);
      const validation = this.validateContact(cleanedContact);

      if (validation.valid) {
        valid.push(cleanedContact);
        cleaned.push(cleanedContact);
      } else {
        invalid.push({
          ...cleanedContact,
          validationErrors: validation.errors
        });
        if (!removeInvalid) {
          cleaned.push(cleanedContact); // Include even if invalid
        }
      }
    }

    // Step 2: Deduplicate if requested
    let finalCleaned = cleaned;
    if (deduplicate) {
      finalCleaned = this.deduplicateContacts(cleaned);
    }

    logger.info(`Contact validation complete`, {
      total: contacts.length,
      valid: valid.length,
      invalid: invalid.length,
      cleaned: finalCleaned.length,
      duplicatesRemoved: cleaned.length - finalCleaned.length
    });

    return {
      valid,
      invalid,
      cleaned: finalCleaned
    };
  }

  /**
   * Removes duplicate contacts
   * Uses email and phone as primary keys
   * @private
   */
  deduplicateContacts(contacts) {
    const seen = new Map();
    const unique = [];

    for (const contact of contacts) {
      // Create key from email or phone
      const key = contact.email 
        ? `email:${contact.email.toLowerCase()}`
        : contact.phone 
          ? `phone:${contact.phone.replace(/[\s\-\(\)\.]/g, '')}`
          : null;

      if (!key) {
        // No email or phone - use name as fallback (less reliable)
        const nameKey = `name:${contact.name?.toLowerCase().trim()}`;
        if (!seen.has(nameKey)) {
          seen.set(nameKey, contact);
          unique.push(contact);
        }
      } else if (!seen.has(key)) {
        seen.set(key, contact);
        unique.push(contact);
      } else {
        // Duplicate found - keep the one with more complete data
        const existing = seen.get(key);
        if (this.getContactCompleteness(contact) > this.getContactCompleteness(existing)) {
          const index = unique.indexOf(existing);
          unique[index] = contact;
          seen.set(key, contact);
        }
      }
    }

    return unique;
  }

  /**
   * Calculates contact completeness score
   * @private
   */
  getContactCompleteness(contact) {
    let score = 0;
    if (contact.name) score += 1;
    if (contact.email) score += 2; // Email is more valuable
    if (contact.phone) score += 2; // Phone is more valuable
    if (contact.role) score += 1;
    if (contact.company) score += 1;
    return score;
  }

  /**
   * Sorts contacts by quality (most complete first)
   * @param {Array} contacts - Array of contacts
   * @returns {Array} Sorted contacts
   */
  sortByQuality(contacts) {
    return [...contacts].sort((a, b) => {
      const scoreA = this.getContactCompleteness(a);
      const scoreB = this.getContactCompleteness(b);
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA; // Higher score first
      }
      
      // If same score, sort by name
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
}

module.exports = ContactValidationService;

