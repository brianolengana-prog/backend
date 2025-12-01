const { PrismaClient } = require('@prisma/client');
const exportService = require('./export.service');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

class ContactsService {
  /**
   * Get contact statistics for a user
   * All stats are derived from the extraction workflow
   */
  async getContactStats(userId) {
    try {
      console.log(`📊 Getting contact stats for user: ${userId}`);

      // Get all contacts from extraction jobs
      const contacts = await prisma.contact.findMany({
        where: { userId }
      });

      // Get total contacts count
      const totalContacts = contacts.length;

      // Get contacts by role
      const contactsByRole = await prisma.contact.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      });

      // Get contacts by production (via job relation)
      const contactsByProduction = await prisma.contact.findMany({
        where: { userId },
        include: {
          job: {
            select: {
              productionId: true
            }
          }
        }
      });

      // Group by production manually
      const productionGroups = contactsByProduction.reduce((acc, contact) => {
        const productionId = contact.job?.productionId || 'unknown';
        acc[productionId] = (acc[productionId] || 0) + 1;
        return acc;
      }, {});

      const contactsByProductionArray = Object.entries(productionGroups).map(([productionId, count]) => ({
        productionId,
        count
      }));

      // Get recent contacts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentContacts = contacts.filter(contact => 
        contact.createdAt >= thirtyDaysAgo
      ).length;

      // Get contacts with email
      const contactsWithEmail = contacts.filter(contact => 
        contact.email && contact.email.trim() !== ''
      ).length;

      // Get contacts with phone
      const contactsWithPhone = contacts.filter(contact => 
        contact.phone && contact.phone.trim() !== ''
      ).length;

      // Get contacts by extraction job status
      const contactsByJobStatus = await prisma.contact.groupBy({
        by: ['jobId'],
        where: { userId },
        _count: { jobId: true }
      });

      // Get unique jobs that produced contacts
      const jobsWithContacts = await prisma.job.findMany({
        where: {
          userId,
          contacts: {
            some: {}
          }
        },
        select: {
          id: true,
          fileName: true,
          status: true,
          createdAt: true
        }
      });

      const stats = {
        totalContacts,
        withEmail: contactsWithEmail,  // ✅ FIX: Match frontend expected field name
        withPhone: contactsWithPhone,  // ✅ FIX: Match frontend expected field name
        totalJobs: jobsWithContacts.length,
        recentContacts,
        contactsWithEmail,  // Keep for backward compatibility
        contactsWithPhone,  // Keep for backward compatibility
        contactsByRole: contactsByRole.map(item => ({
          role: item.role || 'Unknown',
          count: item._count.role
        })),
        contactsByProduction: contactsByProductionArray,
        // Extraction-specific stats
        averageContactsPerJob: jobsWithContacts.length > 0 
          ? Math.round((totalContacts / jobsWithContacts.length) * 100) / 100 
          : 0,
        jobsWithContacts: jobsWithContacts.length,
        lastExtractionDate: jobsWithContacts.length > 0 
          ? jobsWithContacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
          : null
      };

      console.log(`✅ Contact stats for user ${userId}:`, {
        totalContacts,
        recentContacts,
        jobsWithContacts: jobsWithContacts.length,
        avgContactsPerJob: stats.averageContactsPerJob
      });
      return stats;
    } catch (error) {
      console.error('❌ Error getting contact stats:', error);
      throw error;
    }
  }

  /**
   * Normalize contact data from database (snake_case) to API format (camelCase)
   * @private
   */
  normalizeContact(contact) {
    return {
      id: contact.id,
      jobId: contact.jobId || contact.job_id,  // ✅ Normalize field name
      userId: contact.userId || contact.user_id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: contact.role,
      company: contact.company,
      isSelected: contact.isSelected ?? contact.is_selected ?? true,
      createdAt: contact.createdAt || contact.created_at,
      updatedAt: contact.updatedAt || contact.updated_at,
      // Include job relation if present
      ...(contact.job && {
        job: {
          id: contact.job.id,
          title: contact.job.title,
          fileName: contact.job.fileName || contact.job.file_name,
          status: contact.job.status,
          createdAt: contact.job.createdAt || contact.job.created_at
        }
      })
    };
  }

  /**
   * Get paginated contacts for a user with metadata
   * ⚡ OPTIMIZED: Returns contacts with pagination info
   */
  async getContactsPaginated(userId, options = {}) {
    try {
      console.log(`📋 Getting paginated contacts for user: ${userId}`, options);

      const {
        page = 1,
        limit = 25,
        search = '',
        role = '',
        jobId = '',
        sortBy = 'created_at',
        sortOrder = 'desc',
        requireContact = 'true'  // ✅ NEW: Quality filter - only contacts with email OR phone
      } = options;

      // Build where clause with filters
      const where = {
        userId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(role && role !== 'all' && { role: { contains: role, mode: 'insensitive' } }),
        ...(jobId && jobId !== 'all' && { jobId }),
        // ✅ QUALITY FILTER: Only contacts with valid email OR phone
        ...(requireContact === 'true' && {
          OR: [
            { 
              email: { 
                not: null,
                not: '',
                contains: '@'
              }
            },
            {
              phone: { 
                not: null,
                not: ''
              }
            }
          ]
        })
      };

      // Build orderBy clause
      const orderByField = sortBy === 'created_at' ? 'createdAt' : sortBy;
      const orderBy = { [orderByField]: sortOrder };

      // Execute queries in parallel for better performance
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy,
          include: {
            job: {
              select: {
                id: true,
                title: true,
                fileName: true,
                status: true,
                createdAt: true
              }
            }
          }
        }),
        prisma.contact.count({ where })
      ]);

      // ✅ Normalize all contacts to use camelCase field names
      const normalizedContacts = contacts.map(contact => this.normalizeContact(contact));

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;

      // ✅ Calculate stats for the filtered dataset (enterprise-grade performance)
      // Use the same WHERE clause to get accurate stats for the current filter context
      const statsWhere = {
        userId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(role && role !== 'all' && { role: { contains: role, mode: 'insensitive' } }),
        ...(jobId && jobId !== 'all' && { jobId })
      };

      const [contactsWithEmail, contactsWithPhone, totalJobs] = await Promise.all([
        prisma.contact.count({
          where: {
            ...statsWhere,
            email: { 
              not: null,
              contains: '@'
            }
          }
        }),
        prisma.contact.count({
          where: {
            ...statsWhere,
            phone: { 
              not: null,
              not: ''
            }
          }
        }),
        prisma.job.count({
          where: {
            userId,
            ...(jobId && jobId !== 'all' && { id: jobId }),
            contacts: {
              some: {}
            }
          }
        })
      ]);

      const stats = {
        totalContacts: total,
        withEmail: contactsWithEmail,
        withPhone: contactsWithPhone,
        totalJobs: totalJobs || 0
      };

      const result = {
        contacts: normalizedContacts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore
        },
        stats
      };

      console.log(`✅ Returning ${normalizedContacts.length} of ${total} contacts (page ${page}/${totalPages})`, {
        stats: {
          total: stats.totalContacts,
          withEmail: stats.withEmail,
          withPhone: stats.withPhone,
          totalJobs: stats.totalJobs
        }
      });
      return result;
    } catch (error) {
      console.error('❌ Error getting paginated contacts:', error);
      throw error;
    }
  }

  /**
   * Get all contacts for a user (legacy - for backward compatibility)
   * @deprecated Use getContactsPaginated instead for better performance
   */
  async getContacts(userId, options = {}) {
    try {
      console.log(`📋 Getting contacts for user: ${userId} (legacy method)`);
      
      // Use paginated method but return all results
      const result = await this.getContactsPaginated(userId, {
        ...options,
        page: 1,
        limit: options.limit || 1000 // Return up to 1000 for backward compatibility
      });

      return result.contacts;
    } catch (error) {
      console.error('❌ Error getting contacts:', error);
      throw error;
    }
  }

  /**
   * Get a specific contact by ID
   */
  async getContactById(userId, contactId) {
    try {
      console.log(`📋 Getting contact ${contactId} for user: ${userId}`);

      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          userId
        },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              fileName: true,
              status: true,
              createdAt: true,
              productionId: true
            }
          }
        }
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      // ✅ Normalize to camelCase
      return this.normalizeContact(contact);
    } catch (error) {
      console.error('❌ Error getting contact:', error);
      throw error;
    }
  }

  /**
   * Delete a contact by ID
   */
  async deleteContact(userId, contactId) {
    try {
      console.log(`🗑️ Deleting contact ${contactId} for user: ${userId}`);

      const contact = await prisma.contact.findFirst({
        where: {
          id: contactId,
          userId
        }
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      await prisma.contact.delete({
        where: { id: contactId }
      });

      console.log(`✅ Contact ${contactId} deleted successfully`);
    } catch (error) {
      console.error('❌ Error deleting contact:', error);
      throw error;
    }
  }

  /**
   * Export contacts to multiple formats (CSV, Excel, JSON, vCard)
   * @param {string} userId - User ID
   * @param {Array<string>} contactIds - Optional array of contact IDs to export
   * @param {string} format - Export format: 'csv', 'excel', 'json', 'vcard'
   * @param {string} jobId - Optional job ID to filter contacts
   * @param {Object} options - Export options (includeFields, delimiter, etc.)
   */
  async exportContacts(userId, contactIds, format = 'csv', jobId = null, options = {}) {
    try {
      logger.info(`📥 Exporting contacts for user: ${userId}`, { 
        format, 
        count: contactIds?.length || 'all', 
        jobId,
        options: Object.keys(options)
      });

      // Build query
      const where = {
        userId,
        ...(contactIds && contactIds.length > 0 && { id: { in: contactIds } }),
        ...(jobId && { jobId })
      };

      // Fetch contacts
      const contacts = await prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: {
              id: true,
              title: true,
              fileName: true,
              status: true,
              createdAt: true
            }
          }
        }
      });

      if (contacts.length === 0) {
        throw new Error('No contacts found to export');
      }

      logger.info(`✅ Found ${contacts.length} contacts to export`);

      // Use the centralized export service
      return await exportService.exportContacts(contacts, format, options);
    } catch (error) {
      logger.error('❌ Error exporting contacts', { 
        error: error.message, 
        userId, 
        format,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      service: 'ContactsService',
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new ContactsService();
