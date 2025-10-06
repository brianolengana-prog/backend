/**
 * Predefined AI Prompts Service
 * Specialized prompts for different call sheet types and scenarios
 */

class PredefinedPromptsService {
  constructor() {
    this.prompts = {
      // Fashion/Editorial Call Sheets
      'fashion_editorial': {
        system: `You are an expert at extracting contact information from fashion and editorial call sheets. Focus on:
- Photographers, stylists, makeup artists, hair stylists
- Models with their agencies and representation
- Creative directors, art directors, producers
- Location contacts, catering, security
- Any crew members with contact information`,
        user: `Extract all contacts from this fashion/editorial call sheet. Look for:
1. Crew: Role: Name / Phone format
2. Models: Model: Name / Agency / Phone format
3. Team: Role: Name / Phone format
4. Vendors: Company / Contact / Phone format

Return JSON array with: name, role, phone, email, company, section (CREW/TALENT/PRODUCTION/VENDOR)`
      },

      // Commercial/Advertising Call Sheets
      'commercial_advertising': {
        system: `You are an expert at extracting contact information from commercial and advertising call sheets. Focus on:
- Agency contacts (creative directors, account managers)
- Client contacts and brand representatives
- Production crew (directors, producers, coordinators)
- Talent and their representation
- Vendor contacts (catering, equipment, locations)`,
        user: `Extract all contacts from this commercial/advertising call sheet. Look for:
1. Agency: Role: Name / Phone format
2. Client: Company / Contact / Phone format
3. Crew: Role: Name / Phone format
4. Talent: Name / Agency / Phone format

Return JSON array with: name, role, phone, email, company, section (AGENCY/CLIENT/CREW/TALENT)`
      },

      // Film/TV Production Call Sheets
      'film_tv_production': {
        system: `You are an expert at extracting contact information from film and TV production call sheets. Focus on:
- Above-the-line crew (directors, producers, writers)
- Below-the-line crew (camera, sound, lighting, grip)
- Cast members and their representation
- Department heads and assistants
- Location and vendor contacts`,
        user: `Extract all contacts from this film/TV production call sheet. Look for:
1. Above-the-line: Role: Name / Phone format
2. Crew: Department: Name / Phone format
3. Cast: Character: Actor / Agency / Phone format
4. Vendors: Company / Contact / Phone format

Return JSON array with: name, role, phone, email, company, section (ABOVE_LINE/BELOW_LINE/CAST/VENDOR)`
      },

      // Event/Corporate Call Sheets
      'event_corporate': {
        system: `You are an expert at extracting contact information from event and corporate call sheets. Focus on:
- Event coordinators and managers
- Vendor contacts (catering, AV, security, decor)
- Client contacts and stakeholders
- Staff and volunteers
- Venue contacts`,
        user: `Extract all contacts from this event/corporate call sheet. Look for:
1. Event Team: Role: Name / Phone format
2. Vendors: Company / Contact / Phone format
3. Client: Company / Contact / Phone format
4. Venue: Location / Contact / Phone format

Return JSON array with: name, role, phone, email, company, section (EVENT_TEAM/VENDOR/CLIENT/VENUE)`
      },

      // Music Video Call Sheets
      'music_video': {
        system: `You are an expert at extracting contact information from music video call sheets. Focus on:
- Artist and their management
- Director and creative team
- Production crew (camera, lighting, sound)
- Label and record company contacts
- Location and vendor contacts`,
        user: `Extract all contacts from this music video call sheet. Look for:
1. Artist: Name / Management / Phone format
2. Director: Role: Name / Phone format
3. Crew: Role: Name / Phone format
4. Label: Company / Contact / Phone format

Return JSON array with: name, role, phone, email, company, section (ARTIST/DIRECTOR/CREW/LABEL)`
      },

      // Wedding/Portrait Call Sheets
      'wedding_portrait': {
        system: `You are an expert at extracting contact information from wedding and portrait call sheets. Focus on:
- Photographers and assistants
- Couple and family contacts
- Venue and vendor contacts
- Wedding planners and coordinators
- Hair and makeup artists`,
        user: `Extract all contacts from this wedding/portrait call sheet. Look for:
1. Photographer: Name / Phone format
2. Couple: Names / Phone format
3. Vendors: Company / Contact / Phone format
4. Venue: Location / Contact / Phone format

Return JSON array with: name, role, phone, email, company, section (PHOTOGRAPHER/COUPLE/VENDOR/VENUE)`
      },

      // Validation Prompts (for enhancing existing extractions)
      'validation': {
        system: `You are an expert at validating and enhancing contact information from call sheets. Your job is to:
- Verify the accuracy of extracted contacts
- Add missing contacts that were overlooked
- Correct any errors in names, roles, or contact information
- Ensure all contacts have proper categorization`,
        user: `Please validate and enhance these extracted contacts from a call sheet:

EXTRACTED CONTACTS:
{contacts}

ORIGINAL TEXT:
{text}

Please:
1. Verify each contact is accurate
2. Add any missing contacts
3. Correct any errors
4. Ensure proper role categorization
5. Return the complete, validated list

Return JSON array with: name, role, phone, email, company, section`
      },

      // Enhancement Prompts (for improving simple extractions)
      'enhancement': {
        system: `You are an expert at enhancing contact extractions from call sheets. Your job is to:
- Take basic extracted contacts and enrich them
- Add missing contact information
- Improve role categorization
- Add context and additional details`,
        user: `Please enhance these basic contact extractions from a call sheet:

BASIC EXTRACTIONS:
{contacts}

ORIGINAL TEXT:
{text}

Please:
1. Enrich each contact with additional information
2. Add missing contacts
3. Improve role categorization
4. Add company/agency information where available
5. Return the enhanced contact list

Return JSON array with: name, role, phone, email, company, section`
      },

      // Quality Assurance Prompts
      'quality_assurance': {
        system: `You are a quality assurance expert for contact extraction. Your job is to:
- Review extracted contacts for accuracy
- Identify and flag potential errors
- Suggest improvements for extraction quality
- Provide confidence scores for each contact`,
        user: `Please review these extracted contacts for quality and accuracy:

EXTRACTED CONTACTS:
{contacts}

ORIGINAL TEXT:
{text}

Please:
1. Review each contact for accuracy
2. Flag any potential errors
3. Suggest improvements
4. Provide confidence scores (0-1) for each contact
5. Return the reviewed contacts with quality scores

Return JSON array with: name, role, phone, email, company, section, confidence, quality_notes`
      }
    };

    // Document type detection patterns
    this.detectionPatterns = {
      'fashion_editorial': [
        'editorial', 'fashion', 'model', 'stylist', 'mua', 'photographer',
        'magazine', 'shoot', 'lookbook', 'catalog', 'runway'
      ],
      'commercial_advertising': [
        'commercial', 'advertising', 'brand', 'client', 'agency',
        'campaign', 'marketing', 'ad', 'spot'
      ],
      'film_tv_production': [
        'film', 'movie', 'tv', 'television', 'production', 'director',
        'producer', 'actor', 'actress', 'crew', 'shooting'
      ],
      'event_corporate': [
        'event', 'corporate', 'conference', 'meeting', 'party',
        'wedding', 'celebration', 'gala', 'convention'
      ],
      'music_video': [
        'music video', 'mv', 'artist', 'band', 'singer', 'rapper',
        'label', 'record', 'album', 'song'
      ],
      'wedding_portrait': [
        'wedding', 'portrait', 'engagement', 'bridal', 'couple',
        'ceremony', 'reception', 'photography'
      ]
    };
  }

  /**
   * Get the best prompt for a given document
   */
  getPrompt(documentType, text, options = {}) {
    // Detect document type if not provided
    if (!documentType || documentType === 'unknown') {
      documentType = this.detectDocumentType(text);
    }

    // Get base prompt
    const basePrompt = this.prompts[documentType] || this.prompts['fashion_editorial'];

    // Apply options and customizations
    return this.customizePrompt(basePrompt, text, options);
  }

  /**
   * Detect document type from text content
   */
  detectDocumentType(text) {
    const textLower = text.toLowerCase();
    let bestMatch = 'fashion_editorial';
    let bestScore = 0;

    for (const [type, patterns] of Object.entries(this.detectionPatterns)) {
      const matches = patterns.filter(pattern => 
        textLower.includes(pattern.toLowerCase())
      ).length;
      
      const score = matches / patterns.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    return bestMatch;
  }

  /**
   * Customize prompt based on options and context
   */
  customizePrompt(basePrompt, text, options) {
    let systemPrompt = basePrompt.system;
    let userPrompt = basePrompt.user;

    // Add role preferences if specified
    if (options.rolePreferences && options.rolePreferences.length > 0) {
      systemPrompt += `\n\nFocus specifically on these roles: ${options.rolePreferences.join(', ')}.`;
    }

    // Add extraction mode instructions
    if (options.mode === 'validation') {
      systemPrompt += `\n\nYou are validating existing extractions. Review and improve the provided contacts.`;
    } else if (options.mode === 'enhancement') {
      systemPrompt += `\n\nYou are enhancing basic extractions. Add missing information and improve categorization.`;
    }

    // Add specific instructions based on document characteristics
    if (text.includes('@')) {
      userPrompt += `\n\nPay special attention to email addresses in the document.`;
    }

    if (text.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g)) {
      userPrompt += `\n\nPay special attention to phone numbers in the document.`;
    }

    // Add confidence requirements
    if (options.requireHighConfidence) {
      systemPrompt += `\n\nOnly include contacts you are highly confident about. When in doubt, exclude rather than include.`;
    }

    return {
      system: systemPrompt,
      user: userPrompt
    };
  }

  /**
   * Get validation prompt for existing contacts
   */
  getValidationPrompt(contacts, text) {
    const prompt = this.prompts['validation'];
    return {
      system: prompt.system,
      user: prompt.user
        .replace('{contacts}', JSON.stringify(contacts, null, 2))
        .replace('{text}', text.substring(0, 2000)) // Limit text length
    };
  }

  /**
   * Get enhancement prompt for basic extractions
   */
  getEnhancementPrompt(contacts, text) {
    const prompt = this.prompts['enhancement'];
    return {
      system: prompt.system,
      user: prompt.user
        .replace('{contacts}', JSON.stringify(contacts, null, 2))
        .replace('{text}', text.substring(0, 2000)) // Limit text length
    };
  }

  /**
   * Get quality assurance prompt
   */
  getQualityAssurancePrompt(contacts, text) {
    const prompt = this.prompts['quality_assurance'];
    return {
      system: prompt.system,
      user: prompt.user
        .replace('{contacts}', JSON.stringify(contacts, null, 2))
        .replace('{text}', text.substring(0, 2000)) // Limit text length
    };
  }

  /**
   * Get all available document types
   */
  getAvailableTypes() {
    return Object.keys(this.prompts);
  }

  /**
   * Get detection patterns for a specific type
   */
  getDetectionPatterns(type) {
    return this.detectionPatterns[type] || [];
  }

  /**
   * Add custom prompt for a new document type
   */
  addCustomPrompt(type, systemPrompt, userPrompt) {
    this.prompts[type] = {
      system: systemPrompt,
      user: userPrompt
    };
  }

  /**
   * Get prompt statistics
   */
  getStats() {
    return {
      totalPrompts: Object.keys(this.prompts).length,
      availableTypes: Object.keys(this.prompts),
      detectionPatterns: Object.keys(this.detectionPatterns).length
    };
  }
}

module.exports = new PredefinedPromptsService();
