# 🔍 Webhook Setup Checklist

Quick reference guide for verifying and setting up Gmail webhooks.

---

## ✅ Verification Script

Run the verification script to check your setup:

```bash
node scripts/verify-webhook-setup.js
```

This will check:
- ✅ Environment variables
- ✅ Database connection
- ✅ Webhook logs
- ✅ Watch subscription status
- ✅ Webhook endpoint accessibility

---

## 📋 Manual Checklist

### 1. Environment Variables

Check `.env.local` has all required variables:

```bash
# Required
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications
GMAIL_INBOX_ADDRESS=inboxhaagsenieuwehorecagroep@gmail.com
```

**⚠️ Common Issue:** `GMAIL_PUBSUB_TOPIC` must be in format:
```
projects/YOUR_PROJECT_ID/topics/YOUR_TOPIC_NAME
```

---

### 2. Google Cloud Pub/Sub Setup

#### Create Topic (if not exists):
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Pub/Sub** → **Topics**
3. Create topic: `gmail-inbox-notifications`
4. Copy full topic name: `projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications`

#### Create Push Subscription:
1. Go to **Pub/Sub** → **Subscriptions**
2. Click **+ CREATE SUBSCRIPTION**
3. **Subscription ID:** `gmail-inbox-webhook`
4. **Topic:** Select your topic
5. **Delivery type:** Push
6. **Endpoint URL:**
   - **Local dev:** Use ngrok URL (see ngrok setup below)
   - **Production:** `https://yourdomain.com/api/inbox/webhook`
7. Click **CREATE**

---

### 3. Start Watch Subscription

The watch subscription tells Gmail to send notifications to your Pub/Sub topic.

#### Option A: Via API
```bash
curl -X POST http://localhost:8080/api/inbox/watch \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications"
  }'
```

#### Option B: Via UI
Navigate to `/daily-ops/inbox` and use the "Start Watch" button (if implemented).

**Response:**
```json
{
  "success": true,
  "data": {
    "historyId": "1234567890",
    "expiration": "2026-01-28T12:00:00.000Z",
    "topicName": "projects/..."
  }
}
```

**⚠️ Important:** Watch subscriptions expire after 7 days. You need to renew them periodically.

---

### 4. Local Development with ngrok

For local development, you need to expose your local server publicly.

#### Install ngrok:
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

#### Start ngrok:
```bash
# In a separate terminal
ngrok http 8080
```

#### Copy ngrok URL:
You'll see something like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8080
```

#### Update Pub/Sub Subscription:
1. Go to **Pub/Sub** → **Subscriptions** → `gmail-inbox-webhook`
2. Click **Edit**
3. Update **Endpoint URL** to: `https://abc123.ngrok.io/api/inbox/webhook`
4. Click **Update**

**⚠️ Note:** ngrok URLs change when you restart ngrok. Update Pub/Sub subscription each time.

---

### 5. Test Webhook

#### Send Test Email:
Send an email to `inboxhaagsenieuwehorecagroep@gmail.com`

#### Check Webhook Logs:
```bash
# Check database for webhook logs
node -e "
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const ProcessingLog = mongoose.model('ProcessingLog', new mongoose.Schema({}, { strict: false }));
  const logs = await ProcessingLog.find({ message: /webhook/i }).sort({ timestamp: -1 }).limit(5).lean();
  console.log('Webhook logs:', logs.length);
  logs.forEach(log => console.log(log.message, log.timestamp));
  process.exit(0);
});
"
```

#### Check Pub/Sub Metrics:
1. Go to **Pub/Sub** → **Subscriptions** → `gmail-inbox-webhook`
2. Check **Message delivery** metrics
3. Look for successful deliveries

---

## 🔧 Troubleshooting

### ❌ "No webhooks received"

**Check:**
1. ✅ Watch subscription is active (POST /api/inbox/watch)
2. ✅ Pub/Sub subscription endpoint is correct
3. ✅ Webhook endpoint is publicly accessible (use ngrok for local)
4. ✅ Pub/Sub subscription is **Active** (not paused)

### ❌ "Topic not found"

**Fix:**
- Verify `GMAIL_PUBSUB_TOPIC` format: `projects/PROJECT_ID/topics/TOPIC_NAME`
- Check topic exists in Google Cloud Console

### ❌ "Permission denied"

**Fix:**
1. Go to **IAM & Admin** → **Service Accounts**
2. Find service account used by Gmail API
3. Grant **Pub/Sub Publisher** role
4. Wait 1-2 minutes for propagation

### ❌ "Webhook endpoint not accessible"

**For local dev:**
- Use ngrok to expose local server
- Update Pub/Sub subscription endpoint to ngrok URL

**For production:**
- Verify endpoint is publicly accessible
- Check firewall/security group rules
- Verify SSL certificate is valid

---

## 📊 Monitoring

### Check Webhook Activity:
```bash
node scripts/verify-webhook-setup.js
```

### Check Pub/Sub Metrics:
- Go to **Pub/Sub** → **Subscriptions** → Your subscription
- View **Message delivery** and **Message backlog** metrics

### Check Application Logs:
- Next.js server logs will show webhook requests
- Database `ProcessingLog` collection tracks all webhook processing

---

## 🔄 Watch Subscription Renewal

Watch subscriptions expire after 7 days. Set up automatic renewal:

### Option 1: Cron Job
```bash
# Renew every 6 days
0 0 */6 * * curl -X POST http://localhost:8080/api/inbox/watch
```

### Option 2: Scheduled Task
Use your hosting provider's scheduled task feature to call `/api/inbox/watch` POST endpoint every 6 days.

---

## ✅ Success Indicators

You'll know webhooks are working when:
1. ✅ `ProcessingLog` entries with `message: /webhook/i` appear
2. ✅ New emails appear in inbox list automatically
3. ✅ Pub/Sub metrics show successful message deliveries
4. ✅ No manual sync needed - emails appear in real-time

---

**Need help?** See `GMAIL_PUBSUB_SETUP.md` for detailed setup instructions.
