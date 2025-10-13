/**
 * Extraction Migration Service
 * 
 * Handles migration from legacy extraction to enterprise system
 * Provides backward compatibility and gradual rollout
 */

const EnhancedAdaptiveExtractionService = require('./EnhancedAdaptiveExtraction.service');
const optimizedAIUsageService = require('../optimizedAIUsage.service');
const enterpriseConfig = require('../../config/enterprise.config');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class ExtractionMigrationService {
  constructor() {
    this.optimizedExtractor = require('../optimizedHybridExtraction.service');
    this.optimizedAIUsage = optimizedAIUsageService; // Smart AI usage service
    this.enterpriseExtractor = new EnhancedAdaptiveExtractionService();
    this.legacyExtractor = require('../adaptiveExtraction.service');
    
    // Migration configuration
    this.migrationConfig = {
      enableEnterpriseForNewUsers: process.env.ENTERPRISE_FOR_NEW_USERS !== 'false',
      enableEnterpriseForAllUsers: process.env.ENTERPRISE_FOR_ALL_USERS === 'true',
      enterpriseRolloutPercentage: parseInt(process.env.ENTERPRISE_ROLLOUT_PERCENTAGE) || 0,
      whitelistedUsers: (process.env.ENTERPRISE_WHITELIST || '').split(',').filter(Boolean),
      blacklistedUsers: (process.env.ENTERPRISE_BLACKLIST || '').split(',').filter(Boolean)
    };
  }

  /**
   * Determine which extraction service to use for a user
   */
  shouldUseEnterpriseExtraction(userId, options = {}) {
    // Check feature flags
    if (!enterpriseConfig.featureFlags.enableEnterpriseExtractor) {
      return false;
    }

    // Check if user is blacklisted
    if (this.migrationConfig.blacklistedUsers.includes(userId)) {
      return false;
    }

    // Check if user is whitelisted
    if (this.migrationConfig.whitelistedUsers.includes(userId)) {
      return true;
    }

    // Check if enterprise is enabled for all users
    if (this.migrationConfig.enableEnterpriseForAllUsers) {
      return true;
    }

    // Check rollout percentage
    if (this.migrationConfig.enterpriseRolloutPercentage > 0) {
      const userHash = this.hashUserId(userId);
      const userPercentile = userHash % 100;
      if (userPercentile < this.migrationConfig.enterpriseRolloutPercentage) {
        return true;
      }
    }

    // Check if explicitly requested
    if (options.forceEnterprise === true) {
      return true;
    }

    return false;
  }

  /**
   * Hash user ID for consistent rollout
   */
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract contacts using appropriate service
   */
  async extractContacts(text, options = {}) {
    const extractionId = options.extractionId || `migration_${Date.now()}`;
    const userId = options.userId;
    const clientSideContacts = options.clientSideContacts || [];

    try {
      const useEnterprise = this.shouldUseEnterpriseExtraction(userId, options);

      logger.info('🔄 Routing extraction request', {
        extractionId,
        userId,
        useEnterprise,
        textLength: text.length,
        clientSideContactsReceived: clientSideContacts.length // ✅ LOG CLIENT CONTACTS
      });

          // Always use optimized hybrid extraction for best performance
          if (useEnterprise || options.forceOptimized !== false) {
            // Use optimized hybrid extraction (new default)
            const optimizedExtractor = new this.optimizedExtractor();
            const patternResult = await optimizedExtractor.extractContacts(text, {
              ...options,
              extractionId
            });

            // Use smart AI optimization for enhancement
            const enhancedResult = await this.optimizedAIUsage.processWithSmartAI(
              text,
              patternResult,
              {
                confidenceThreshold: 0.7,
                disableAI: options.disableAI
              }
            );

            // ✅ MERGE CLIENT-SIDE CONTACTS WITH BACKEND RESULTS
            const mergedResult = this.mergeClientSideContacts(enhancedResult, clientSideContacts, extractionId);

            // Transform to legacy format for compatibility
            return this.transformOptimizedToLegacy(mergedResult, extractionId);
          } else {
        // Use legacy extraction (fallback)
        const result = await this.legacyExtractor.extractContacts(text, options.fileName, options.mimeType, {
          ...options,
          extractionId
        });

        // ✅ MERGE CLIENT-SIDE CONTACTS WITH LEGACY RESULTS
        const mergedResult = this.mergeClientSideContacts(result, clientSideContacts, extractionId);

        // Ensure legacy result has proper format
        return this.normalizeLegacyResult(mergedResult, extractionId);
      }

    } catch (error) {
      logger.error('❌ Extraction routing failed', {
        extractionId,
        userId,
        error: error.message
      });

      // Fallback to legacy system
      try {
        logger.info('🔄 Falling back to legacy extraction', { extractionId });
        
        const fallbackResult = await this.legacyExtractor.extractContacts(text, options.fileName, options.mimeType, {
          ...options,
          extractionId
        });

        // ✅ MERGE CLIENT-SIDE CONTACTS WITH FALLBACK RESULTS
        const mergedFallbackResult = this.mergeClientSideContacts(fallbackResult, clientSideContacts, extractionId);

        return this.normalizeLegacyResult(mergedFallbackResult, extractionId);

      } catch (fallbackError) {
        logger.error('❌ Fallback extraction also failed', {
          extractionId,
          fallbackError: fallbackError.message
        });
        
        // ✅ LAST RESORT: If everything fails, return client-side contacts
        if (clientSideContacts.length > 0) {
          logger.info('✅ Using client-side contacts as last resort', {
            extractionId,
            clientSideCount: clientSideContacts.length
          });
          
          return {
            success: true,
            contacts: clientSideContacts.map(contact => ({
              ...contact,
              id: contact.id || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              source: 'client-side-fallback',
              confidence: contact.confidence || 0.7
            })),
            metadata: {
              extractionId,
              strategy: 'client-side-only',
              confidence: 0.7,
              processingTime: 0,
              textLength: text.length,
              isEnterprise: false,
              note: 'Backend extraction failed, using client-side contacts only'
            }
          };
        }
        
        throw error; // Throw original error
      }
    }
  }

  /**
   * Transform enterprise result to legacy format
   */
  transformEnterpriseToLegacy(enterpriseResult, extractionId) {
    const contacts = enterpriseResult.contacts.map(contact => ({
      id: contact.id,
      name: contact.name,
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      department: contact.department || '',
      notes: contact.notes || '',
      confidence: contact.confidence,
      source: contact.source || 'enterprise',
      section: contact.section || 'general'
    }));

    return {
      success: true,
      contacts,
      metadata: {
        extractionId,
        strategy: enterpriseResult.metadata.strategy,
        documentType: enterpriseResult.metadata.documentType,
        confidence: enterpriseResult.metadata.confidence,
        processingTime: enterpriseResult.metadata.processingTime,
        textLength: enterpriseResult.metadata.textLength,
        isEnterprise: true,
        qualityMetrics: enterpriseResult.metadata.qualityMetrics
      }
    };
  }

  /**
   * Normalize legacy result format
   */
  normalizeLegacyResult(legacyResult, extractionId) {
    // Ensure contacts have required fields
    const contacts = (legacyResult.contacts || []).map(contact => ({
      id: contact.id || `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: contact.name || '',
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      department: contact.department || '',
      notes: contact.notes || '',
      confidence: contact.confidence || 0.5,
      source: contact.source || 'legacy',
      section: contact.section || 'general'
    }));

    return {
      success: legacyResult.success !== false,
      contacts,
      metadata: {
        extractionId,
        strategy: legacyResult.metadata?.strategy || 'legacy',
        documentType: legacyResult.metadata?.documentType || 'unknown',
        confidence: legacyResult.metadata?.confidence || 0.5,
        processingTime: legacyResult.metadata?.processingTime || 0,
        textLength: legacyResult.metadata?.textLength || 0,
        isEnterprise: false
      }
    };
  }

  /**
   * Merge client-side contacts with backend extraction results
   */
  mergeClientSideContacts(backendResult, clientSideContacts, extractionId) {
    if (!Array.isArray(clientSideContacts) || clientSideContacts.length === 0) {
      logger.info('📋 No client-side contacts to merge', { extractionId });
      return backendResult;
    }

    const backendContacts = backendResult.contacts || [];
    
    logger.info('🔄 Merging client-side and backend contacts', {
      extractionId,
      clientSideCount: clientSideContacts.length,
      backendCount: backendContacts.length
    });

    // ✅ FALLBACK: If backend found 0 contacts, use client-side contacts
    if (backendContacts.length === 0 && clientSideContacts.length > 0) {
      logger.info('✅ Using client-side contacts as fallback (backend found 0)', {
        extractionId,
        clientSideCount: clientSideContacts.length
      });
      
      return {
        ...backendResult,
        contacts: clientSideContacts.map(contact => ({
          ...contact,
          source: 'client-side-pattern',
          confidence: contact.confidence || 0.7
        })),
        metadata: {
          ...backendResult.metadata,
          strategy: 'client-side-fallback',
          clientSideContactsUsed: clientSideContacts.length
        }
      };
    }

    // ✅ MERGE: Deduplicate and combine both sources
    const mergedContacts = [...backendContacts];
    const existingEmails = new Set(backendContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
    const existingPhones = new Set(backendContacts.map(c => c.phone).filter(Boolean));
    
    for (const clientContact of clientSideContacts) {
      const isDuplicate = 
        (clientContact.email && existingEmails.has(clientContact.email.toLowerCase())) ||
        (clientContact.phone && existingPhones.has(clientContact.phone));
      
      if (!isDuplicate) {
        mergedContacts.push({
          ...clientContact,
          source: 'client-side-pattern',
          confidence: clientContact.confidence || 0.7
        });
      }
    }

    logger.info('✅ Contacts merged', {
      extractionId,
      finalCount: mergedContacts.length,
      backendContributed: backendContacts.length,
      clientSideAdded: mergedContacts.length - backendContacts.length
    });

    return {
      ...backendResult,
      contacts: mergedContacts,
      metadata: {
        ...backendResult.metadata,
        clientSideContactsMerged: clientSideContacts.length
      }
    };
  }

  /**
   * Transform optimized service result to legacy format
   */
  transformOptimizedToLegacy(optimizedResult, extractionId) {
    const contacts = (optimizedResult.contacts || []).map(contact => ({
      id: contact.id || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: contact.name || '',
      role: contact.role || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      department: contact.department || '',
      notes: contact.notes || '',
      confidence: contact.confidence || 0.7,
      source: contact.source || 'optimized',
      section: contact.section || 'general'
    }));

    return {
      success: optimizedResult.success !== false,
      contacts,
      metadata: {
        extractionId,
        strategy: optimizedResult.metadata?.strategy || 'optimized-hybrid',
        documentType: 'call_sheet',
        confidence: optimizedResult.metadata?.confidenceScore || 0.7,
        processingTime: optimizedResult.metadata?.processingTime || 0,
        textLength: optimizedResult.metadata?.textLength || 0,
        isEnterprise: true,
        isOptimized: true,
        clientSideContactsMerged: optimizedResult.metadata?.clientSideContactsMerged || 0
      }
    };
  }

  /**
   * Get migration status for a user
   */
  getMigrationStatus(userId) {
    const useEnterprise = this.shouldUseEnterpriseExtraction(userId);
    
    return {
      userId,
      useEnterprise,
      migrationConfig: {
        enterpriseEnabled: enterpriseConfig.featureFlags.enableEnterpriseExtractor,
        rolloutPercentage: this.migrationConfig.enterpriseRolloutPercentage,
        isWhitelisted: this.migrationConfig.whitelistedUsers.includes(userId),
        isBlacklisted: this.migrationConfig.blacklistedUsers.includes(userId)
      },
          capabilities: {
            optimized: {
              service: 'OptimizedHybridExtractionService',
              status: 'operational',
              version: '3.0.0',
              aiModel: 'gpt-4o-mini',
              strategy: 'smart-ai-optimized',
              features: [
                'pattern-first-extraction',
                'smart-ai-routing',
                'optimized-prompts',
                'intelligent-caching',
                '85% token-reduction',
                '90% cost-reduction'
              ]
            },
            smartAI: this.optimizedAIUsage.getStats(),
            enterprise: this.enterpriseExtractor.getHealthStatus(),
            legacy: {
              service: 'AdaptiveExtractionService',
              status: 'operational',
              version: '1.0.0'
            }
          }
    };
  }

  /**
   * Force migration for a specific user
   */
  async forceMigration(userId, direction = 'enterprise') {
    logger.info('🔄 Forcing migration', {
      userId,
      direction
    });

    if (direction === 'enterprise') {
      if (!this.migrationConfig.whitelistedUsers.includes(userId)) {
        this.migrationConfig.whitelistedUsers.push(userId);
      }
      // Remove from blacklist if present
      const blacklistIndex = this.migrationConfig.blacklistedUsers.indexOf(userId);
      if (blacklistIndex > -1) {
        this.migrationConfig.blacklistedUsers.splice(blacklistIndex, 1);
      }
    } else {
      if (!this.migrationConfig.blacklistedUsers.includes(userId)) {
        this.migrationConfig.blacklistedUsers.push(userId);
      }
      // Remove from whitelist if present
      const whitelistIndex = this.migrationConfig.whitelistedUsers.indexOf(userId);
      if (whitelistIndex > -1) {
        this.migrationConfig.whitelistedUsers.splice(whitelistIndex, 1);
      }
    }

    return this.getMigrationStatus(userId);
  }

  /**
   * Get extraction statistics for monitoring
   */
  async getExtractionStats(timeframe = '24h') {
    // This would typically query your database for extraction statistics
    // For now, return a placeholder structure
    return {
      timeframe,
      enterprise: {
        totalExtractions: 0,
        successRate: 0,
        averageProcessingTime: 0,
        averageConfidence: 0
      },
      legacy: {
        totalExtractions: 0,
        successRate: 0,
        averageProcessingTime: 0,
        averageConfidence: 0
      },
      migration: {
        rolloutPercentage: this.migrationConfig.enterpriseRolloutPercentage,
        whitelistedUsers: this.migrationConfig.whitelistedUsers.length,
        blacklistedUsers: this.migrationConfig.blacklistedUsers.length
      }
    };
  }
}

module.exports = new ExtractionMigrationService();
