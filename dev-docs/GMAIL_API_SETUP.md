# 📧 Gmail API Setup Guide

**How to get Gmail OAuth2 credentials for inbox feature**

---

## 🎯 Step-by-Step Instructions

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with the Google account that owns `inboxhaagsenieuwehorecagroep@gmail.com`
3. Create a new project (or select existing):
   - Click project dropdown → "New Project"
   - Name: "Daily Ops" (or your choice)
   - Click "Create"

### Step 2: Enable Gmail API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click on **Gmail API**
4. Click **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure OAuth consent screen first:
   - **User Type:** Internal (if using Google Workspace) or External
   - **App name:** Daily Ops Inbox
   - **User support email:** Your email
   - **Developer contact:** Your email
   - Click **Save and Continue**
   - **Scopes:** Add `https://www.googleapis.com/auth/gmail.readonly`
   - Click **Save and Continue**
   - **Test users:** Add `inboxhaagsenieuwehorecagroep@gmail.com`
   - Click **Save and Continue**

4. Create OAuth Client ID:
   - **Application type:** Web application
   - **Name:** Daily Ops Gmail Client
   - **Authorized redirect URIs:** ⚠️ **CRITICAL - Must match exactly:**
     - `http://localhost:8080` (for development)
     - `http://localhost:8080/` (also add with trailing slash)
     - `https://yourdomain.com` (for production)
     - **For OAuth Playground:** `https://developers.google.com/oauthplayground`
   - Click **Create**
   
   **⚠️ IMPORTANT:** The redirect URI must match EXACTLY (including http/https, port, trailing slash)

5. **Copy credentials:**
   - **Client ID:** Copy this → `GMAIL_CLIENT_ID`
   - **Client Secret:** Copy this → `GMAIL_CLIENT_SECRET`
   - **Keep this window open** (you'll need it)

### Step 4: Get Refresh Token

You need to authorize the app once to get a refresh token:

#### Option A: Using OAuth2 Playground (Easiest)

**⚠️ FIRST:** Add OAuth Playground redirect URI to your OAuth client:
1. Go to Google Cloud Console → **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add: `https://developers.google.com/oauthplayground`
4. Click **Save**
5. Wait 1-2 minutes for changes to propagate

**Then:**
1. Visit: https://developers.google.com/oauthplayground/
2. Click gear icon (⚙️) → Check "Use your own OAuth credentials"
3. Enter your **Client ID** and **Client Secret**
4. In left panel, find **Gmail API v1**
5. Check: `https://www.googleapis.com/auth/gmail.readonly`
6. Click **Authorize APIs**
7. Sign in with `inboxhaagsenieuwehorecagroep@gmail.com`
8. Click **Allow**
9. Click **Exchange authorization code for tokens**
10. **Copy the Refresh Token** → `GMAIL_REFRESH_TOKEN`

#### Option B: Using Node.js Script

Create a temporary script to get refresh token:

```javascript
// get-refresh-token.js
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:8080'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent'
});

console.log('Visit this URL:', authUrl);
console.log('After authorization, paste the code here and run:');
console.log('node get-refresh-token.js <CODE>');
```

---

## 📝 Environment Variables

Add these to your `.env.local` file:

```bash
# Gmail API (OAuth2)
GMAIL_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret-here
GMAIL_REFRESH_TOKEN=your-refresh-token-here
GMAIL_REDIRECT_URI=http://localhost:8080
GMAIL_INBOX_ADDRESS=inboxhaagsenieuwehorecagroep@gmail.com
```

---

## ✅ Verification

After adding credentials, test the connection:

1. Start your dev server: `npm run dev`
2. Navigate to: `/daily-ops/inbox`
3. Click **"Sync Now"** button
4. Check browser console for errors
5. Check MongoDB `inbox_emails` collection for new records

---

## 🔒 Security Notes

- **Never commit** `.env.local` to git (already in `.gitignore`)
- **Refresh tokens** don't expire (unless revoked)
- **Revoke access** if credentials are compromised:
  - Google Account → Security → Third-party apps → Revoke access

---

## 🆘 Troubleshooting

### **Error 403: access_denied** ⚠️ APP IN TESTING MODE

**Problem:** "Daily Ops Inbox has not completed the Google verification process" - App is in testing mode and email is not added as a test user.

**Solution:**
1. Go to Google Cloud Console → **APIs & Services** → **OAuth consent screen**
2. Scroll down to **Test users** section
3. Click **+ ADD USERS**
4. Add: `inboxhaagsenieuwehorecagroep@gmail.com`
5. Click **Add**
6. **Wait 1-2 minutes** for changes to propagate
7. Try authorization again

**Note:** In testing mode, only emails added as test users can authorize the app. For production, you'll need to submit for verification.

---

### **Error 400: redirect_uri_mismatch** ⚠️ MOST COMMON

**Problem:** The redirect URI in your OAuth request doesn't match authorized URIs.

**For OAuth Playground (what you're using):**
1. Go to Google Cloud Console → **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Under **Authorized redirect URIs**, add:
   - `https://developers.google.com/oauthplayground` ← **REQUIRED for OAuth Playground**
4. Click **Save**
5. **Wait 1-2 minutes** for changes to propagate
6. Try OAuth Playground again

**Note:** 
- `http://localhost:8080` is correct for your app (localhost uses http, not https)
- OAuth Playground needs `https://developers.google.com/oauthplayground` as redirect URI
- These are different URIs for different purposes

**Error: "Invalid credentials"**
- Check Client ID/Secret are correct (no extra spaces)
- Verify redirect URI matches exactly

**Error: "Refresh token not found"**
- Re-authorize with `prompt: 'consent'` to get new refresh token

**Error: "Access denied"**
- Check OAuth consent screen has correct scopes
- Verify test user email is added

---

**Need help?** Check Google's official docs: https://developers.google.com/gmail/api/quickstart/nodejs
