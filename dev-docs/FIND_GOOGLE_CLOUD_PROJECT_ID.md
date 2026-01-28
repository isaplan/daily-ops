# 🔍 How to Find Your Google Cloud Project ID

**Quick Answer:** Project ID is **NOT** the same as Project Name. It's a unique identifier that Google Cloud generates.

---

## 📋 Project Name vs Project ID

| | Project Name | Project ID |
|---|---|---|
| **What it is** | Human-readable name you choose | Unique identifier Google generates |
| **Example** | "Daily Ops" | `daily-ops-123456` or `my-project-789012` |
| **Can change?** | Yes, you can rename it | No, it's permanent |
| **Format** | Any text | Lowercase letters, numbers, hyphens |

---

## 🎯 Where to Find Your Project ID

### Method 1: Google Cloud Console (Easiest)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Look at the **top navigation bar** - you'll see a dropdown that shows your project
3. Click on the project dropdown (it shows your Project Name)
4. The **Project ID** is shown in parentheses or in the dropdown list

**Example:**
```
Project Dropdown: "Daily Ops (daily-ops-123456)"
                              ↑
                         This is your Project ID
```

### Method 2: Project Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **project dropdown** at the top
3. Click **"Project settings"** (or go to **IAM & Admin** → **Settings**)
4. Your **Project ID** is displayed at the top of the page

### Method 3: From Pub/Sub Topic (If Already Created)

If you've already created a Pub/Sub topic:

1. Go to **Pub/Sub** → **Topics**
2. Click on your topic (e.g., `gmail-inbox-notifications`)
3. Look at the **Full topic name** - it shows: `projects/YOUR_PROJECT_ID/topics/gmail-inbox-notifications`
4. Extract the Project ID from there

**Example:**
```
Full topic name: projects/daily-ops-123456/topics/gmail-inbox-notifications
                 └───────────────┘
                    This is your Project ID
```

### Method 4: From OAuth Credentials (If Already Created)

If you've already created OAuth credentials:

1. Go to **APIs & Services** → **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Look at the **Client ID** - it shows: `YOUR_CLIENT_ID.apps.googleusercontent.com`
4. The part before `.apps.googleusercontent.com` is related to your project, but not the Project ID

**Note:** This method doesn't directly show Project ID, but confirms you're in the right project.

---

## ✅ Quick Check: Do You Have a Project?

If you're not sure if you've created a project yet:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. If you see a project dropdown, you have a project
3. If you see "Select a project" or "No projects", you need to create one first

### To Create a New Project:

1. Click **"Select a project"** or the project dropdown
2. Click **"New Project"**
3. Enter **Project Name:** "Daily Ops" (or your choice)
4. Click **"Create"**
5. Google will automatically generate a **Project ID** (you can edit it, but it must be unique globally)
6. **Copy the Project ID** - you'll need it for `GMAIL_PUBSUB_TOPIC`

---

## 📝 Example: Setting GMAIL_PUBSUB_TOPIC

Once you have your Project ID, set it in `.env.local`:

```bash
# Example with Project ID: daily-ops-123456
GMAIL_PUBSUB_TOPIC=projects/daily-ops-123456/topics/gmail-inbox-notifications

# Format: projects/PROJECT_ID/topics/TOPIC_NAME
```

**Important:**
- Replace `daily-ops-123456` with **your actual Project ID**
- Replace `gmail-inbox-notifications` with **your actual topic name** (if different)

---

## 🔍 Still Can't Find It?

### Check Your Browser URL

When you're in Google Cloud Console, look at the URL:
```
https://console.cloud.google.com/home/dashboard?project=YOUR_PROJECT_ID
                                                      ↑
                                              This is your Project ID
```

### Use gcloud CLI (If Installed)

```bash
# List all projects
gcloud projects list

# Get current project
gcloud config get-value project
```

---

## ⚠️ Common Mistakes

1. **Using Project Name instead of Project ID**
   - ❌ Wrong: `projects/Daily Ops/topics/...`
   - ✅ Correct: `projects/daily-ops-123456/topics/...`

2. **Including spaces or special characters**
   - ❌ Wrong: `projects/My Project/topics/...`
   - ✅ Correct: `projects/my-project-123456/topics/...`

3. **Using wrong format**
   - ❌ Wrong: `daily-ops-123456/topics/...`
   - ✅ Correct: `projects/daily-ops-123456/topics/...`

---

## 🎯 Quick Reference

**Project ID Format:**
- Lowercase letters
- Numbers
- Hyphens
- No spaces
- Globally unique

**Example Project IDs:**
- `daily-ops-123456`
- `my-project-789012`
- `test-project-abc123`

**Full Topic Name Format:**
```
projects/PROJECT_ID/topics/TOPIC_NAME
```

---

**Need help?** Check the [Google Cloud Console](https://console.cloud.google.com/) and look for the project dropdown at the top of the page.
