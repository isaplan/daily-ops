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

## Important: Cron Job Scheduler

The Bork and Eitje cron jobs require an **external scheduler** to run automatically. See [CRON_SCHEDULER_SETUP.md](./dev-docs/CRON_SCHEDULER_SETUP.md) for setup instructions.

**TL;DR**: You must set up one of:
- Vercel Cron (if deployed to Vercel)
- GitHub Actions
- External cron service (cron-job.org, EasyCron, etc.)

Without a scheduler, cron jobs don't run automatically. You can still trigger them manually via the UI "Run Now" button.

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


