# 🚀 Quick Start: Gmail Setup (2 Minutes)

## Step 1: Get Your App Password

1. **Go to:** https://myaccount.google.com/apppasswords
   - Sign in if needed
   - If you see "2-Step Verification is not set up", enable it first

2. **Create App Password:**
   - App: **Mail**
   - Device: **Other (Custom name)** → Enter "Call Sheets"
   - Click **Generate**

3. **Copy the 16-character password:**
   ```
   Example: abcd efgh ijkl mnop
   ```
   ⚠️ Save this immediately - you can't see it again!

---

## Step 2: Add to Render.com

1. **Go to:** https://dashboard.render.com/
2. **Click your backend service** (backend-cv7a)
3. **Click "Environment"** (left sidebar)
4. **Add these variables:**

```
EMAIL_PROVIDER          →   gmail
GMAIL_USER              →   your-email@gmail.com
GMAIL_APP_PASSWORD      →   abcdefghijklmnop
SUPPORT_EMAIL           →   your-email@gmail.com
EMAIL_FROM              →   your-email@gmail.com
FRONTEND_URL            →   https://sjcallsheets-project.vercel.app
```

5. **Click "Save Changes"**
6. **Wait 2-3 minutes** for automatic redeployment

---

## Step 3: Test It!

### Option A: Quick Browser Test
Open this URL in your browser:
```
https://backend-cv7a.onrender.com/api/support/test?email=YOUR-EMAIL@gmail.com
```
Replace `YOUR-EMAIL@gmail.com` with your actual email.

### Option B: Command Line Test
```bash
curl "https://backend-cv7a.onrender.com/api/support/test?email=YOUR-EMAIL@gmail.com"
```

### Expected Result:
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

**Check your email!** You should receive a test email.

---

## Step 4: Test Support Form

1. Go to: https://sjcallsheets-project.vercel.app/support
2. Fill out the form
3. Submit
4. Check your Gmail for:
   - ✅ Support request email (to you)
   - ✅ Confirmation email (to the email you entered)

---

## ✅ Success!

You should see in Render logs:
```
✅ Email service ready: gmail
```

If not, check the troubleshooting section in `GMAIL_SETUP_GUIDE.md`

---

## 🔧 Environment Variables Reference

| Variable | Your Value | Example |
|----------|------------|---------|
| `EMAIL_PROVIDER` | `gmail` | `gmail` |
| `GMAIL_USER` | Your Gmail | `john@gmail.com` |
| `GMAIL_APP_PASSWORD` | From Step 1 | `abcdefghijklmnop` |
| `SUPPORT_EMAIL` | Where you want support emails | `john@gmail.com` |
| `EMAIL_FROM` | From address | `john@gmail.com` |
| `FRONTEND_URL` | Your frontend URL | `https://sjcallsheets-project.vercel.app` |

---

## 🐛 Quick Troubleshooting

**"Email service not configured"**
→ Check environment variables are set on Render, then redeploy

**"Invalid login"**
→ Use App Password, not regular Google password

**No email received**
→ Check spam folder, verify GMAIL_USER is correct

**Test endpoint returns error**
→ Wait for Render deployment to complete, check logs

---

## 📚 More Help

- **Full Guide:** See `GMAIL_SETUP_GUIDE.md`
- **Security Info:** See `SECURE_EMAIL_IMPLEMENTATION_SUMMARY.md`
- **API Docs:** See `EMAIL_CONFIGURATION_GUIDE.md`

---

**That's it! Your support email system is now live! 🎉**

