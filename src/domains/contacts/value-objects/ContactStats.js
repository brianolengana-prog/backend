/**
 * ContactStats Value Object
 * 
 * Immutable value object representing contact statistics.
 * Value objects are immutable and represent descriptive aspects of the domain.
 */
class ContactStats {
  /**
   * @param {object} data - Statistics data
   */
  constructor(data = {}) {
    this.totalContacts = data.totalContacts || 0;
    this.withEmail = data.withEmail || 0;
    this.withPhone = data.withPhone || 0;
    this.totalJobs = data.totalJobs || 0;
    this.recentContacts = data.recentContacts || 0;
    this.contactsByRole = data.contactsByRole || [];
    this.contactsByProduction = data.contactsByProduction || [];
    this.averageContactsPerJob = data.averageContactsPerJob || 0;
    this.jobsWithContacts = data.jobsWithContacts || 0;
    this.lastExtractionDate = data.lastExtractionDate || null;
    
    // Freeze to make immutable
    Object.freeze(this);
  }

  /**
   * Converts to plain object
   * @returns {object}
   */
  toObject() {
    return {
      totalContacts: this.totalContacts,
      withEmail: this.withEmail,
      withPhone: this.withPhone,
      totalJobs: this.totalJobs,
      recentContacts: this.recentContacts,
      contactsByRole: this.contactsByRole,
      contactsByProduction: this.contactsByProduction,
      averageContactsPerJob: this.averageContactsPerJob,
      jobsWithContacts: this.jobsWithContacts,
      lastExtractionDate: this.lastExtractionDate
    };
  }
}

module.exports = ContactStats;

