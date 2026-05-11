# Daily Ops

Nuxt 4 application for daily operations management with Bork/Eitje integrations, notes, and data synchronization.

## Quick Start

Install dependencies:
```bash
pnpm install
```

Start development server on `http://localhost:8080`:
```bash
pnpm dev
```

For a clean rebuild:
```bash
pnpm dev:clean
```

## Key Features

- **Daily Ops Dashboard** - Overview, insights, productivity, revenue
- **Sales Analytics** - By day, location, and product
- **Bork Integration** - Sync sales and master data from Bork APIs
- **Eitje Integration** - Sync hours and data from Eitje APIs
- **Notes Management** - Create, share, and organize notes
- **Workers & Teams** - Manage team members and assignments

## Important: Timezone & Cron Job Scheduler

### Timezone Configuration (CRITICAL)

**Set `TZ=Europe/Amsterdam` on ALL deployments.** The app is built around Amsterdam business hours. Scheduled tasks ALWAYS run in Amsterdam time, regardless of server location.

See [TIMEZONE_AND_DEPLOYMENT.md](./dev-docs/TIMEZONE_AND_DEPLOYMENT.md) for detailed setup by platform (Docker, DigitalOcean, Vercel, AWS, etc.).

### Cron Job Scheduler

Scheduled tasks run automatically via Nitro's built-in scheduler (if `TZ=Europe/Amsterdam` is set):
- **Gmail inbox sync (`inbox:gmail-sync`):** **4×** daily Amsterdam — **08:05**, **12:05**, **18:05**, **23:05**. This is **only** Gmail fetch + parse (not the Bork/Eitje REST API jobs). Purposes and `cron_hour` contract: see metadata in [`server/tasks/inbox/gmail-sync.ts`](./server/tasks/inbox/gmail-sync.ts).
- **Bork/Eitje API sync (Nitro):** **06:00** Amsterdam — morning maintenance (`integrations:bork-eitje-morning-maintenance`); **`daily-data`** runs at **01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 23:00** Amsterdam (`integrations:bork-eitje-daily`). Separate from Gmail.

For local development without setting TZ, you can manually trigger via UI "Sync Gmail" / "Run Now" buttons.

**Legacy external schedulers (GitHub Actions, Vercel Cron, cron-job.org) are NOT required** if `TZ=Europe/Amsterdam` is set.

## Environment Variables

Create `.env.local`:
```
PORT=8080
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=daily-ops-db
CRON_SECRET=your-cron-secret-for-external-scheduling
```

## Production

Build for production:
```bash
pnpm build
pnpm preview
```

## Deployment

- **Vercel**: Recommended. Includes Vercel Cron support.
- **Other Platforms**: Use GitHub Actions or external cron service for scheduling.

## Troubleshooting

### Cron Jobs Not Running?
- Check [CRON_SCHEDULER_SETUP.md](./dev-docs/CRON_SCHEDULER_SETUP.md)
- Ensure CRON_SECRET is set in production
- Verify external scheduler is configured and calling the endpoint

### Database Connection Issues?
- Check MONGODB_URI is correct
- If using MongoDB Atlas, verify IP whitelist
- For local dev, ensure MongoDB is running or SSH tunnel is active

### API Credentials Not Working?
- Test credentials in the UI (click "Test" button)
- Check Bork/Eitje base URLs are correct
- Verify API keys are current and have appropriate permissions


