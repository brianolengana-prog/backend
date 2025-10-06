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
      .filter(contact => this.isValidContact(contact));
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
      company: this.cleanCompany(contact.company)
    };
  }

  /**
   * Clean and normalize name field
   */
  cleanName(name) {
    if (!name || typeof name !== 'string') return '';
    
    let cleaned = name.trim();
    
    // Remove common domain prefixes that get captured
    cleaned = cleaned.replace(/^(com|gmail\.com|loreal\.com|primecontent\.com|seemanagement\.com|danielrothmandp\.com)\s+/i, '');
    
    // Remove table headers and formatting artifacts
    cleaned = cleaned.replace(/^(PRODUCTION|Name|Phone|Call Time|Location|E-mail|VIDEO CALL SHEET DATE)\s+/i, '');
    
    // Remove role prefixes if they're duplicated in the name
    const roleWords = ['Producer', 'Photographer', 'Director', 'Assistant', 'Makeup', 'Stylist', 'Gaffer', 'Grip', 'Colorist', 'Executive Producer', 'First Assistant', 'Director of Photography', 'AC', 'iPhone Video', 'Wardrobe Stylist', 'Set Design', 'Production Assistant'];
    roleWords.forEach(role => {
      const regex = new RegExp(`^${role}\\s+`, 'i');
      cleaned = cleaned.replace(regex, '');
    });
    
    // Clean up formatting
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .trim();
    
    // Apply title case only if it looks like a proper name
    if (cleaned.length > 0 && cleaned.length < 50) {
      cleaned = cleaned.replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return cleaned;
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
    
    let cleaned = phone.trim();
    
    // Remove "- -" placeholder
    if (cleaned === '- -' || cleaned === '--') {
      return '';
    }
    
    // Remove trailing numbers that aren't part of phone (like "8", "10", "11")
    cleaned = cleaned.replace(/\s+\d{1,2}$/, '');
    
    // Extract digits
    const digits = cleaned.replace(/\D/g, '');
    
    // Skip if no digits or too few digits
    if (digits.length < 7) {
      return '';
    }
    
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      const us = digits.substring(1);
      return `(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}`;
    }
    
    // Return cleaned version if we can't format it properly
    return cleaned;
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
    
    // Names that are too short or contain inappropriate content
    if (name.length < 2) {
      return true;
    }

    // Names that are likely not names
    const nonNamePatterns = [
      /^(page|line|row|column|table|header|footer)/i,
      /^(call|time|date|location|address)/i,
      /^(note|notes|important|please)/i,
      /^(tuesday|monday|wednesday|thursday|friday|saturday|sunday)$/i,
      /^(production|name|phone|call time|location|e-mail)$/i,
      /^\d+$/,
      /^[A-Z]{1,2}$/,
      /^th Fl$/i, // Specific to your data
      /mail Executive Producer/i, // Table header artifacts
      /august 19th, 2025/i // Date artifacts
    ];

    if (nonNamePatterns.some(pattern => pattern.test(name))) {
      return true;
    }

    // Check for names that are too long (likely table headers or descriptions)
    if (name.length > 80) {
      return true;
    }

    // Check for names that contain email-like content
    if (name.includes('@') || name.includes('.com') || name.includes('gmail') || name.includes('loreal')) {
      return true;
    }

    // Check if the name contains call time or location info
    if (name.includes('Call Time') || name.includes('Location') || name.includes('E-mail')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate quality score for contact (for internal use only)
   */
  calculateQualityScore(contact) {
    let score = 0.5;
    
    // Boost score based on completeness
    if (contact.name && contact.name.length > 2) score += 0.2;
    if (contact.role && contact.role !== 'Contact') score += 0.1;
    if (contact.phone && contact.phone.length > 0) score += 0.1;
    if (contact.email && contact.email.length > 0) score += 0.1;
    if (contact.company && contact.company.length > 0) score += 0.05;
    
    // Boost score for recognized roles
    if (contact.role && this.roleKeywords.some(keyword => 
      contact.role.toUpperCase().includes(keyword))) {
      score += 0.1;
    }
    
    // Reduce score for potential issues
    if (contact.name && contact.name.length < 4) score -= 0.1;
    if (!contact.phone && !contact.email) score -= 0.2;
    
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Sort contacts by importance (role priority)
   */
  sortContacts(contacts) {
    return contacts.sort((a, b) => {
      // Sort by role priority
      const aPriority = this.rolePriority[a.role] || 99;
      const bPriority = this.rolePriority[b.role] || 99;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then by name alphabetically
      return (a.name || '').localeCompare(b.name || '');
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
   * Calculate overall quality for a set of contacts (for internal metrics)
   */
  calculateOverallQuality(contacts) {
    if (!contacts || contacts.length === 0) return 0;
    
    const totalQuality = contacts.reduce((sum, contact) => 
      sum + this.calculateQualityScore(contact), 0);
    
    return totalQuality / contacts.length;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(originalContacts, validatedContacts) {
    return {
      originalCount: originalContacts.length,
      validatedCount: validatedContacts.length,
      rejectedCount: originalContacts.length - validatedContacts.length,
      rolesFound: [...new Set(validatedContacts.map(c => c.role))]
    };
  }
}

module.exports = new ContactValidator();
