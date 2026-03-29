# Daily Ops - Production Backend

**Nuxt 3 backend for Daily Operations management.**

## Active MongoDB Collections

- `notes`
- `unified_user`
- `menu_items`
- `menus`
- `menu_versions`
- `members`
- `teams`
- `locations`
- `api_credentials`
- `integration_cron_jobs`
- `eitje_raw_data`
- `eitje_time_registration_aggregation`
- `eitje_planning_registration_aggregation`
- `unified_location`
- `data_source_mappings`
- `test-eitje-contracts`

## Deployment

```bash
# Install dependencies
npm install --production

# Build
npm run build

# Start
npm start
```

## Environment Variables

Set in `.env` or DigitalOcean App Platform:
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB_NAME` - Database name
- `NODE_ENV` - Set to `production`
- `PORT` - Server port (default 3000)

## API Routes

All active API routes are in `nuxt-app/server/api/`

Only the collections listed above are used in production.

## Build Output

Production build output is in `.output/` directory.
