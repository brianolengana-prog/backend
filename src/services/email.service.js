class EmailService {
  async sendVerificationEmail(email, token) {
    // Integrate provider here. For now, log.
    console.log('Send verify email to', email, 'token', token);
  }

  async sendPasswordResetEmail(email, token) {
    console.log('Send reset email to', email, 'token', token);
  }
}

module.exports = new EmailService();


