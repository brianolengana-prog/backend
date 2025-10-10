/**
 * Extraction Adapter
 * 
 * Adapts enterprise extractor to work with existing infrastructure
 * Maintains backward compatibility while enabling new features
 */

const EnterpriseExtractionService = require('./EnterpriseExtractionService');

class ExtractionAdapter {
  /**
   * Convert enterprise result to legacy format
   */
  toLegacyFormat(enterpriseResult) {
    if (!enterpriseResult.success) {
      return {
        success: false,
        contacts: [],
        metadata: enterpriseResult.metadata
      };
    }

    // Convert contacts to legacy format (remove enterprise-specific fields)
    const legacyContacts = enterpriseResult.contacts.map(contact => ({
      name: contact.name,
      role: contact.role,
      phone: contact.phone,
      email: contact.email,
      company: contact.company || '',
      
      // Keep confidence for quality assessment
      confidence: contact.confidence,
      
      // Keep source for debugging
      source: contact.source
    }));

    return {
      success: true,
      contacts: legacyContacts,
      metadata: {
        ...enterpriseResult.metadata,
        extractorsUsed: ['component-first-enterprise'],
        confidence: enterpriseResult.quality?.averageConfidence,
        qualityGrade: enterpriseResult.quality?.grade
      },
      processingTime: enterpriseResult.processingTime
    };
  }

  /**
   * Extract contacts (legacy interface)
   */
  async extractContacts(text, options = {}) {
    const enterpriseResult = await EnterpriseExtractionService.extractContacts(text, options);
    return this.toLegacyFormat(enterpriseResult);
  }
}

module.exports = new ExtractionAdapter();

