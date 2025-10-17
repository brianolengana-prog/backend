const { PrismaClient } = require('@prisma/client');

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
              AND: [
                { email: { not: null } },
                { email: { not: '' } },
                { email: { contains: '@' } }
              ]
            },
            {
              AND: [
                { phone: { not: null } },
                { phone: { not: '' } }
              ]
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

      const result = {
        contacts: normalizedContacts,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore
        }
      };

      console.log(`✅ Returning ${normalizedContacts.length} of ${total} contacts (page ${page}/${totalPages})`);
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
   * Export contacts to CSV or other formats
   */
  async exportContacts(userId, contactIds, format = 'csv') {
    try {
      console.log(`📥 Exporting contacts for user: ${userId}`, { format, count: contactIds?.length || 'all' });

      // Build query
      const where = {
        userId,
        ...(contactIds && contactIds.length > 0 && { id: { in: contactIds } })
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

      console.log(`✅ Exporting ${contacts.length} contacts`);

      // Generate export based on format
      if (format === 'csv') {
        return this.generateCSV(contacts);
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('❌ Error exporting contacts:', error);
      throw error;
    }
  }

  /**
   * Generate CSV from contacts
   */
  generateCSV(contacts) {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Company', 'Job Title', 'Date Added'];
    
    // Build CSV content
    let csvContent = headers.join(',') + '\n';
    
    contacts.forEach(contact => {
      const row = [
        this.escapeCSV(contact.name || ''),
        this.escapeCSV(contact.email || ''),
        this.escapeCSV(contact.phone || ''),
        this.escapeCSV(contact.role || ''),
        this.escapeCSV(contact.company || ''),
        this.escapeCSV(contact.job?.title || contact.job?.fileName || ''),
        this.escapeCSV(contact.createdAt ? new Date(contact.createdAt).toLocaleDateString() : '')
      ];
      csvContent += row.join(',') + '\n';
    });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `contacts_${contacts.length}_${timestamp}.csv`;

    return {
      data: csvContent,
      filename,
      mimeType: 'text/csv'
    };
  }

  /**
   * Escape CSV value
   */
  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
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
