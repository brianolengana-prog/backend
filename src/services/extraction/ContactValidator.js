/**
 * Contact Validator - Handles contact validation and scoring
 * Single Responsibility: Contact quality assessment and validation
 */

class ContactValidator {
  constructor() {
    this.rolePriority = {
      'PRODUCER': 1,
      'DIRECTOR': 2,
      'PHOTOGRAPHER': 3,
      'CREATIVE DIRECTOR': 4,
      'STYLIST': 5,
      'MUA': 6,
      'MAKEUP ARTIST': 6,
      'MODEL': 7,
      'TALENT': 8,
      'ASSISTANT': 9,
      'CONTACT': 10
    };

    this.roleKeywords = [
      'PHOTOGRAPHER', 'PHOTO', 'CAMERA',
      'MUA', 'MAKEUP', 'MAKE-UP', 'MAKE UP',
      'STYLIST', 'STYLE', 'WARDROBE',
      'PRODUCER', 'PROD', 'PRODUCTION',
      'DIRECTOR', 'DIR',
      'ASSISTANT', 'ASSIST', 'ASST',
      'MODEL', 'TALENT',
      'HAIR', 'HAIRSTYLIST',
      'WARDROBE', 'STYLING',
      'CREATIVE DIRECTOR', 'CD',
      'ART DIRECTOR', 'AD'
    ];
  }

  /**
   * Validate and clean contacts
   */
  validateContacts(contacts) {
    if (!Array.isArray(contacts)) {
      return [];
    }

    return contacts
      .map(contact => this.normalizeContact(contact))
      .filter(contact => this.isValidContact(contact))
      .map(contact => this.calculateConfidenceScore(contact));
  }

  /**
   * Normalize contact information
   */
  normalizeContact(contact) {
    if (!contact || typeof contact !== 'object') {
      return null;
    }

    return {
      name: this.cleanName(contact.name),
      role: this.cleanRole(contact.role),
      email: this.cleanEmail(contact.email),
      phone: this.cleanPhone(contact.phone),
      company: this.cleanCompany(contact.company),
      section: contact.section || this.inferSection(contact.role),
      source: contact.source || 'unknown',
      confidence: contact.confidence || 0.5,
      lineNumber: contact.lineNumber || 0,
      rawMatch: contact.rawMatch || ''
    };
  }

  /**
   * Clean and normalize name field
   */
  cleanName(name) {
    if (!name || typeof name !== 'string') return '';
    
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .replace(/\b\w/g, l => l.toUpperCase()) // Title case
      .trim();
  }

  /**
   * Clean and normalize role field
   */
  cleanRole(role) {
    if (!role || typeof role !== 'string') return 'Contact';
    
    let cleaned = role.trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
      .trim();

    // Normalize common role variations
    const roleNormalizations = {
      'MAKE UP ARTIST': 'MUA',
      'MAKEUP ARTIST': 'MUA',
      'MAKE-UP ARTIST': 'MUA',
      'HAIR STYLIST': 'HAIRSTYLIST',
      'PHOTO GRAPHER': 'PHOTOGRAPHER',
      'CREATIVE DIR': 'CREATIVE DIRECTOR',
      'ART DIR': 'ART DIRECTOR',
      'PROD': 'PRODUCER'
    };

    for (const [variation, standard] of Object.entries(roleNormalizations)) {
      if (cleaned.includes(variation)) {
        cleaned = cleaned.replace(variation, standard);
      }
    }

    return cleaned;
  }

  /**
   * Clean and normalize email field
   */
  cleanEmail(email) {
    if (!email || typeof email !== 'string') return '';
    
    const cleaned = email.trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(cleaned) ? cleaned : '';
  }

  /**
   * Clean and normalize phone field
   */
  cleanPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    
    // Extract digits
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      const us = digits.substring(1);
      return `(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}`;
    }
    
    // Return original if we can't format it
    return phone.trim();
  }

  /**
   * Clean and normalize company field
   */
  cleanCompany(company) {
    if (!company || typeof company !== 'string') return '';
    
    return company.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.&]/g, '')
      .trim();
  }

  /**
   * Infer section based on role
   */
  inferSection(role) {
    if (!role || typeof role !== 'string') return 'OTHER';
    
    const roleUpper = role.toUpperCase();
    
    if (roleUpper.includes('PHOTOGRAPHER') || roleUpper.includes('CAMERA')) return 'CREW';
    if (roleUpper.includes('MODEL') || roleUpper.includes('TALENT')) return 'TALENT';
    if (roleUpper.includes('PRODUCER') || roleUpper.includes('DIRECTOR')) return 'PRODUCTION';
    if (roleUpper.includes('STYLIST') || roleUpper.includes('MUA')) return 'CREW';
    if (roleUpper.includes('CLIENT') || roleUpper.includes('AGENCY')) return 'CLIENT';
    if (roleUpper.includes('HAIR') || roleUpper.includes('MAKEUP')) return 'CREW';
    
    return 'CREW';
  }

  /**
   * Validate that contact has required information
   */
  isValidContact(contact) {
    if (!contact || typeof contact !== 'object') {
      return false;
    }

    // Must have at least a name
    if (!contact.name || contact.name.length < 2) {
      return false;
    }

    // Name should not be too long (likely extraction error)
    if (contact.name.length > 100) {
      return false;
    }

    // More lenient validation - accept contacts with just name and role
    const hasContactInfo = (contact.phone && contact.phone.length > 0) || 
                          (contact.email && contact.email.length > 0);
    const hasMeaningfulRole = contact.role && contact.role.length > 0;
    const hasReasonableName = contact.name && contact.name.length >= 2;

    // Accept if has name and either contact info OR meaningful role
    if (!hasReasonableName) {
      return false;
    }

    // Check for obvious extraction errors
    if (this.isLikelyExtractionError(contact)) {
      return false;
    }

    return true;
  }

  /**
   * Check if contact is likely an extraction error
   */
  isLikelyExtractionError(contact) {
    // Check for common extraction errors
    const name = contact.name || '';
    
    // Names that are too short or contain numbers/symbols
    if (name.length < 2 || /\d/.test(name) || /[^\w\s\-\.]/.test(name)) {
      return true;
    }

    // Names that are likely not names
    const nonNamePatterns = [
      /^(page|line|row|column|table|header|footer)/i,
      /^(call|time|date|location|address)/i,
      /^(note|notes|important|please)/i,
      /^\d+$/,
      /^[A-Z]{1}$/
    ];

    if (nonNamePatterns.some(pattern => pattern.test(name))) {
      return true;
    }

    return false;
  }

  /**
   * Calculate confidence score for contact
   */
  calculateConfidenceScore(contact) {
    let confidence = contact.confidence || 0.5;
    
    // Boost confidence based on completeness
    if (contact.name && contact.name.length > 2) confidence += 0.2;
    if (contact.role && contact.role !== 'Contact') confidence += 0.1;
    if (contact.phone && contact.phone.length > 0) confidence += 0.1;
    if (contact.email && contact.email.length > 0) confidence += 0.1;
    if (contact.company && contact.company.length > 0) confidence += 0.05;
    
    // Boost confidence for recognized roles
    if (contact.role && this.roleKeywords.some(keyword => 
      contact.role.toUpperCase().includes(keyword))) {
      confidence += 0.1;
    }
    
    // Reduce confidence for potential issues
    if (contact.name && contact.name.length < 4) confidence -= 0.1;
    if (!contact.phone && !contact.email) confidence -= 0.2;
    
    // Ensure confidence is between 0 and 1
    contact.confidence = Math.max(0, Math.min(1, confidence));
    
    return contact;
  }

  /**
   * Sort contacts by importance and confidence
   */
  sortContacts(contacts) {
    return contacts.sort((a, b) => {
      // First sort by role priority
      const aPriority = this.rolePriority[a.role] || 99;
      const bPriority = this.rolePriority[b.role] || 99;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then by confidence
      return (b.confidence || 0) - (a.confidence || 0);
    });
  }

  /**
   * Filter contacts by role preferences
   */
  filterByRolePreferences(contacts, preferences) {
    if (!preferences || !Array.isArray(preferences) || preferences.length === 0) {
      return contacts;
    }

    const prefSet = new Set(preferences.map(p => p.toUpperCase()));
    
    return contacts.filter(contact => 
      prefSet.has(contact.role) || 
      preferences.some(pref => 
        contact.role.includes(pref.toUpperCase())
      )
    );
  }

  /**
   * Calculate overall confidence for a set of contacts
   */
  calculateOverallConfidence(contacts) {
    if (!contacts || contacts.length === 0) return 0;
    
    const totalConfidence = contacts.reduce((sum, contact) => 
      sum + (contact.confidence || 0), 0);
    
    return totalConfidence / contacts.length;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(originalContacts, validatedContacts) {
    return {
      originalCount: originalContacts.length,
      validatedCount: validatedContacts.length,
      rejectedCount: originalContacts.length - validatedContacts.length,
      averageConfidence: this.calculateOverallConfidence(validatedContacts),
      sectionsFound: [...new Set(validatedContacts.map(c => c.section))],
      rolesFound: [...new Set(validatedContacts.map(c => c.role))]
    };
  }
}

module.exports = new ContactValidator();
