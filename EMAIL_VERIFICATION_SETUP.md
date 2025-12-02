# Email Verification Setup Guide

## 🔍 Issue Found

The new auth domain's `EmailAuthStrategy` **does NOT send verification emails** during registration. This has been **FIXED** in the code, but you need to **configure your email service**.

---

## ✅ What Was Fixed

1. ✅ Created `EmailVerificationRepository` in auth domain
2. ✅ Added email verification token generation
3. ✅ Added verification email sending to registration flow
4. ✅ Integrated with existing email service

---

## 🔧 Email Service Configuration

### Step 1: Check Current Configuration

```bash
cd /home/bkg/parrot/node/backend
cat .env | grep -E "EMAIL_|GMAIL_|SMTP_|SENDGRID"
```

If you see configuration, skip to **Step 3**.

---

### Step 2: Configure Email Service (Choose ONE)

#### Option A: Gmail (Easiest for Development)

1. **Create a test Gmail account** (don't use your personal email)
2. **Enable 2-Step Verification**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification"
3. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "Call Sheet Converter"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

4. **Add to `.env` file**:
   ```bash
   cd /home/bkg/parrot/node/backend
   
   # Add these lines to .env
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-test-email@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop  # Remove spaces!
   EMAIL_FROM=your-test-email@gmail.com
   SUPPORT_EMAIL=your-test-email@gmail.com
   FRONTEND_URL=http://localhost:5173
   ```

#### Option B: Generic SMTP

```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM=your-email@example.com
FRONTEND_URL=http://localhost:5173
```

#### Option C: SendGrid (Recommended for Production)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Get API key from Settings → API Keys
3. Add to `.env`:
   ```bash
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your-api-key-here
   EMAIL_FROM=noreply@yourdomain.com
   FRONTEND_URL=http://localhost:5173
   ```

---

### Step 3: Restart Backend Server

After adding email configuration:

```bash
cd /home/bkg/parrot/node/backend
pkill -f "node src/server.js"
npm start
```

Look for this message:
```
✅ Email service ready: gmail
```

If you see:
```
⚠️  Email service not configured. Emails will be logged to console.
```

→ Your email configuration is missing or incorrect.

---

## 🧪 Test Email Verification

### Test 1: Register New User

1. Go to: `http://localhost:5173/auth?mode=signup`
2. Create a new account
3. Check backend logs for:
   ```
   ✅ Email sent successfully: <message-id>
   ```
   OR
   ```
   📧 [EMAIL - Not Sent] Would send email:
   ```

4. **Check your email inbox** (including spam folder)

---

### Test 2: Check Email Service Status

```bash
# Check if email service initialized
curl http://localhost:3001/api/health
```

---

### Test 3: Manual Email Test (If Available)

Check if there's a test endpoint:

```bash
curl http://localhost:3001/api/support/test?email=your-email@gmail.com
```

---

## 🐛 Troubleshooting

### Issue 1: "Email service not configured"

**Solution**: Check `.env` file has correct email configuration:
```bash
cd /home/bkg/parrot/node/backend
cat .env | grep EMAIL
```

**Fix**: Add missing variables from Step 2 above.

---

### Issue 2: "Failed to send email" in logs

**Common causes**:
- ❌ Wrong Gmail app password (use App Password, not regular password)
- ❌ Gmail 2-Step Verification not enabled
- ❌ SMTP credentials incorrect
- ❌ Network/firewall blocking SMTP port

**Solution**:
1. Verify Gmail app password (16 characters, no spaces)
2. Check email provider settings
3. Check backend logs for detailed error message

---

### Issue 3: Email goes to spam

**Solution**:
- Use SendGrid or Mailgun for production (better deliverability)
- Verify your domain
- Use a professional `EMAIL_FROM` address

---

### Issue 4: No verification email received

**Check**:
1. ✅ Backend logs show "Email sent successfully"
2. ✅ Check spam/junk folder
3. ✅ Verify email address is correct
4. ✅ Check email service is initialized (see logs)

**Debug**:
```bash
# Check backend logs
cd /home/bkg/parrot/node/backend
tail -f logs/combined.log | grep -i email
```

---

## ✅ Verification Flow

1. **User registers** → Verification token created
2. **Email sent** → Contains link with token
3. **User clicks link** → Frontend: `/verify-email?token=...`
4. **Frontend calls backend** → `/api/auth/verify-email`
5. **Token validated** → User marked as verified

---

## 📋 Configuration Checklist

- [ ] Email provider configured in `.env`
- [ ] Email credentials are correct
- [ ] Backend shows "Email service ready" in logs
- [ ] Test registration sends email
- [ ] Verification link works
- [ ] Email verification updates user status

---

## 🔗 Related Files

- Email Service: `src/services/email.service.js`
- Email Verification Repository: `src/domains/auth/repositories/EmailVerificationRepository.js`
- Auth Strategy: `src/domains/auth/services/strategies/EmailAuthStrategy.js`
- Email Config Guide: `EMAIL_CONFIGURATION_GUIDE.md`

---

**Once configured, email verification will work automatically!** 🚀

