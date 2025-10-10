# Gmail Setup Guide for Support Email System

## 🎯 Quick Setup (5 Minutes)

This guide will help you set up Gmail to send support emails from your Call Sheet Converter application.

---

## 📋 Prerequisites

- A Gmail account (your existing Google email)
- 2-Factor Authentication enabled on your Google account

---

## ⚡ Step-by-Step Setup

### Step 1: Enable 2-Factor Authentication (If Not Already Enabled)

1. **Go to your Google Account:**
   - Visit: https://myaccount.google.com/
   - Or click your profile picture in Gmail → "Manage your Google Account"

2. **Navigate to Security:**
   - Click "Security" in the left sidebar
   - Or visit: https://myaccount.google.com/security

3. **Enable 2-Step Verification:**
   - Scroll down to "How you sign in to Google"
   - Click on "2-Step Verification"
   - Click "Get Started"
   - Follow the prompts to set up (usually phone verification)
   - **Important:** This is required for App Passwords

---

### Step 2: Generate App Password

1. **Go to App Passwords:**
   - Visit: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords (at the bottom)

2. **Create New App Password:**
   - You might need to re-enter your Google password
   - Under "Select app" dropdown, choose: **"Mail"**
   - Under "Select device" dropdown, choose: **"Other (Custom name)"**
   - Enter a name like: **"Call Sheet Converter"**
   - Click **"Generate"**

3. **Copy the 16-character Password:**
   ```
   Example: abcd efgh ijkl mnop
   ```
   - **IMPORTANT:** Copy this immediately - you won't see it again!
   - The spaces don't matter when you paste it

---

### Step 3: Configure Backend Environment Variables

1. **Navigate to your backend directory:**
   ```bash
   cd /home/bkg/parrot/node/backend
   ```

2. **Create or edit `.env` file:**
   ```bash
   nano .env
   # or
   vim .env
   # or use any text editor
   ```

3. **Add these environment variables:**
   ```bash
   # Email Configuration
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   
   # Support Email Settings
   SUPPORT_EMAIL=your-email@gmail.com
   EMAIL_FROM=your-email@gmail.com
   
   # Frontend URL (update based on your deployment)
   FRONTEND_URL=https://sjcallsheets-project.vercel.app
   ```

4. **Replace with your actual values:**
   - `GMAIL_USER`: Your full Gmail address
   - `GMAIL_APP_PASSWORD`: The 16-character password (spaces optional)
   - `SUPPORT_EMAIL`: Where support requests will be sent (usually same as GMAIL_USER)
   - `EMAIL_FROM`: The "From" address in emails (usually same as GMAIL_USER)
   - `FRONTEND_URL`: Your actual frontend URL

---

### Step 4: Deploy to Render.com

Since your backend is deployed on Render.com (https://backend-cv7a.onrender.com), you need to add these environment variables there:

1. **Go to Render Dashboard:**
   - Visit: https://dashboard.render.com/
   - Log in to your account

2. **Select Your Backend Service:**
   - Find your backend service (the one running on backend-cv7a.onrender.com)
   - Click on it

3. **Add Environment Variables:**
   - Click on "Environment" in the left sidebar
   - Click "Add Environment Variable"
   - Add each of these:

   | Key | Value | Notes |
   |-----|-------|-------|
   | `EMAIL_PROVIDER` | `gmail` | Provider type |
   | `GMAIL_USER` | `your-email@gmail.com` | Your Gmail address |
   | `GMAIL_APP_PASSWORD` | `abcdefghijklmnop` | 16-char app password |
   | `SUPPORT_EMAIL` | `your-email@gmail.com` | Where to receive support emails |
   | `EMAIL_FROM` | `your-email@gmail.com` | From address |
   | `FRONTEND_URL` | `https://sjcallsheets-project.vercel.app` | Your frontend URL |

4. **Save Changes:**
   - Click "Save Changes" at the bottom
   - Render will automatically redeploy your service with new environment variables
   - Wait for the deployment to complete (usually 2-3 minutes)

---

### Step 5: Test the Email Service

#### Option 1: Test from Backend (If Running Locally)

```bash
# In your backend directory
npm run dev

# In another terminal, test the email
curl "http://localhost:3000/api/support/test?email=your-test-email@gmail.com"
```

#### Option 2: Test from Deployed Backend

```bash
# Test the deployed backend
curl "https://backend-cv7a.onrender.com/api/support/test?email=your-test-email@gmail.com"
```

**Expected Response:**
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

#### Option 3: Test via Support Form

1. Go to your frontend: https://sjcallsheets-project.vercel.app/support
2. Fill out the support form
3. Submit
4. Check your Gmail inbox for two emails:
   - **Email 1:** Support request (to SUPPORT_EMAIL)
   - **Email 2:** Confirmation (to the email you entered in the form)

---

## 🔍 Verification Checklist

After setup, verify:

- [ ] 2-Factor Authentication is enabled on Google account
- [ ] App Password has been generated (16 characters)
- [ ] Environment variables are set on Render.com
- [ ] Backend service has been redeployed
- [ ] Test email sent successfully
- [ ] Test email received in Gmail inbox
- [ ] Support form submission works
- [ ] Confirmation email received

---

## 🐛 Troubleshooting

### Issue: "Email service not configured"

**Solution:**
1. Check that environment variables are set on Render.com
2. Verify the variable names are exactly as shown (case-sensitive)
3. Redeploy the service on Render
4. Check Render logs for initialization message

### Issue: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Solution:**
1. Make sure you're using the **App Password**, not your regular Google password
2. Double-check the App Password (no spaces needed, but they don't hurt)
3. Verify 2FA is enabled on your Google account
4. Try generating a new App Password

### Issue: Emails not sending

**Solution:**
1. Check Render logs for error messages:
   ```
   Dashboard → Your Service → Logs
   ```
2. Look for:
   ```
   ✅ Email service ready: gmail
   ```
   If you see this, email service is working!

3. If you see:
   ```
   ⚠️  Email service not configured
   ```
   Environment variables are missing or incorrect

### Issue: Emails going to spam

**Solution:**
1. This is normal for the first few emails
2. Mark the email as "Not Spam" in Gmail
3. Gmail will learn over time
4. For production, consider using SendGrid (better deliverability)

### Issue: "Less secure app" error

**Solution:**
- Google removed "Less secure apps" option
- You MUST use App Passwords now (which you did in Step 2)
- Regular password won't work

---

## 📊 Understanding the Email Flow

```
User fills out support form
        ↓
Frontend sends POST /api/support
        ↓
Backend validates & sanitizes input
        ↓
Backend sends 2 emails via Gmail:
├── 1. To SUPPORT_EMAIL (you)
│   └── Contains: User's message, contact info, metadata
└── 2. To user's email
    └── Contains: Confirmation that we received their request
```

---

## 🔒 Security Notes

### App Password Security

✅ **Good:**
- Store in environment variables only
- Never commit to git
- Use different App Passwords for different apps
- Revoke if compromised

❌ **Bad:**
- Don't share App Passwords
- Don't use your regular Google password
- Don't hardcode in source code
- Don't commit to version control

### Gmail Sending Limits

- **Free Gmail:** 500 emails per day
- **Google Workspace:** 2,000 emails per day
- **If you exceed:** Gmail temporarily blocks sending

**For Production:**
If you expect > 500 support requests per day, use SendGrid or Mailgun instead.

---

## 🚀 Production Recommendations

### Current Setup (Gmail)
✅ Good for: Development, testing, small-scale
❌ Not ideal for: High volume, critical business emails

### Upgrade Path (When Ready)

**Option 1: SendGrid (Recommended)**
- Free tier: 100 emails/day
- Paid: From $19.95/month (50,000 emails)
- Better deliverability
- Analytics included

**Option 2: Mailgun**
- Free tier: 100 emails/day (first 3 months)
- Paid: Pay as you go
- Developer-friendly
- Good documentation

**Migration is Easy:**
Just change `EMAIL_PROVIDER=sendgrid` and add the API key. No code changes needed!

---

## 📝 Quick Reference

### Environment Variables (Render.com)

```bash
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-password
SUPPORT_EMAIL=your-email@gmail.com
EMAIL_FROM=your-email@gmail.com
FRONTEND_URL=https://sjcallsheets-project.vercel.app
```

### Test Commands

```bash
# Test endpoint (development)
curl "http://localhost:3000/api/support/test?email=test@example.com"

# Test endpoint (production)
curl "https://backend-cv7a.onrender.com/api/support/test?email=test@example.com"

# Test support submission
curl -X POST "https://backend-cv7a.onrender.com/api/support" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Test Support Request",
    "message": "This is a test message to verify the email system works.",
    "category": "Technical Support"
  }'
```

### Useful Links

- **Google Account:** https://myaccount.google.com/
- **App Passwords:** https://myaccount.google.com/apppasswords
- **Render Dashboard:** https://dashboard.render.com/
- **Your Backend:** https://backend-cv7a.onrender.com/
- **Your Frontend:** https://sjcallsheets-project.vercel.app/

---

## ✅ Success Indicators

You'll know it's working when:

1. **Backend logs show:**
   ```
   ✅ Email service ready: gmail
   ```

2. **Test email returns:**
   ```json
   {"success": true, "message": "Test email sent successfully"}
   ```

3. **You receive emails in your Gmail inbox**

4. **Support form submissions work from frontend**

---

## 💡 Tips

1. **Use a dedicated email** (optional but recommended)
   - Create `support@yourdomain.com` forwarding to your Gmail
   - Or create a dedicated Gmail like `callsheets.support@gmail.com`
   - Keeps support emails organized

2. **Set up filters in Gmail**
   - Auto-label support emails
   - Create folders for different categories
   - Set up auto-responses if needed

3. **Monitor the inbox**
   - Check SUPPORT_EMAIL regularly
   - Set up mobile notifications
   - Consider using Gmail's priority inbox

4. **Rate limiting**
   - Current: 3 requests per 15 minutes per IP
   - Prevents spam
   - Can be adjusted if too strict

---

## 🎉 You're All Set!

Once you complete these steps, your support email system will be fully functional and secure!

**Need help?** Check the troubleshooting section or review the logs on Render.com.

---

**© 2025 Call Sheet Converter**

