const XLSX = require('xlsx');
const logger = require('../utils/logger');

/**
 * Enterprise-grade Contact Export Service
 * Supports multiple formats: CSV, Excel, JSON, vCard
 */
class ExportService {
  /**
   * Export contacts in the specified format
   * @param {Array} contacts - Array of contact objects
   * @param {string} format - Export format: 'csv', 'excel', 'json', 'vcard'
   * @param {Object} options - Export options
   * @returns {Object} { data, filename, mimeType }
   */
  async exportContacts(contacts, format = 'csv', options = {}) {
    try {
      if (!contacts || contacts.length === 0) {
        throw new Error('No contacts provided for export');
      }

      logger.info(`📤 Exporting ${contacts.length} contacts in ${format} format`, {
        format,
        contactCount: contacts.length,
        options: Object.keys(options)
      });

      switch (format.toLowerCase()) {
        case 'csv':
          return this.generateCSV(contacts, options);
        case 'excel':
        case 'xlsx':
          return this.generateExcel(contacts, options);
        case 'json':
          return this.generateJSON(contacts, options);
        case 'vcard':
        case 'vcf':
          return this.generateVCard(contacts, options);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error('❌ Export failed', { error: error.message, format, stack: error.stack });
      throw error;
    }
  }

  /**
   * Generate CSV export
   */
  generateCSV(contacts, options = {}) {
    const {
      includeFields = ['name', 'email', 'phone', 'role', 'company', 'jobTitle', 'dateAdded'],
      delimiter = ',',
      includeHeaders = true
    } = options;

    // Map field keys to display labels
    const fieldMap = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      role: 'Role',
      company: 'Company',
      jobTitle: 'Job Title',
      dateAdded: 'Date Added',
      jobId: 'Job ID',
      createdAt: 'Created At',
      updatedAt: 'Updated At'
    };

    // Build headers
    const headers = includeFields.map(field => fieldMap[field] || this.capitalize(field));

    // Build CSV rows
    let csvContent = '';

    if (includeHeaders) {
      csvContent += headers.join(delimiter) + '\n';
    }

    contacts.forEach(contact => {
      const row = includeFields.map(field => {
        let value = '';

        switch (field) {
          case 'name':
            value = contact.name || '';
            break;
          case 'email':
            value = contact.email || '';
            break;
          case 'phone':
            value = contact.phone || '';
            break;
          case 'role':
            value = contact.role || '';
            break;
          case 'company':
            value = contact.company || '';
            break;
          case 'jobTitle':
            value = contact.job?.title || contact.job?.fileName || '';
            break;
          case 'dateAdded':
          case 'createdAt':
            value = contact.createdAt 
              ? new Date(contact.createdAt).toLocaleDateString() 
              : '';
            break;
          case 'jobId':
            value = contact.jobId || '';
            break;
          case 'updatedAt':
            value = contact.updatedAt 
              ? new Date(contact.updatedAt).toLocaleDateString() 
              : '';
            break;
          default:
            value = contact[field] || '';
        }

        return this.escapeCSV(value, delimiter);
      });

      csvContent += row.join(delimiter) + '\n';
    });

    const filename = options.customFileName || 
      `contacts_${contacts.length}_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      data: csvContent,
      filename,
      mimeType: 'text/csv; charset=utf-8'
    };
  }

  /**
   * Generate Excel export
   */
  generateExcel(contacts, options = {}) {
    const {
      includeFields = ['name', 'email', 'phone', 'role', 'company', 'jobTitle', 'dateAdded'],
      groupBy = 'none',
      includeSummary = true
    } = options;

    const workbook = XLSX.utils.book_new();

    // Prepare data for Excel
    const fieldMap = {
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      role: 'Role',
      company: 'Company',
      jobTitle: 'Job Title',
      dateAdded: 'Date Added',
      jobId: 'Job ID',
      createdAt: 'Created At',
      updatedAt: 'Updated At'
    };

    const headers = includeFields.map(field => fieldMap[field] || this.capitalize(field));

    // Validate contacts array
    if (!contacts || contacts.length === 0) {
      throw new Error('No contacts provided for Excel export');
    }

    // Transform contacts to rows
    const rows = contacts.map(contact => {
      const row = {};
      includeFields.forEach(field => {
        let value = '';

        switch (field) {
          case 'name':
            value = contact.name || '';
            break;
          case 'email':
            value = contact.email || '';
            break;
          case 'phone':
            value = contact.phone || '';
            break;
          case 'role':
            value = contact.role || '';
            break;
          case 'company':
            value = contact.company || '';
            break;
          case 'jobTitle':
            value = contact.job?.title || contact.job?.fileName || '';
            break;
          case 'dateAdded':
          case 'createdAt':
            value = contact.createdAt 
              ? new Date(contact.createdAt).toLocaleDateString() 
              : '';
            break;
          case 'jobId':
            value = contact.jobId || '';
            break;
          case 'updatedAt':
            value = contact.updatedAt 
              ? new Date(contact.updatedAt).toLocaleDateString() 
              : '';
            break;
          default:
            value = contact[field] || '';
        }

        row[fieldMap[field] || this.capitalize(field)] = value;
      });

      return row;
    });

    // Validate rows were created
    if (!rows || rows.length === 0) {
      throw new Error('Failed to transform contacts to Excel rows');
    }

    logger.info(`Creating Excel worksheet with ${rows.length} rows and ${headers.length} columns`);

    // Create main contacts sheet
    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Validate worksheet was created
    if (!worksheet) {
      throw new Error('Failed to create Excel worksheet');
    }
    
    // Set column widths
    const colWidths = headers.map(() => ({ wch: 20 }));
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

    // Add summary sheet if requested
    if (includeSummary) {
      const summary = [
        { Metric: 'Total Contacts', Value: contacts.length },
        { Metric: 'Export Date', Value: new Date().toLocaleDateString() },
        { Metric: 'Contacts with Email', Value: contacts.filter(c => c.email).length },
        { Metric: 'Contacts with Phone', Value: contacts.filter(c => c.phone).length },
        { Metric: 'Complete Profiles', Value: contacts.filter(c => c.email && c.phone).length },
        { Metric: 'Unique Companies', Value: new Set(contacts.map(c => c.company).filter(Boolean)).size },
        { Metric: 'Unique Roles', Value: new Set(contacts.map(c => c.role).filter(Boolean)).size }
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Generate file
    const filename = options.customFileName || 
      `contacts_${contacts.length}_${new Date().toISOString().split('T')[0]}.xlsx`;

    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'buffer',
      cellStyles: true
    });

    // Validate buffer was created
    if (!excelBuffer || !Buffer.isBuffer(excelBuffer)) {
      logger.error('Excel buffer creation failed', {
        bufferType: typeof excelBuffer,
        isBuffer: Buffer.isBuffer(excelBuffer),
        bufferLength: excelBuffer?.length
      });
      throw new Error('Failed to generate Excel file buffer');
    }

    logger.info(`Excel buffer created successfully`, {
      bufferLength: excelBuffer.length,
      rowCount: rows.length,
      filename
    });

    return {
      data: excelBuffer,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  /**
   * Generate JSON export
   */
  generateJSON(contacts, options = {}) {
    const {
      includeMetadata = true,
      includeJobInfo = true
    } = options;

    const exportData = {
      ...(includeMetadata && {
        metadata: {
          exportDate: new Date().toISOString(),
          recordCount: contacts.length,
          format: 'json',
          version: '1.0'
        }
      }),
      contacts: contacts.map(contact => {
        const exported = {
          name: contact.name || null,
          email: contact.email || null,
          phone: contact.phone || null,
          role: contact.role || null,
          company: contact.company || null,
          ...(includeJobInfo && contact.job && {
            job: {
              id: contact.job.id,
              title: contact.job.title || contact.job.fileName,
              fileName: contact.job.fileName,
              status: contact.job.status,
              createdAt: contact.job.createdAt
            }
          }),
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt
        };

        return exported;
      })
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = options.customFileName || 
      `contacts_${contacts.length}_${new Date().toISOString().split('T')[0]}.json`;

    return {
      data: jsonContent,
      filename,
      mimeType: 'application/json; charset=utf-8'
    };
  }

  /**
   * Generate vCard export
   */
  generateVCard(contacts, options = {}) {
    const vCards = contacts.map(contact => {
      const name = contact.name || 'Unnamed Contact';
      const nameParts = name.split(' ').filter(Boolean);
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const firstName = nameParts[0] || '';

      const vCard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `N:${lastName};${firstName};;;`
      ];

      if (contact.email) {
        vCard.push(`EMAIL;TYPE=INTERNET:${contact.email}`);
      }

      if (contact.phone) {
        // Clean phone number for vCard
        const cleanPhone = contact.phone.replace(/[^\d+]/g, '');
        vCard.push(`TEL;TYPE=CELL:${cleanPhone}`);
      }

      if (contact.role) {
        vCard.push(`TITLE:${contact.role}`);
      }

      if (contact.company) {
        vCard.push(`ORG:${contact.company}`);
      }

      vCard.push('END:VCARD');
      return vCard.join('\n');
    }).join('\n\n');

    const filename = options.customFileName || 
      `contacts_${contacts.length}_${new Date().toISOString().split('T')[0]}.vcf`;

    return {
      data: vCards,
      filename,
      mimeType: 'text/vcard; charset=utf-8'
    };
  }

  /**
   * Escape CSV field value
   */
  escapeCSV(value, delimiter = ',') {
    if (value === null || value === undefined) return '';

    const stringValue = String(value);
    
    // If contains delimiter, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(delimiter) || 
        stringValue.includes('"') || 
        stringValue.includes('\n') || 
        stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Capitalize first letter
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = new ExportService();

