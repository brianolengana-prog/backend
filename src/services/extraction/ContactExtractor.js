/**
 * Contact Extractor - Handles contact extraction using patterns
 * Single Responsibility: Contact pattern matching and extraction
 */

class ContactExtractor {
  constructor() {
    this.patterns = [
      // Pattern 1: Role: Name / Company Agent / Phone
      {
        name: 'role_name_company_phone',
        regex: /^([^:]+):\s*([A-Z\s]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/gmi,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          company: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 2: Role: Name / Phone (simple format)
      {
        name: 'role_name_phone',
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*(.+)/gm,
        extract: (match) => {
          // Check if this is the complex format (Name / Company / Phone)
          if (match[2].includes('/') && match[3].includes('/')) {
            return null; // Let other patterns handle this
          }
          return {
            role: match[1].trim(),
            name: this.normalizeName(match[2]),
            phone: this.extractPhone(match[3]),
            confidence: 0.85
          };
        }
      },
      // Pattern 3: Role: Name / Company / Phone (for call sheets)
      {
        name: 'role_name_company_phone_detailed',
        regex: /^([^:]+):\s*([^\/]+)\s*\/\s*([^\/]+)\s*\/\s*(.+)/gm,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          company: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 4: Name | Email | Phone | Role
      {
        name: 'table_format',
        regex: /^([^|]+)\|([^|]+)\|([^|]+)\|(.+)$/gm,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          email: this.extractEmail(match[2]),
          phone: this.extractPhone(match[3]),
          role: match[4].trim(),
          confidence: 0.9
        })
      },
      // Pattern 5: Tab-delimited: Name\tRole\tEmail\tPhone
      {
        name: 'tab_delimited',
        regex: /^([^\t]+)\t([^\t]+)\t([^\t\s]+@[^\t\s]+)\t(.+)$/gm,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          role: match[2].trim(),
          email: match[3].trim(),
          phone: this.extractPhone(match[4]),
          confidence: 0.9
        })
      },
      // Pattern 6: Simple role: name format (common in call sheets)
      {
        name: 'simple_role_name',
        regex: /^([A-Z][A-Z\s&\/]+):\s*([A-Za-z\s\-'\.]+)$/gm,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          confidence: 0.7
        })
      },
      // Pattern 7: Role: Name followed by phone on next line
      {
        name: 'role_name_phone_nextline',
        regex: /^([A-Z][A-Z\s&\/]+):\s*([A-Za-z\s\-'\.]+)\s*\n\s*([+\d\s\-\(\)]{8,})/gm,
        extract: (match) => ({
          role: match[1].trim(),
          name: this.normalizeName(match[2]),
          phone: this.extractPhone(match[3]),
          confidence: 0.85
        })
      },
      // Pattern 8: Name with phone in parentheses
      {
        name: 'name_phone_parentheses',
        regex: /([A-Za-z\s\-'\.]{2,})\s*\(([+\d\s\-]{8,})\)/gm,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          phone: this.extractPhone(match[2]),
          confidence: 0.75
        })
      },
      // Pattern 9: Flexible contact extraction
      {
        name: 'flexible_contact',
        regex: /([A-Za-z\s\-'\.]{2,})\s*[\/\|\-\s]*\s*([+\d\s\-\(\)]{8,})/gm,
        extract: (match) => ({
          name: this.normalizeName(match[1]),
          phone: this.extractPhone(match[2]),
          confidence: 0.6
        })
      }
    ];

    this.skipPatterns = [
      /^(Call Time|Location|Date|Shoot Date|Project|Client|Agency):/i,
      /^(Note|Notes|Important|Please|Contact for|Send to):/i,
      /^\d{1,2}:\d{2}\s*(AM|PM)/i,
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
      /^[\d\s\-\/]+$/,
      /^(Table|Row|Column|Page)/i
    ];
  }

  /**
   * Extract contacts from text using patterns
   */
  async extractContacts(text, options = {}) {
    const contacts = [];
    const lines = text.split('\n');
    const maxContacts = options.maxContacts || 1000;
    const maxProcessingTime = options.maxProcessingTime || 15000;
    const startTime = Date.now();
    
    console.log('🔍 Extracting contacts from text', {
      textLength: text.length,
      maxContacts,
      maxProcessingTime
    });

    // Try each pattern with early exit and detailed logging
    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      const patternStartTime = Date.now();
      
      // Check for timeout before processing each pattern
      if (Date.now() - startTime > maxProcessingTime) {
        console.warn('⏰ Pattern extraction timeout reached', {
          processedPatterns: i,
          totalPatterns: this.patterns.length,
          contactsFound: contacts.length,
          processingTime: `${Date.now() - startTime}ms`
        });
        break;
      }
      
      try {
        console.log(`🔍 Testing pattern ${i + 1}/${this.patterns.length}: ${pattern.name}`);
        
        const matches = [...text.matchAll(pattern.regex)];
        console.log(`📊 Pattern ${pattern.name} found ${matches.length} matches`);
        
        // Limit matches per pattern to prevent hanging
        const maxMatchesPerPattern = 500;
        const limitedMatches = matches.slice(0, maxMatchesPerPattern);
        
        if (matches.length > maxMatchesPerPattern) {
          console.log(`⚠️ Limiting pattern ${pattern.name} to ${maxMatchesPerPattern} matches (found ${matches.length})`);
        }
        
        for (let j = 0; j < limitedMatches.length; j++) {
          const match = limitedMatches[j];
          const contact = pattern.extract(match);
          
          if (contact && this.isValidContact(contact)) {
            contact.source = pattern.name;
            contact.lineNumber = this.findLineNumber(text, match.index);
            contact.rawMatch = match[0];
            contacts.push(contact);
            
            // Early exit if we have enough contacts
            if (contacts.length >= maxContacts) {
              console.log('⚡ Early exit: reached max contacts', { 
                found: contacts.length, 
                maxContacts,
                processingTime: `${Date.now() - startTime}ms`
              });
              break;
            }
          }
        }
        
        const patternTime = Date.now() - patternStartTime;
        console.log(`✅ Pattern ${pattern.name} completed in ${patternTime}ms`, {
          matches: limitedMatches.length,
          validContacts: contacts.filter(c => c.source === pattern.name).length
        });
        
        // Break outer loop if we hit the limit
        if (contacts.length >= maxContacts) break;
        
      } catch (error) {
        console.warn('⚠️ Pattern failed', { 
          pattern: pattern.name, 
          error: error.message,
          processingTime: `${Date.now() - patternStartTime}ms`
        });
      }
    }

    // Remove duplicates and return
    const uniqueContacts = this.removeDuplicates(contacts);
    
    console.log('📊 Pattern extraction results', {
      totalMatches: contacts.length,
      uniqueContacts: uniqueContacts.length,
      processingTime: `${Date.now() - startTime}ms`
    });

    return uniqueContacts;
  }

  /**
   * Normalize name field
   */
  normalizeName(name) {
    if (!name) return '';
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .trim();
  }

  /**
   * Extract phone number from text
   */
  extractPhone(text) {
    if (!text) return '';
    
    // Remove non-digit characters except + at the beginning
    const cleaned = text.replace(/[^\d+]/g, '');
    
    // Look for phone patterns
    const phoneMatch = text.match(/[\+]?[\d\s\-\(\)]{8,}/);
    if (phoneMatch) {
      const digits = phoneMatch[0].replace(/\D/g, '');
      if (digits.length >= 10) {
        return this.formatPhone(digits);
      }
    }
    
    return text.trim();
  }

  /**
   * Format phone number
   */
  formatPhone(digits) {
    if (digits.length === 10) {
      return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      const us = digits.substring(1);
      return `(${us.substring(0, 3)}) ${us.substring(3, 6)}-${us.substring(6)}`;
    }
    return digits;
  }

  /**
   * Extract email from text
   */
  extractEmail(text) {
    if (!text) return '';
    
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    return emailMatch ? emailMatch[0].toLowerCase() : '';
  }

  /**
   * Check if contact is valid
   */
  isValidContact(contact) {
    if (!contact) return false;
    
    // Must have at least a name or role
    if (!contact.name && !contact.role) return false;
    
    // Name should be reasonable length
    if (contact.name && (contact.name.length < 2 || contact.name.length > 100)) return false;
    
    // Should have some contact info (phone or email)
    if (!contact.phone && !contact.email) {
      // Allow contacts with just name/role if they seem legitimate
      return contact.name && contact.name.length > 2;
    }
    
    return true;
  }

  /**
   * Find line number for a match index
   */
  findLineNumber(text, matchIndex) {
    if (!matchIndex) return 1;
    
    const textBeforeMatch = text.substring(0, matchIndex);
    return textBeforeMatch.split('\n').length;
  }

  /**
   * Remove duplicate contacts
   */
  removeDuplicates(contacts) {
    const seen = new Set();
    return contacts.filter(contact => {
      const key = this.getContactKey(contact);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate unique key for contact deduplication
   */
  getContactKey(contact) {
    const name = (contact.name || '').toLowerCase().trim();
    const phone = (contact.phone || '').replace(/\D/g, '');
    const email = (contact.email || '').toLowerCase().trim();
    
    return `${name}_${phone}_${email}`;
  }

  /**
   * Check if line should be skipped
   */
  shouldSkipLine(line) {
    return this.skipPatterns.some(pattern => pattern.test(line));
  }
}

module.exports = new ContactExtractor();
