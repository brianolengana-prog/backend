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
        where: { userId },
        include: {
          job: {
            select: {
              id: true,
              fileName: true,
              status: true,
              createdAt: true
            }
          }
        }
      });

      // Get total contacts count
      const totalContacts = contacts.length;

      // Get contacts by role
      const contactsByRole = await prisma.contact.groupBy({
        by: ['role'],
        where: { userId },
        _count: { role: true }
      });

      // Get contacts by production
      const contactsByProduction = await prisma.contact.groupBy({
        by: ['productionId'],
        where: { userId },
        _count: { productionId: true }
      });

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
        recentContacts,
        contactsWithEmail,
        contactsWithPhone,
        totalJobs: jobsWithContacts.length,
        contactsByRole: contactsByRole.map(item => ({
          role: item.role || 'Unknown',
          count: item._count.role
        })),
        contactsByProduction: contactsByProduction.map(item => ({
          productionId: item.productionId,
          count: item._count.productionId
        })),
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
   * Get all contacts for a user
   */
  async getContacts(userId, options = {}) {
    try {
      console.log(`📋 Getting contacts for user: ${userId}`);

      const {
        page = 1,
        limit = 50,
        search = '',
        role = '',
        productionId = ''
      } = options;

      const where = {
        userId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(role && { role: { contains: role, mode: 'insensitive' } }),
        ...(productionId && { productionId })
      };

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            production: {
              select: {
                id: true,
                title: true,
                type: true
              }
            }
          }
        }),
        prisma.contact.count({ where })
      ]);

      return {
        contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
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
          production: {
            select: {
              id: true,
              title: true,
              type: true
            }
          }
        }
      });

      if (!contact) {
        throw new Error('Contact not found');
      }

      return contact;
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
