# Email Service Configuration Guide

## Overview

This guide explains how to configure the email service for the Call Sheet Converter application. The service supports multiple email providers and includes security features like rate limiting, input sanitization, and spam detection.

## Security Features Implemented

### 1. **OWASP Top 10 Protection**
- ✅ **A03:2021** – Injection Prevention (XSS, SQL Injection)
- ✅ **A04:2021** – Insecure Design (Rate Limiting, Validation)
- ✅ **A05:2021** – Security Misconfiguration (Secure Defaults)
- ✅ **A07:2021** – Identification and Authentication Failures (Email Verification)

### 2. **Defense in Depth (Multiple Security Layers)**
1. **Rate Limiting** - 3 requests per 15 minutes
2. **Input Validation** - express-validator with custom rules
3. **Injection Detection** - Pattern matching for malicious code
4. **Input Sanitization** - HTML escaping, length limits
5. **Duplicate Detection** - Content hash-based spam prevention
6. **Secure Error Handling** - No information leakage
7. **Logging & Monitoring** - Security event tracking

### 3. **SOLID Principles Applied**
- **Single Responsibility**: Each service/middleware has one clear purpose
- **Open/Closed**: Extensible design for new email providers
- **Liskov Substitution**: Provider-agnostic email interface
- **Interface Segregation**: Clean, minimal API contracts
- **Dependency Inversion**: Services depend on abstractions, not concretions

---

## Supported Email Providers

### 1. Gmail (Recommended for Development)
**Pros:**
- Easy to set up
- Free for low volume
- Reliable delivery

**Cons:**
- Daily sending limits (500 emails/day)
- Requires App Password (2FA must be enabled)

### 2. SMTP (Generic)
**Pros:**
- Works with any SMTP server
- Maximum flexibility
- No vendor lock-in

**Cons:**
- Requires manual configuration
- May need authentication setup

### 3. SendGrid
**Pros:**
- High deliverability rates
- Generous free tier (100 emails/day)
- Professional email infrastructure
- Detailed analytics

**Cons:**
- Requires account setup
- API key management

### 4. Mailgun
**Pros:**
- Developer-friendly
- Good free tier
- Excellent documentation

**Cons:**
- Requires domain verification for production

---

## Environment Variables

### Required Variables (Choose ONE Provider)

```bash
# Email Provider Selection
EMAIL_PROVIDER=gmail  # Options: gmail, smtp, sendgrid, mailgun

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:5173

# Support Email Address (where support requests are sent)
SUPPORT_EMAIL=support@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

### Option 1: Gmail Configuration

```bash
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

**How to get Gmail App Password:**
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to Security
3. Enable 2-Step Verification
4. Go to "App passwords"
5. Generate new app password for "Mail"
6. Copy the 16-character password

### Option 2: Generic SMTP Configuration

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465, false for 587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
```

**Common SMTP Servers:**
- Gmail: `smtp.gmail.com:587`
- Outlook: `smtp-mail.outlook.com:587`
- Yahoo: `smtp.mail.yahoo.com:587`
- Office 365: `smtp.office365.com:587`

### Option 3: SendGrid Configuration

```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
```

**How to get SendGrid API Key:**
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Verify your email
3. Go to Settings > API Keys
4. Create new API key with "Mail Send" permissions

### Option 4: Mailgun Configuration

```bash
EMAIL_PROVIDER=mailgun
MAILGUN_SMTP_HOST=smtp.mailgun.org
MAILGUN_SMTP_USER=postmaster@your-domain.mailgun.org
MAILGUN_SMTP_PASS=your-smtp-password
```

**How to get Mailgun credentials:**
1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Add and verify your domain
3. Go to Sending > Domain Settings
4. Copy SMTP credentials

---

## Development Setup (Quick Start)

### Using Gmail (Easiest for Testing)

1. **Create a test Gmail account** (don't use your personal email)
   - Go to gmail.com and create new account
   - Enable 2-Factor Authentication

2. **Generate App Password:**
   ```
   Settings → Security → 2-Step Verification → App Passwords
   ```

3. **Add to `.env` file:**
   ```bash
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-test@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   SUPPORT_EMAIL=your-test@gmail.com
   EMAIL_FROM=your-test@gmail.com
   FRONTEND_URL=http://localhost:5173
   ```

4. **Test the service:**
   ```bash
   cd backend
   npm run dev
   
   # In another terminal, test the endpoint
   curl -X POST http://localhost:3000/api/support/test?email=your-email@gmail.com
   ```

---

## Production Setup

### Recommended: SendGrid for Production

1. **Sign up for SendGrid**
   - Free tier: 100 emails/day
   - Paid plans scale with usage

2. **Verify your domain** (important for deliverability)
   - Add DNS records as instructed by SendGrid
   - This prevents emails from going to spam

3. **Configure environment variables:**
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your-production-key
   SUPPORT_EMAIL=support@yourdomain.com
   EMAIL_FROM=noreply@yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   ```

4. **Set up email templates** (optional)
   - Use SendGrid's template editor
   - Update email service to use template IDs

---

## Testing the Email Service

### 1. Test Email Sending (Development Only)

```bash
# GET request to test endpoint
curl http://localhost:3000/api/support/test?email=your-email@gmail.com
```

Expected response:
```json
{
  "success": true,
  "message": "Test email sent successfully",
  "data": {
    "success": true,
    "messageId": "..."
  }
}
```

### 2. Test Support Form Submission

```bash
curl -X POST http://localhost:3000/api/support \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Test Support Request",
    "message": "This is a test message to verify the support system is working correctly.",
    "category": "Technical Support"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Your support request has been submitted successfully...",
  "data": {
    "submittedAt": "2025-01-09T...",
    "category": "Technical Support"
  }
}
```

### 3. Test Rate Limiting

```bash
# Run this command 4 times quickly
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/support \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@test.com","subject":"Test","message":"Testing rate limit","category":"General Inquiry"}'
  echo ""
done
```

4th request should return:
```json
{
  "success": false,
  "message": "Too many support requests...",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": "15 minutes"
  }
}
```

### 4. Test Input Sanitization

```bash
# Try to inject HTML/JavaScript
curl -X POST http://localhost:3000/api/support \
  -H "Content-Type": application/json" \
  -d '{
    "name": "Test",
    "email": "test@test.com",
    "subject": "<script>alert(\"XSS\")</script>",
    "message": "Test message",
    "category": "General Inquiry"
  }'
```

Should sanitize input and return success (script tags removed).

---

## Troubleshooting

### Email Not Sending

1. **Check console logs:**
   ```bash
   # Look for email service initialization message
   ✅ Email service ready: gmail
   ```

2. **If you see "Email service not configured":**
   - Verify environment variables are set
   - Check `.env` file is in correct location
   - Restart the server after changing `.env`

3. **Gmail "Less secure app" error:**
   - Use App Password, not regular password
   - Enable 2-Factor Authentication first
   - Generate new App Password if old one expires

### Emails Going to Spam

1. **For Gmail/SMTP:**
   - Use a consistent "From" address
   - Add SPF record to your domain
   - Warm up your sending reputation

2. **For SendGrid/Mailgun:**
   - Verify your domain
   - Configure DKIM and SPF records
   - Use authenticated domain

### Rate Limiting Too Strict

Modify in `backend/src/middleware/supportRateLimiter.js`:
```javascript
const supportSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Change this
  max: 3, // Change this
  // ...
});
```

---

## Security Best Practices

### 1. **Never Commit Credentials**
```bash
# Add to .gitignore
.env
.env.local
.env.production
```

### 2. **Use Environment-Specific Configs**
- `.env.development` - Gmail for testing
- `.env.production` - SendGrid/Mailgun for production

### 3. **Monitor Email Logs**
- Set up alerts for failed sends
- Track rate limit violations
- Monitor for injection attempts

### 4. **Regular Security Audits**
```bash
npm audit
npm audit fix
```

### 5. **Keep Dependencies Updated**
```bash
npm update nodemailer
npm update express-validator
npm update validator
```

---

## API Documentation

### POST `/api/support`

Submit a support request.

**Rate Limit:** 3 requests per 15 minutes per IP

**Request Body:**
```json
{
  "name": "string (2-100 chars, required)",
  "email": "string (valid email, required)",
  "subject": "string (5-200 chars, required)",
  "message": "string (10-5000 chars, required)",
  "category": "string (optional, from predefined list)"
}
```

**Categories:**
- General Inquiry
- Technical Support
- Billing Question
- Feature Request
- Bug Report
- Account Issue

**Success Response (200):**
```json
{
  "success": true,
  "message": "Your support request has been submitted successfully...",
  "data": {
    "submittedAt": "2025-01-09T12:00:00.000Z",
    "category": "Technical Support"
  }
}
```

**Error Responses:**

400 - Validation Error:
```json
{
  "success": false,
  "message": "Please check your input and try again.",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

429 - Rate Limit:
```json
{
  "success": false,
  "message": "Too many support requests...",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": "15 minutes"
  }
}
```

500 - Server Error:
```json
{
  "success": false,
  "message": "We encountered an error...",
  "error": {
    "code": "INTERNAL_SERVER_ERROR"
  }
}
```

---

## Production Checklist

- [ ] Email provider configured and tested
- [ ] Domain verification complete (SendGrid/Mailgun)
- [ ] SPF/DKIM records added to DNS
- [ ] `SUPPORT_EMAIL` set to monitored inbox
- [ ] `FRONTEND_URL` updated to production URL
- [ ] Rate limiting configured appropriately
- [ ] Error monitoring/logging in place
- [ ] `.env` file not committed to git
- [ ] Test emails sent and received successfully
- [ ] Email templates reviewed for branding
- [ ] Spam folder checked for test emails
- [ ] Mobile email rendering tested
- [ ] Security audit completed
- [ ] Documentation updated for team

---

## Support

For issues with email configuration:
1. Check logs: `npm run dev` and look for email service messages
2. Test endpoint: `GET /api/support/test?email=your-email`
3. Review this documentation
4. Check email provider's status page

---

## License

© 2025 Call Sheet Converter. All rights reserved.

