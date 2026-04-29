# Cron Job Scheduler Setup Guide

## Problem
The Bork and Eitje cron jobs configured in the UI don't automatically execute. The system requires an external scheduler to trigger the `/api/*/run-scheduled` endpoint.

## Solution: Set Up External Scheduler

### Option 1: Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/bork/v2/run-scheduled?secret=YOUR_CRON_SECRET",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/eitje/v2/run-scheduled?secret=YOUR_CRON_SECRET",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Option 2: GitHub Actions (Free)

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Run Bork Cron Jobs
on:
  schedule:
    # Daily at 1 AM UTC
    - cron: '0 1 * * *'
    # Daily at 8 AM UTC
    - cron: '0 8 * * *'
    # More schedules as needed

jobs:
  bork-daily:
    runs-on: ubuntu-latest
    steps:
      - name: Run Bork daily cron
        run: |
          curl -X GET "https://your-app.com/api/bork/v2/run-scheduled?secret=${{ secrets.CRON_SECRET }}"

  eitje-daily:
    runs-on: ubuntu-latest
    steps:
      - name: Run Eitje daily cron
        run: |
          curl -X GET "https://your-app.com/api/eitje/v2/run-scheduled?secret=${{ secrets.CRON_SECRET }}"
```

### Option 3: External Cron Service (e.g., EasyCron, cron-job.org)

1. Set up a free account at [cron-job.org](https://cron-job.org) or similar
2. Create a job that calls your endpoint:
   ```
   GET https://your-app.com/api/bork/v2/run-scheduled?secret=YOUR_CRON_SECRET
   ```
3. Set the schedule as needed (e.g., daily at 1 AM)

## Configuration

### 1. Set CRON_SECRET

Add to your `.env` file:
```
CRON_SECRET=your-secure-random-secret-here
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Enable Cron Jobs in UI

1. Navigate to `http://localhost:8080/daily-ops/settings/bork-api`
2. Click the "Cron Jobs" tab
3. Toggle the switches to enable:
   - Daily Data Sync
   - Master Data Sync
   - Historical Data Sync

The schedules are configured when you toggle them on. Default schedules:
- **Daily Data Sync**: `0 1,8,15,18,19,20,21,23 * * *` (every hour: 01, 08, 15, 18, 19, 20, 21, 23)
- **Master Data Sync**: `0 0 * * *` (daily at midnight)
- **Historical Data Sync**: `0 1 * * *` (daily at 1 AM)

## Testing

### Manual Test (Development)

Call the endpoint directly with your CRON_SECRET:

```bash
curl "http://localhost:8080/api/bork/v2/run-scheduled?secret=your-secret-here"
```

Response:
```json
{
  "success": true,
  "ran": 3,
  "results": [
    {
      "jobType": "daily-data",
      "ok": true,
      "message": "Synced 2/2 location(s) into bork_raw_data",
      "locations": [...]
    }
  ]
}
```

### Check Job Status

In the UI:
- Last run time will be updated
- Last sync result will show success/error
- Failed locations will be listed with error details

## Troubleshooting

### Jobs not running?
- Check CRON_SECRET is set correctly
- Verify the secret matches in both `.env` and your external scheduler
- Check that cron jobs are "enabled" (toggle on) in the UI

### Sync errors?
- Check Bork API credentials in the UI (test button)
- Verify API endpoints are accessible and returning data
- Check logs for network timeout errors (may indicate firewall/connectivity issues)

### Database connection timeout?
- Ensure MONGODB_URI is correct and the database is accessible
- Check firewall rules if using MongoDB Atlas
- For local development, ensure MongoDB is running locally or SSH tunnel is established

## Local Development Alternative

For local development without an external scheduler, you can manually trigger cron jobs through the UI's "Run Now" button on each cron job card. This will execute the job immediately and update the status.

