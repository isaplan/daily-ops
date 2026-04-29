# V3 AGGREGATION QUICK START GUIDE

**Status: ✅ READY TO USE**

## Access V3 Dashboard

### Main Dashboard
```
http://localhost:8080/daily-ops/productivity-v3
```

Shows:
- Total Revenue, Labor Cost, Revenue/Hour, Labor Cost %
- Revenue breakdown (Drinks vs Food)
- Labor distribution
- Top products, teams, and contracts
- Last update timestamp

### Sales Analytics
```
http://localhost:8080/daily-ops/sales-v3
```

Shows:
- Sales overview with today's metrics
- Navigation to detail pages (by-day, by-hour, by-product, by-waiter)

### Labor Analytics
```
http://localhost:8080/daily-ops/hours-v3
```

Shows:
- Labor overview with today's metrics
- Teams breakdown table
- Navigation to detail pages (by-day, by-hour, by-team, by-contract)

### Workforce Overview
```
http://localhost:8080/daily-ops/workforce-v3
```

Shows:
- Active teams with hours and cost
- Contract type distribution
- Visual progress bars

## Test API Endpoints

### Query Sales Snapshot (All Locations Today)
```bash
curl "http://localhost:8080/api/v3/sales?all=true"
```

### Query Labor Snapshot (Specific Location)
```bash
curl "http://localhost:8080/api/v3/labor?locationId=<location_id>&businessDate=2026-04-28"
```

### Query Dashboard (All Locations Today)
```bash
curl "http://localhost:8080/api/v3/dashboard?all=true"
```

### Manual Trigger Aggregation
```bash
curl -X POST http://localhost:8080/api/v3/aggregation/trigger \
  -H "Content-Type: application/json" \
  -d '{"businessDate":"2026-04-28"}'
```

## How V3 Works

### Automatic Triggers
V3 aggregation runs automatically:

1. **After Bork Sync** (Daily)
   - Runs: After daily-data sync completes
   - Time: Usually ~06:00 UTC
   - Updates: Sales working day snapshots

2. **After Eitje Sync** (6x Daily)
   - Runs: 06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC
   - Updates: Labor working day snapshots
   - Also runs on historical-data syncs for backfill

### What Gets Stored
- **v3_sales_working_day_snapshots**: Revenue, transactions, products, waiters, tables
- **v3_labor_working_day_snapshots**: Hours, cost, teams, contracts
- **v3_daily_ops_dashboard_snapshots**: Combined dashboard view (optimized for display)
- **v3_aggregation_metadata**: Audit trail with timing and sync counts

### Business Day Definition
- **Start**: 06:00 UTC on calendar day A
- **End**: 05:59:59 UTC on calendar day A+1
- **Part 1**: 06:00-23:59 on day A (main service hours)
- **Part 2**: 00:00-05:59 on day A+1 (night service)

## Data Freshness

### Update Schedule (UTC)
```
06:00 ← Bork + Eitje daily sync → Sales + Labor updated
13:00 ← Eitje sync → Labor updated
16:00 ← Eitje sync → Labor updated
18:00 ← Eitje sync → Labor updated
20:00 ← Eitje sync → Labor updated
22:00 ← Eitje sync → Labor updated
```

### Dashboard Auto-Refresh
- Pages refresh every 15 minutes
- Manual refresh button available
- Last update timestamp shown

## Key Metrics

### Revenue Metrics
- **Total Revenue**: All revenue for business day
- **Transactions**: Count of transactions
- **Avg Transaction**: Revenue per transaction
- **Drinks %**: Percentage from drinks
- **By Category**: Revenue breakdown by product category
- **By Waiter**: Top performers
- **By Table**: Revenue per table

### Labor Metrics
- **Total Hours**: All labor hours for business day
- **Total Cost**: Payroll cost
- **Workers**: Distinct worker count
- **Cost/Hour**: Average cost per hour
- **By Team**: Hours and cost per team (with % breakdown)
- **By Contract**: Worker distribution by contract type
- **Productivity**: Revenue per labor hour, labor cost as % of revenue

## Debugging

### Check Aggregation Logs
Look in dev console or server logs for messages like:
```
[V3 Aggregation] Starting pipeline for business date: 2026-04-28
[V3] Processing location: Amsterdam
[V3] → Building sales snapshot...
[V3] ✓ Sales snapshot completed (1234ms, sync #5)
[V3] ✓ Dashboard snapshot completed (567ms, sync #5)
[V3 Aggregation] Pipeline completed
  → Success: 3/3
  → Total time: 8901ms
```

### Check MongoDB
```javascript
// See latest sales snapshot
db.v3_sales_working_day_snapshots.find().sort({lastUpdatedAt: -1}).limit(1)

// See aggregation history
db.v3_aggregation_metadata.find({businessDate: "2026-04-28"}).sort({recordedAt: -1})

// Count snapshots
db.v3_sales_working_day_snapshots.count()
db.v3_labor_working_day_snapshots.count()
db.v3_daily_ops_dashboard_snapshots.count()
```

### Verify Business Day Calculation
Data should be grouped by **business date**, not calendar date:
- Data from 05:59 UTC April 26 → businessDate = "2026-04-25"
- Data from 06:00 UTC April 26 → businessDate = "2026-04-26"
- Data from 23:00 UTC April 26 → businessDate = "2026-04-26"
- Data from 00:00 UTC April 27 → businessDate = "2026-04-26" (Part 2)

## Known Limitations

1. **Detail Pages Coming Soon**
   - by-day, by-hour, by-product pages not yet implemented
   - Index pages show overview only

2. **Real-Time Updates Not Yet Available**
   - Dashboard updates every 15 minutes
   - WebSocket/SSE support planned for future

3. **No Data Export Yet**
   - CSV/PDF export features planned
   - Currently query via API for programmatic access

4. **Limited Filtering**
   - Location selector works
   - Date filtering available on API only

## Support

For issues or questions:
1. Check `V3-AGGREGATION-IMPLEMENTATION-COMPLETE.md` for detailed architecture
2. Review `server/utils/v3ValidationChecklist.ts` for testing guide
3. Check server logs for aggregation errors
4. Verify MongoDB collections have data
5. Test manual trigger: `POST /api/v3/aggregation/trigger`

## Next Steps

- [ ] Test dashboard page: Visit `http://localhost:8080/daily-ops/productivity-v3`
- [ ] Try different locations using the location selector
- [ ] Check API endpoints return data
- [ ] Monitor logs during next sync to verify V3 is triggered
- [ ] Review database collections to confirm data is being stored
- [ ] Plan detail pages for deeper analysis (Phase 6)
