const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles all email communications using Nodemailer
 * Supports Gmail, SMTP, SendGrid, and other providers
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment configuration
   */
  initializeTransporter() {
    try {
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

      // Configuration for different email providers
      const configs = {
        // Gmail configuration
        gmail: {
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
          },
        },
        
        // Generic SMTP configuration
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        
        // SendGrid configuration
        sendgrid: {
          host: 'smtp.sendgrid.net',
          port: 587,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY,
          },
        },
        
        // Mailgun configuration
        mailgun: {
          host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
          port: 587,
          auth: {
            user: process.env.MAILGUN_SMTP_USER,
            pass: process.env.MAILGUN_SMTP_PASS,
          },
        },
      };

      const config = configs[emailProvider];
      
      if (!config || !config.auth.user || !config.auth.pass) {
        console.warn('⚠️  Email service not configured. Emails will be logged to console.');
        this.initialized = false;
        return;
      }

      this.transporter = nodemailer.createTransport(config);
      this.initialized = true;
      
      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Email service connection failed:', error.message);
          this.initialized = false;
        } else {
          console.log('✅ Email service ready:', emailProvider);
        }
      });
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Send email (generic method)
   */
  async sendEmail({ to, subject, text, html, from }) {
    const fromAddress = from || process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@callsheets.com';
    
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html: html || text,
    };

    // If not initialized, log to console instead
    if (!this.initialized) {
      console.log('\n📧 [EMAIL - Not Sent] Would send email:');
      console.log('   To:', to);
      console.log('   Subject:', subject);
      console.log('   Message:', text);
      console.log('\n');
      return { success: true, messageId: 'console-log', mode: 'development' };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Failed to send email:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, token) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    
    const subject = 'Verify Your Email - Call Sheet Converter';
    const text = `
Hello,

Thank you for signing up for Call Sheet Converter!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.

Best regards,
The Call Sheet Converter Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Call Sheet Converter!</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Thank you for signing up! Please verify your email address to get started.</p>
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        This link will expire in 24 hours. If you didn't create an account, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Call Sheet Converter. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    
    const subject = 'Reset Your Password - Call Sheet Converter';
    const text = `
Hello,

We received a request to reset your password for Call Sheet Converter.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
The Call Sheet Converter Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password for your Call Sheet Converter account.</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
      <div class="warning">
        <strong>⏰ This link will expire in 1 hour</strong>
      </div>
      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Call Sheet Converter. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject, text, html });
  }

  /**
   * Send support request email (to support team)
   */
  async sendSupportRequest({ name, email, subject, message, category, userAgent, ipAddress }) {
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'support@callsheets.com';
    
    const emailSubject = `[Support] ${category || 'General'}: ${subject}`;
    
    const text = `
New Support Request

From: ${name} <${email}>
Category: ${category || 'General Inquiry'}
Subject: ${subject}

Message:
${message}

---
User Agent: ${userAgent || 'Not provided'}
IP Address: ${ipAddress || 'Not provided'}
Timestamp: ${new Date().toISOString()}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: #667eea; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 15px 0; }
    .message-box { background: #f5f5f5; border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .metadata { color: #666; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🎬 New Support Request</h2>
    </div>
    <div class="content">
      <div class="info-box">
        <p><strong>From:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Category:</strong> ${category || 'General Inquiry'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
      </div>
      
      <h3>Message:</h3>
      <div class="message-box">
        ${message.replace(/\n/g, '<br>')}
      </div>
      
      <div class="metadata">
        <p><strong>User Agent:</strong> ${userAgent || 'Not provided'}</p>
        <p><strong>IP Address:</strong> ${ipAddress || 'Not provided'}</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ 
      to: supportEmail, 
      subject: emailSubject, 
      text, 
      html,
      from: `"${name}" <${email}>` // Reply-to will be the user's email
    });
  }

  /**
   * Send support confirmation email (to user)
   */
  async sendSupportConfirmation({ name, email, subject, message, category }) {
    const emailSubject = 'We Received Your Support Request - Call Sheet Converter';
    
    const text = `
Hello ${name},

Thank you for contacting Call Sheet Converter support!

We've received your message regarding: "${subject}"

Our support team will review your request and respond within 24 hours during business days. For urgent issues, we'll get back to you as soon as possible.

Your Request Details:
Category: ${category || 'General Inquiry'}
Subject: ${subject}

What happens next?
1. Our support team will review your request
2. You'll receive a detailed response via email
3. If needed, we may ask for additional information

In the meantime, you can check our FAQ or documentation for quick answers to common questions.

Best regards,
The Call Sheet Converter Support Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; }
    .steps { background: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .step { padding: 10px 0; border-bottom: 1px solid #eee; }
    .step:last-child { border-bottom: none; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ We Received Your Request</h1>
    </div>
    <div class="content">
      <p>Hello ${name},</p>
      <p>Thank you for contacting Call Sheet Converter support!</p>
      
      <div class="info-box">
        <p><strong>Your Request:</strong></p>
        <p>Category: ${category || 'General Inquiry'}</p>
        <p>Subject: ${subject}</p>
      </div>
      
      <p>Our support team will review your request and respond within <strong>24 hours</strong> during business days.</p>
      
      <div class="steps">
        <h3>What happens next?</h3>
        <div class="step">1️⃣ Our support team will review your request</div>
        <div class="step">2️⃣ You'll receive a detailed response via email</div>
        <div class="step">3️⃣ If needed, we may ask for additional information</div>
      </div>
      
      <p style="margin-top: 30px;">In the meantime, check our <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/support">FAQ</a> for quick answers.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Call Sheet Converter. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return this.sendEmail({ to: email, subject: emailSubject, text, html });
  }
}

module.exports = new EmailService();


