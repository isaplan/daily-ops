# Timezone & Deployment Configuration

## 🎯 Core Principle: Amsterdam-First Architecture

This application is built around **Amsterdam business hours and timezones** (CEST/CET). ALL scheduled tasks, business day calculations, and reporting are done in Amsterdam local time.

**The app can run on a server ANYWHERE in the world**, but scheduled tasks will ALWAYS run at the same Amsterdam times.

---

## 📍 Canonical Timezone: `Europe/Amsterdam`

```
CEST (summer): UTC+2
CET (winter):  UTC+1
```

All cron expressions in `nuxt.config.ts` are **interpreted as Amsterdam time**, NOT UTC.

---

## ⚙️ Deployment Requirements

### Environment Variable: `TZ=Europe/Amsterdam`

**This MUST be set on every deployment.** Without it, cron jobs may not run at the correct times.

### Docker

```dockerfile
ENV TZ=Europe/Amsterdam
```

Or in `docker-compose.yml`:

```yaml
environment:
  TZ: Europe/Amsterdam
```

### DigitalOcean App Platform

In your `app.yaml` or web service settings:

```yaml
services:
  - name: daily-ops
    environment:
      - key: TZ
        value: Europe/Amsterdam
```

### Vercel

In your project settings (Environment Variables):

```
TZ = Europe/Amsterdam
```

### AWS Lambda / ECS Task

Lambda environment variables:
```
TZ=Europe/Amsterdam
```

Or in ECS task definition:
```json
"environment": [
  {
    "name": "TZ",
    "value": "Europe/Amsterdam"
  }
]
```

---

## 📅 Scheduled Tasks (Amsterdam Time)

### Inbox Gmail Sync (3× daily)

| Time | Purpose |
|------|---------|
| **08:05** | Morning sync - fetch overnight Bork reports, previous day finalization |
| **18:05** | Evening sync - fetch day-end reports, afternoon updates |
| **23:05** | Late night - catch any stragglers, prepare for next day |

**Cron:** `5 8 * * *`, `5 18 * * *`, `5 23 * * *` (Amsterdam time)

### Bork + Eitje Aggregation (6× daily)

| Time | Purpose |
|------|---------|
| **06:00** | Early morning - before first inbox poll |
| **13:00** | Midday - after first reports |
| **16:00** | Afternoon |
| **18:00** | Evening - before inbox poll |
| **20:00** | Night |
| **22:00** | Late night - prepare for next day |

**Cron:** `0 6,13,16,18,20,22 * * *` (Amsterdam time)

---

## 🔍 Troubleshooting

### Cron Jobs Not Running?

1. **Verify TZ is set:**
   ```bash
   echo $TZ
   ```
   Should output: `Europe/Amsterdam`

2. **Check Nitro startup logs:**
   Look for warning in console:
   ```
   [NUXT CONFIG] WARNING: TZ="..." but app expects TZ="Europe/Amsterdam"
   ```

3. **Manual task testing:**
   - UI: Click "Sync Gmail" or "Run Now" buttons on dashboard
   - API: `POST /api/inbox/sync` or `GET /api/inbox/sync-scheduled?secret=...`

4. **Check terminal for task logs:**
   ```
   [inbox:gmail-sync] SCHEDULED TASK TRIGGERED AT ...
   [inbox:gmail-sync] SUCCESS: { emailsCreated: X, emailsFailed: Y, total: Z }
   ```

### Task Runs But No Data Collected?

This usually means:
1. Gmail connection issue (check OAuth tokens)
2. No new emails since last run
3. MongoDB connection timeout (see `[ERROR] Connection timeout`)

---

## 📝 Business Day Logic (Reference)

Business days in this app are defined as:
```
06:00 to 05:59 next day (Amsterdam time)
```

Example:
- **Business Day 2026-05-07:**
  - Starts: 2026-05-07 06:00 Amsterdam
  - Ends: 2026-05-08 05:59 Amsterdam

When you navigate to "Yesterday" in the dashboard, it shows the previous business day (previous 06:00-05:59 period in Amsterdam time).

---

## 🚀 Verification Checklist

Before deploying to production:

- [ ] `TZ=Europe/Amsterdam` is set in environment
- [ ] Nitro starts without timezone warnings in logs
- [ ] Cron tasks appear in startup logs
- [ ] Tasks execute at expected Amsterdam times (check logs)
- [ ] Dashboard shows current/fresh data
- [ ] Manual "Sync" buttons work correctly

---

## 🔗 Related Files

- `nuxt.config.ts` — Scheduled task definitions
- `server/tasks/inbox/gmail-sync.ts` — Inbox sync task
- `server/tasks/integrations/bork-eitje-daily.ts` — Bork/Eitje task
- `.github/workflows/inbox-daily-sync.yml` — Manual GitHub Action (informational)
