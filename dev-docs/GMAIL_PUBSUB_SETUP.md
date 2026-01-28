# 📬 Gmail Pub/Sub Push Notifications Setup Guide

**How to set up real-time Gmail push notifications via Google Cloud Pub/Sub**

---

## 🎯 Overview

This guide walks you through setting up Google Cloud Pub/Sub to receive real-time notifications when new emails arrive in your Gmail inbox, eliminating the need for manual sync.

---

## 📋 Prerequisites

- ✅ Gmail API already configured (see `GMAIL_API_SETUP.md`)
- ✅ Google Cloud Project with billing enabled
- ✅ Gmail API enabled in your Google Cloud Project
- ✅ Pub/Sub API enabled (we'll enable it in Step 1)

---

## 🚀 Step-by-Step Setup

### Step 1: Enable Pub/Sub API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services** → **Library**
4. Search for "Cloud Pub/Sub API"
5. Click on **Cloud Pub/Sub API**
6. Click **Enable**

---

### Step 2: Create Pub/Sub Topic

1. In Google Cloud Console, navigate to **Pub/Sub** → **Topics**
2. Click **+ CREATE TOPIC**
3. Fill in the form:
   - **Topic ID:** `gmail-inbox-notifications` (or your preferred name)
   - **Add a default subscription:** Leave unchecked (we'll create it separately)
4. Click **CREATE TOPIC**
5. **Copy the full topic name** (format: `projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications`)
   - You'll need this for `GMAIL_PUBSUB_TOPIC` in your `.env` file

---

### Step 3: Create Pub/Sub Subscription (Push)

1. In the **Pub/Sub** section, go to **Subscriptions**
2. Click **+ CREATE SUBSCRIPTION**
3. Fill in the form:
   - **Subscription ID:** `gmail-inbox-webhook` (or your preferred name)
   - **Select a Cloud Pub/Sub topic:** Choose the topic you created in Step 2
   - **Delivery type:** Select **Push**
   - **Endpoint URL:** 
     - **For local development:** `http://localhost:8080/api/inbox/webhook`
     - **For production:** `https://yourdomain.com/api/inbox/webhook`
     - ⚠️ **IMPORTANT:** Must be publicly accessible (use ngrok for local dev)
   - **Authentication:** 
     - For production, enable **Authentication** and configure OIDC
     - For local dev/testing, you can skip authentication (not recommended for production)
4. Click **CREATE**

---

### Step 4: Configure Webhook Authentication (Production Only)

For production, you should secure your webhook endpoint:

1. In the subscription settings, go to **Authentication**
2. Enable **Authentication**
3. Configure **OIDC**:
   - **Service account:** Create or select a service account
   - **Audience:** Your webhook URL (e.g., `https://yourdomain.com/api/inbox/webhook`)
4. Save the configuration

**For local development:**
- Use [ngrok](https://ngrok.com/) to expose your local server:
  ```bash
  ngrok http 8080
  ```
- Use the ngrok URL in your Pub/Sub subscription endpoint
- Update the endpoint URL in Pub/Sub when ngrok restarts (URL changes)

---

### Step 5: Grant Gmail API Permission to Publish

1. In Google Cloud Console, go to **IAM & Admin** → **Service Accounts**
2. Find or create a service account for Gmail API
3. Grant it the **Pub/Sub Publisher** role:
   - Click on the service account
   - Go to **Permissions** tab
   - Click **+ GRANT ACCESS**
   - Add role: **Pub/Sub Publisher**
   - Click **SAVE**

**Note:** The Gmail API uses OAuth2, so this step ensures Gmail can publish to your topic.

---

### Step 6: Configure Environment Variables

1. Open your `.env.local` file (or `.env` for production)
2. Add the Pub/Sub topic name:

```bash
# Gmail Push Notifications (Pub/Sub)
# Format: projects/YOUR_PROJECT_ID/topics/YOUR_TOPIC_NAME
GMAIL_PUBSUB_TOPIC=projects/your-project-id/topics/gmail-inbox-notifications
```

**Example:**
```bash
GMAIL_PUBSUB_TOPIC=projects/daily-ops-123456/topics/gmail-inbox-notifications
```

3. Save the file
4. Restart your Next.js dev server if running

---

### Step 7: Start the Watch Subscription

You can start the watch subscription in two ways:

#### Option A: From the UI (Recommended)

1. Navigate to `/daily-ops/inbox` in your app
2. Add a button or use the ViewModel to start watching:

```typescript
// In your inbox page component
const viewModel = useInboxViewModel()

const handleStartWatch = async () => {
  const result = await viewModel.startWatch()
  if (result) {
    console.log('Watch started:', result)
    // Show success message
  }
}
```

#### Option B: Via API Call

```bash
curl -X POST http://localhost:8080/api/inbox/watch \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "projects/your-project-id/topics/gmail-inbox-notifications"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "historyId": "1234567890",
    "expiration": "2026-01-28T12:00:00.000Z",
    "topicName": "projects/your-project-id/topics/gmail-inbox-notifications"
  }
}
```

---

### Step 8: Test the Webhook

1. **Send a test email** to your inbox address (`inboxhaagsenieuwehorecagroep@gmail.com`)
2. **Check your application logs** for webhook requests
3. **Verify the email appears** in your inbox list
4. **Check MongoDB** `inbox_emails` collection for the new email

**Expected webhook payload:**
```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiJpbmJveGhhYWdzZW5pZXV3ZWhvcmVjYWdyb2VwQGdtYWlsLmNvbSIsImhpc3RvcnlJZCI6IjEyMzQ1Njc4OTAifQ==",
    "messageId": "1234567890",
    "publishTime": "2026-01-27T12:00:00.000Z"
  },
  "subscription": "projects/your-project-id/subscriptions/gmail-inbox-webhook"
}
```

---

## 🔍 Troubleshooting

### **Error: "Topic not found"**

**Problem:** `GMAIL_PUBSUB_TOPIC` doesn't match your actual topic name.

**Solution:**
1. Check the topic name in Google Cloud Console
2. Format must be: `projects/PROJECT_ID/topics/TOPIC_NAME`
3. Update `.env.local` with the correct value
4. Restart your server

---

### **Error: "Permission denied"**

**Problem:** Gmail API doesn't have permission to publish to Pub/Sub.

**Solution:**
1. Go to **IAM & Admin** → **Service Accounts**
2. Find the service account used by Gmail API
3. Grant **Pub/Sub Publisher** role
4. Wait 1-2 minutes for permissions to propagate

---

### **Webhook not receiving notifications**

**Problem:** Pub/Sub subscription endpoint is not accessible or misconfigured.

**Solutions:**

1. **Check endpoint URL:**
   - Must be publicly accessible
   - Must return 200 status code
   - For local dev, use ngrok

2. **Check subscription status:**
   - Go to **Pub/Sub** → **Subscriptions**
   - Check if subscription is **Active**
   - Check **Message delivery** metrics

3. **Verify webhook endpoint:**
   ```bash
   curl -X POST http://localhost:8080/api/inbox/webhook \
     -H "Content-Type: application/json" \
     -d '{"message": {"data": "test"}}'
   ```

4. **Check application logs:**
   - Look for webhook requests in your Next.js logs
   - Check for errors in the webhook handler

---

### **Watch expires after 7 days**

**Problem:** Gmail watch subscriptions expire after 7 days.

**Solution:**
- Implement a cron job to renew the watch subscription:
  ```typescript
  // Renew watch every 6 days
  await viewModel.startWatch()
  ```
- Or set up a scheduled task to call `/api/inbox/watch` POST endpoint

---

### **Local development with ngrok**

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # or
   brew install ngrok
   ```

2. **Start your Next.js server:**
   ```bash
   npm run dev
   ```

3. **Start ngrok:**
   ```bash
   ngrok http 8080
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Update Pub/Sub subscription endpoint:**
   - Go to **Pub/Sub** → **Subscriptions** → Your subscription
   - Click **Edit**
   - Update **Endpoint URL** to: `https://abc123.ngrok.io/api/inbox/webhook`
   - Click **Update**

6. **Note:** ngrok URLs change on restart, so update Pub/Sub each time

---

## ✅ Verification Checklist

- [ ] Pub/Sub API enabled
- [ ] Topic created with correct name
- [ ] Push subscription created with webhook endpoint
- [ ] `GMAIL_PUBSUB_TOPIC` set in `.env.local`
- [ ] Watch subscription started via API or UI
- [ ] Test email sent and received via webhook
- [ ] Email appears in inbox list
- [ ] Email stored in MongoDB

---

## 📚 Additional Resources

- [Gmail API Push Notifications](https://developers.google.com/gmail/api/guides/push)
- [Google Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Pub/Sub Push Subscriptions](https://cloud.google.com/pubsub/docs/push)
- [ngrok Documentation](https://ngrok.com/docs)

---

## 🔄 Next Steps

After setup is complete:

1. **Monitor webhook delivery** in Pub/Sub console
2. **Set up error alerts** for failed webhook deliveries
3. **Implement watch renewal** (cron job to renew every 6 days)
4. **Add webhook authentication** for production security
5. **Set up monitoring** for email processing failures

---

**Need help?** Check the application logs and Pub/Sub metrics in Google Cloud Console.
