# 🚀 Gmail Pub/Sub Quick Start

**Quick reference for setting up Gmail push notifications**

---

## ⚡ 5-Minute Setup

### 1. Enable Pub/Sub API
- Google Cloud Console → **APIs & Services** → **Library**
- Search "Cloud Pub/Sub API" → **Enable**

### 2. Create Topic
- **Pub/Sub** → **Topics** → **+ CREATE TOPIC**
- Topic ID: `gmail-inbox-notifications`
- Copy full name: `projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications`

### 3. Create Push Subscription
- **Pub/Sub** → **Subscriptions** → **+ CREATE SUBSCRIPTION**
- Subscription ID: `gmail-inbox-webhook`
- Topic: Select your topic
- Delivery type: **Push**
- Endpoint URL: 
  - Local: `http://localhost:8080/api/inbox/webhook` (use ngrok for testing)
  - Production: `https://yourdomain.com/api/inbox/webhook`

### 4. Set Environment Variable
```bash
# .env.local
GMAIL_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications
```

### 5. Start Watch from UI
- Navigate to `/daily-ops/inbox`
- Click **"Start Watch"** button
- Watch is now active! New emails will arrive automatically.

---

## 📋 Full Documentation

See `GMAIL_PUBSUB_SETUP.md` for:
- Detailed step-by-step instructions
- Troubleshooting guide
- Security configuration
- Local development with ngrok

---

## 🔄 Using Watch from Code

```typescript
import { useInboxViewModel } from '@/lib/viewmodels/useInboxViewModel'

const viewModel = useInboxViewModel()

// Start watching
await viewModel.startWatch()

// Stop watching
await viewModel.stopWatch()

// Check status
console.log(viewModel.watchStatus.isWatching)
```

---

## ✅ Verification

1. Click **"Start Watch"** in UI
2. Send test email to `inboxhaagsenieuwehorecagroep@gmail.com`
3. Check inbox list - email should appear automatically
4. Check MongoDB `inbox_emails` collection

---

## 🆘 Common Issues

**"Topic not found"**
- Check `GMAIL_PUBSUB_TOPIC` format: `projects/PROJECT_ID/topics/TOPIC_NAME`

**"Webhook not receiving"**
- Verify endpoint is publicly accessible
- Use ngrok for local development
- Check Pub/Sub subscription is **Active**

**"Watch expires"**
- Gmail watch expires after 7 days
- Renew by clicking **"Start Watch"** again
- Or set up cron job to auto-renew

---

**Need help?** See `GMAIL_PUBSUB_SETUP.md` for detailed troubleshooting.
