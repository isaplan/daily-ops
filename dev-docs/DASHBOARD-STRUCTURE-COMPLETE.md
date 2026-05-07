# Daily Ops Dashboard: Complete V1/V2/V3 Structure

## Executive Summary

The Daily Ops dashboard has been successfully reorganized into **three complete parallel versions** (V1, V2, V3), each with:
- ✅ Independent routes and page structures
- ✅ Separate MongoDB collections
- ✅ Distinct aggregation pipelines
- ✅ Unified UI/UX via shared components
- ✅ Clear navigation and organization

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Daily Ops Dashboard                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  V1 (Legacy)          V2 (Enhanced)          V3 (New) ⭐        │
│  ────────────────────────────────────────────────────────────    │
│                                                                   │
│  /daily-ops           /daily-ops-v2          /daily-ops-v3      │
│   ├── /hours           ├── /hours             ├── /hours        │
│   ├── /sales           ├── /sales             ├── /sales        │
│   ├── /workers         └── (UI stub)          ├── /workforce    │
│   └── (V1 features)                          └── (Real-time)    │
│                                                                   │
│  Collections:         Collections:           Collections:       │
│  • bork_sales_*       • bork_sales_*_v2      • v3_sales_*       │
│  • eitje_hours_*      • eitje_hours_*_v2     • v3_labor_*       │
│                                               • v3_dashboard_*  │
│                                                                   │
│  API: /api/daily-ops/ API: /api/daily-ops-v2 API: /api/v3/     │
│  Update: As needed    Update: As needed       Update: Real-time │
└─────────────────────────────────────────────────────────────────┘
```

---

## Route Map

### V1 (Original - /daily-ops)
```
http://localhost:8080/daily-ops
├── /                          → Main Dashboard (Productivity)
├── /hours                     → Labor Analytics (Day & Location)
│   ├── /by-day               → Daily breakdown
│   ├── /by-team              → Team breakdown
│   └── /by-location          → Location comparison
├── /sales                     → Revenue Analytics
│   ├── /by-hour              → Hourly breakdown
│   ├── /by-table             → Table performance
│   ├── /by-worker            → Waiter performance
│   ├── /by-product           → Product analysis
│   ├── /by-guest-account     → Guest account tracking
│   └── /day-breakdown        → Daily summary
├── /workers                  → Workers page
├── /revenue                  → Revenue summary
├── /insights                 → Analytics insights
├── /products                 → Product catalog
├── /workload                 → Workload analysis
└── /settings                 → Configuration

Data Source: V1 Collections (bork_sales_aggregates, eitje_time_registration_aggregates)
API: /api/daily-ops/metrics/bundle
```

### V2 (Enhanced - /daily-ops-v2)
```
http://localhost:8080/daily-ops-v2
├── /                          → Main Dashboard (Productivity V2)
│   └── Uses: /api/daily-ops-v2/metrics/bundle
├── /hours                     → Labor Analytics V2 (Overview)
│   ├── /by-day               → Daily labor breakdown
│   ├── /by-team              → Team hours
│   ├── /by-worker            → Worker performance
│   └── /by-location          → Location comparison
└── /sales                     → Revenue Analytics V2 (Overview)
    ├── /by-day               → Daily revenue breakdown
    ├── /by-hour              → Hourly revenue breakdown
    ├── /by-product           → Product analysis
    └── /by-worker            → Worker sales performance

Data Source: V2 Collections (bork_sales_aggregates_v2, eitje_time_registration_aggregates_v2)
API: /api/daily-ops-v2/metrics/bundle
```

### V3 (New Working-Day Snapshots - /daily-ops-v3) ⭐
```
http://localhost:8080/daily-ops-v3
├── /                          → Main Dashboard (Productivity V3)
│   └── Uses: /api/v3/dashboard (working-day snapshots)
├── /hours                     → Labor Analytics V3
│   ├── /                      → Overview (quick stats)
│   ├── /by-day               → Daily labor breakdown
│   ├── /by-hour              → Hourly labor breakdown
│   ├── /by-team              → Team analysis
│   └── /by-contract          → Contract type breakdown
├── /sales                     → Revenue Analytics V3
│   ├── /                      → Overview (quick stats)
│   ├── /by-day               → Daily revenue breakdown
│   ├── /by-hour              → Hourly revenue breakdown
│   ├── /by-product           → Product analysis
│   └── /by-waiter            → Waiter performance
└── /workforce                 → Teams & Contracts Overview

Data Source: V3 Collections (v3_sales_working_day_snapshots, v3_labor_working_day_snapshots, v3_dashboard_snapshots)
APIs:
  • /api/v3/sales (GET, POST, DELETE, RANGE)
  • /api/v3/labor (GET, POST, DELETE, RANGE)
  • /api/v3/dashboard (GET, single + all locations)
  • /api/v3/aggregation/trigger (POST for manual triggering)

Update Strategy: Continuous throughout business day (06:00 UTC → 05:59:59 UTC next day)
Triggers: After each Bork sync and Eitje sync
```

---

## File Structure

### Pages Directory
```
pages/
├── daily-ops/
│   ├── index.vue              → V1 main dashboard
│   ├── productivity.vue       → Alias for V1 dashboard
│   ├── hours/
│   │   ├── index.vue          → V1 hours overview
│   │   ├── by-day.vue
│   │   ├── by-team.vue
│   │   ├── by-worker.vue
│   │   └── by-location.vue
│   ├── sales/
│   │   ├── index.vue          → V1 sales overview
│   │   ├── by-hour.vue
│   │   ├── by-table.vue
│   │   ├── by-worker.vue
│   │   ├── by-product.vue
│   │   ├── by-guest-account.vue
│   │   ├── day-breakdown.vue
│   │   └── [other V1 pages]
│   ├── workers.vue
│   ├── revenue.vue
│   ├── insights.vue
│   ├── products.vue
│   ├── workload.vue
│   ├── inbox/
│   └── settings/
│
├── daily-ops-v2/
│   ├── index.vue              → V2 main dashboard (Productivity V2)
│   ├── hours/
│   │   ├── index.vue          → V2 hours overview
│   │   ├── by-day.vue         → Stub (future implementation)
│   │   ├── by-team.vue        → Stub (future implementation)
│   │   ├── by-worker.vue      → Stub (future implementation)
│   │   └── by-location.vue    → Stub (future implementation)
│   └── sales/
│       ├── index.vue          → V2 sales overview
│       ├── by-day.vue         → Stub (future implementation)
│       ├── by-hour.vue        → Stub (future implementation)
│       ├── by-product.vue     → Stub (future implementation)
│       └── by-worker.vue      → Stub (future implementation)
│
└── daily-ops-v3/
    ├── index.vue              → V3 main dashboard (Productivity V3)
    ├── hours/
    │   ├── index.vue          → V3 hours overview (with quick stats & tables)
    │   ├── by-day.vue         → Stub (future implementation)
    │   ├── by-hour.vue        → Stub (future implementation)
    │   ├── by-team.vue        → Stub (future implementation)
    │   └── by-contract.vue    → Stub (future implementation)
    ├── sales/
    │   ├── index.vue          → V3 sales overview (with quick stats)
    │   ├── by-day.vue         → Stub (future implementation)
    │   ├── by-hour.vue        → Stub (future implementation)
    │   ├── by-product.vue     → Stub (future implementation)
    │   └── by-waiter.vue      → Stub (future implementation)
    └── workforce/
        └── index.vue          → V3 workforce overview

Legend:
✅ = Implemented with data
🔄 = Implemented as stub (shows navigation, data structure ready)
```

### Backend Services
```
server/
├── api/
│   ├── daily-ops/
│   │   └── metrics/
│   │       └── bundle.get.ts  → V1 metrics endpoint
│   ├── daily-ops-v2/
│   │   └── metrics/
│   │       └── bundle.get.ts  → V2 metrics endpoint
│   └── v3/
│       ├── sales.get.ts       → V3 sales snapshots
│       ├── labor.get.ts       → V3 labor snapshots
│       ├── dashboard.get.ts   → V3 dashboard snapshots (combines sales + labor)
│       └── aggregation/
│           └── trigger.post.ts → Manual V3 aggregation trigger
│
├── services/
│   ├── borkSyncService.ts     → Bork API sync + V3 trigger
│   ├── eitjeSyncService.ts    → Eitje API sync + V3 trigger
│   └── v3Aggregation/
│       ├── v3SalesSnapshot.ts → V3 sales snapshot builder
│       ├── v3LaborSnapshot.ts → V3 labor snapshot builder
│       ├── v3DashboardSnapshot.ts → V3 dashboard snapshot combiner
│       └── v3AggregationOrchestrator.ts → Main orchestrator
│
├── utils/
│   ├── db.ts                  → Database connection (getDb())
│   ├── v3BusinessDay.ts       → Business day helpers (06:00 UTC start)
│   ├── v3Collections.ts       → Collection definitions & indexes
│   └── v3Snapshots.ts         → CRUD operations for V3 snapshots
│
└── middleware/
    └── [auth, logging, etc.]
```

### Components
```
components/
├── daily-ops/
│   ├── DailyOpsHomeDashboard.vue    → Shared by V1, V2, V3 main dashboards
│   ├── DailyOpsDashboardShell.vue   → Layout wrapper
│   └── [other dashboard components]
├── AppSidebar.vue                   → Navigation for all versions
└── [other UI components]
```

### Types
```
types/
├── daily-ops.ts                     → V1 types
├── daily-ops-v2.ts                 → V2 types
└── daily-ops-v3.ts                 → V3 types (V3SalesWorkingDaySnapshot, etc.)
```

---

## Database Collections

### V1 Collections
- `bork_sales_aggregates` - Sales aggregated data
- `eitje_time_registration_aggregates` - Labor/time registration data

### V2 Collections
- `bork_sales_aggregates_v2` - V2 sales aggregates
- `eitje_time_registration_aggregates_v2` - V2 labor aggregates

### V3 Collections (NEW)
- `v3_sales_working_day_snapshots`
  - Index: `(locationId, businessDate)` unique
  - Data: Hourly breakdown, revenue by category/waiter/table/payment method
  
- `v3_labor_working_day_snapshots`
  - Index: `(locationId, businessDate)` unique
  - Data: Hourly breakdown, teams summary, contract type breakdown
  
- `v3_dashboard_snapshots`
  - Index: `(locationId, businessDate)` unique
  - Data: Combined sales + labor metrics (productivity, cost %), top products/teams/contracts
  
- `v3_aggregation_metadata`
  - Logs for debugging aggregation pipeline execution

---

## Sidebar Navigation

### Expanded View (Full Names)
```
Navigation
├── 📊 Dashboard                          → /daily-ops
├── 📋 Dashboard V2                       → /daily-ops-v2
├── ⭐ Dashboard V3                       → /daily-ops-v3
├── 👥 Workers                            → /daily-ops/workers
├── ⏱️  Hours                              → /daily-ops/hours [collapsible]
│   ├── Day & Location                   → /daily-ops/hours
│   ├── By Day                           → /daily-ops/hours/by-day
│   ├── By Team                          → /daily-ops/hours/by-team
│   └── By Location                      → /daily-ops/hours/by-location
├── ⏱️  Hours V2                           → /daily-ops-v2/hours [collapsible]
│   ├── Overview                         → /daily-ops-v2/hours
│   ├── By Day                           → /daily-ops-v2/hours/by-day
│   ├── By Team                          → /daily-ops-v2/hours/by-team
│   ├── By Worker                        → /daily-ops-v2/hours/by-worker
│   └── By Location                      → /daily-ops-v2/hours/by-location
├── ⚡ Hours V3                           → /daily-ops-v3/hours [collapsible]
│   ├── Overview                         → /daily-ops-v3/hours
│   ├── By Day                           → /daily-ops-v3/hours/by-day
│   ├── By Hour                          → /daily-ops-v3/hours/by-hour
│   ├── By Team                          → /daily-ops-v3/hours/by-team
│   └── By Contract                      → /daily-ops-v3/hours/by-contract
├── 🛒 Sales                              → /daily-ops/sales [collapsible]
│   ├── Overview                         → /daily-ops/sales
│   ├── By Hour                          → /daily-ops/sales/by-hour
│   ├── By Table                         → /daily-ops/sales/by-table
│   ├── By Worker                        → /daily-ops/sales/by-worker
│   ├── By Product                       → /daily-ops/sales/by-product
│   ├── By Guest Account                 → /daily-ops/sales/by-guest-account
│   └── Day Breakdown                    → /daily-ops/sales/day-breakdown
├── 📈 Sales-V2                           → /daily-ops-v2/sales [collapsible]
│   ├── Overview                         → /daily-ops-v2/sales
│   ├── By Day                           → /daily-ops-v2/sales/by-day
│   ├── By Hour                          → /daily-ops-v2/sales/by-hour
│   ├── By Product                       → /daily-ops-v2/sales/by-product
│   └── By Worker                        → /daily-ops-v2/sales/by-worker
├── 📈 Sales-V3                           → /daily-ops-v3/sales [collapsible]
│   ├── Overview                         → /daily-ops-v3/sales
│   ├── By Day                           → /daily-ops-v3/sales/by-day
│   ├── By Hour                          → /daily-ops-v3/sales/by-hour
│   ├── By Product                       → /daily-ops-v3/sales/by-product
│   └── By Waiter                        → /daily-ops-v3/sales/by-waiter
├── 👥 Workforce V3                       → /daily-ops-v3/workforce
├── ⚙️  Settings                          → /daily-ops/settings [collapsible]
│   ├── Bork API                         → /daily-ops/settings/bork-api
│   └── Eitje API                        → /daily-ops/settings/eitje-api
└── 📬 Inbox                              → /daily-ops/inbox [collapsible]
    ├── All                              → /daily-ops/inbox
    ├── Emails                           → /daily-ops/inbox/emails
    ├── Bork                             → /daily-ops/inbox/bork
    ├── Eitje                            → /daily-ops/inbox/eitje
    ├── Power BI                         → /daily-ops/inbox/power-bi
    └── Other                            → /daily-ops/inbox/other
```

### Collapsed View (Icons Only)
- 📊 Dashboard (V1)
- 📋 Dashboard V2
- ⭐ Dashboard V3
- 👥 Workers
- ⏱️  Hours (V1)
- ⏱️  Hours V2
- ⚡ Hours V3
- 🛒 Sales (V1)
- 📈 Sales-V2
- 📈 Sales-V3
- 👥 Workforce V3
- ⚙️  Settings
- 📬 Inbox

---

## Data Flow & Sync Pipeline

### V1 Data Flow (Legacy)
```
Bork API → Raw bork_* collections → borkSyncService → bork_sales_aggregates
Eitje API → Raw eitje_* collections → eitjeSyncService → eitje_time_registration_aggregates
     ↓                                     ↓
UI fetches from /api/daily-ops/metrics/bundle
```

### V2 Data Flow (Legacy)
```
Bork API → Raw bork_* collections → borkSyncService → bork_sales_aggregates_v2
Eitje API → Raw eitje_* collections → eitjeSyncService → eitje_time_registration_aggregates_v2
     ↓                                     ↓
UI fetches from /api/daily-ops-v2/metrics/bundle
```

### V3 Data Flow (New - Real-Time) ⭐
```
Bork API → Raw bork_* → borkSyncService → runV3AggregationPipeline()
Eitje API → Raw eitje_* → eitjeSyncService → runV3AggregationPipeline()
                            ↓
                    v3AggregationOrchestrator
                    ├── v3SalesSnapshot builder
                    ├── v3LaborSnapshot builder
                    └── v3DashboardSnapshot combiner
                    ↓
v3_sales_working_day_snapshots ← (locationId, businessDate unique)
v3_labor_working_day_snapshots ← (locationId, businessDate unique)
v3_dashboard_snapshots ← (locationId, businessDate unique)
v3_aggregation_metadata ← (logging/debugging)
     ↓
UI fetches from:
- /api/v3/sales (for detailed sales)
- /api/v3/labor (for detailed labor)
- /api/v3/dashboard (for combined dashboard view)
```

---

## Key Features

### V3 Highlights ⭐
1. **Working-Day Snapshots**: Data updates continuously throughout business day (06:00 UTC start)
2. **Real-Time Sync**: Triggers immediately after Bork or Eitje data sync
3. **Denormalized Views**: Dashboard snapshot combines sales + labor for quick queries
4. **Business Day Logic**: Custom date boundaries using `getBusinessDate()` helpers
5. **Performance**: Indexed collections for fast range queries
6. **Metadata Tracking**: All services include detailed metadata headers for debugging

### Shared Components (All Versions)
- `DailyOpsHomeDashboard.vue`: Main dashboard UI/UX (all three versions use this!)
  - Receives different `metricsApiPath` or `isV3` prop
  - Displays same layout with version-specific data
  
---

## Testing Guide

### Test V1 (Should work as before)
```
✅ /daily-ops                    → Main dashboard (productivity)
✅ /daily-ops/hours             → Labor overview
✅ /daily-ops/hours/by-day      → Daily labor
✅ /daily-ops/sales             → Revenue overview
✅ /daily-ops/sales/by-hour     → Hourly revenue
✅ /daily-ops/workers           → Workers page
```

### Test V2 (New structure)
```
✅ /daily-ops-v2                → Main dashboard (Productivity V2)
✅ /daily-ops-v2/hours          → V2 hours overview
✅ /daily-ops-v2/hours/by-day   → V2 daily labor
✅ /daily-ops-v2/sales          → V2 sales overview
✅ /daily-ops-v2/sales/by-day   → V2 daily revenue
```

### Test V3 (New real-time)
```
✅ /daily-ops-v3                → Main dashboard (Productivity V3)
✅ /daily-ops-v3/hours          → V3 hours overview with quick stats
✅ /daily-ops-v3/sales          → V3 sales overview with quick stats
✅ /daily-ops-v3/workforce      → V3 teams & contracts overview
```

### Test API Endpoints
```
GET /api/v3/sales?all=true              → All V3 sales snapshots (all locations)
GET /api/v3/sales?locationId=...&businessDate=... → Single location snapshot
GET /api/v3/labor?all=true              → All V3 labor snapshots (all locations)
GET /api/v3/dashboard?all=true          → All V3 dashboard snapshots (combined)
POST /api/v3/aggregation/trigger        → Manual trigger for V3 aggregation pipeline
```

### Test Sidebar Navigation
```
✅ All three dashboards appear in sidebar
✅ V2 Hours and Sales menus open/close correctly
✅ V3 Hours and Sales menus open/close correctly
✅ Active states highlight correctly for each version
✅ All sub-menu items navigate to correct routes
```

---

## API Response Format Examples

### V3 Sales Snapshot Response
```json
{
  "success": true,
  "data": [{
    "_id": "ObjectId(...)",
    "locationId": "ObjectId(...)",
    "businessDate": "2026-04-28",
    "createdAt": "2026-04-28T08:00:00.000Z",
    "updatedAt": "2026-04-28T21:30:00.000Z",
    "totalRevenue": 1250.50,
    "totalTransactions": 45,
    "hourlyBreakdown": [
      { "hour": 0, "revenue": 0, "transactions": 0 },
      { "hour": 1, "revenue": 0, "transactions": 0 },
      // ... 06:00 UTC onwards has data
      { "hour": 6, "revenue": 125.50, "transactions": 5 },
      // ... more hours
    ],
    "revenueByCategory": {
      "drinks": { "revenue": 312.50, "pct": 25 },
      "food": { "revenue": 938.00, "pct": 75 }
    },
    "drinksRevenuePercent": 25,
    "topProducts": [
      { "productId": "...", "productName": "Coffee", "revenue": 85.50, "quantity": 25 },
      // ... more products
    ]
  }],
  "businessDate": "2026-04-28",
  "count": 1
}
```

---

## Next Steps

### Phase: Detail Page Implementation
- [ ] Implement V2 hours detail pages (By Day, By Team, By Worker, By Location)
- [ ] Implement V2 sales detail pages (By Day, By Hour, By Product, By Worker)
- [ ] Implement V3 hours detail pages (By Day, By Hour, By Team, By Contract)
- [ ] Implement V3 sales detail pages (By Day, By Hour, By Product, By Waiter)
- [ ] Add charts and visualizations
- [ ] Add filtering and date range selection

### Phase: Data Validation
- [ ] Verify V3 snapshots update after each Bork sync
- [ ] Verify V3 snapshots update after each Eitje sync
- [ ] Test business day boundary (05:59:59 → 06:00:00 UTC transition)
- [ ] Monitor snapshot generation performance
- [ ] Validate index performance for range queries

### Phase: Optimization
- [ ] Add caching for frequently accessed snapshots
- [ ] Optimize database indexes
- [ ] Add aggregation metadata dashboard
- [ ] Implement snapshot retention policy (cleanup old data)

---

## Commands & Useful References

### Check V3 Collections in MongoDB
```javascript
// List all V3 snapshots for today
db.v3_sales_working_day_snapshots.find({ businessDate: "2026-04-28" })
db.v3_labor_working_day_snapshots.find({ businessDate: "2026-04-28" })
db.v3_dashboard_snapshots.find({ businessDate: "2026-04-28" })

// List aggregation metadata (for debugging)
db.v3_aggregation_metadata.find().sort({ createdAt: -1 }).limit(10)
```

### Manual V3 Aggregation Trigger
```bash
curl -X POST http://localhost:8080/api/v3/aggregation/trigger \
  -H "Content-Type: application/json" \
  -d '{ "businessDate": "2026-04-28" }'
```

### Build & Development
```bash
pnpm dev         # Start dev server
pnpm build       # Build for production
pnpm exec nuxi typecheck  # Type check
```

---

## Files Modified/Created in This Restructure

### Created
- `/pages/daily-ops-v3/index.vue` - V3 main dashboard
- `/pages/daily-ops-v3/hours/index.vue` - V3 hours overview
- `/pages/daily-ops-v3/sales/index.vue` - V3 sales overview
- `/pages/daily-ops-v3/workforce/index.vue` - V3 workforce overview
- `/pages/daily-ops-v2/hours/index.vue` - V2 hours overview
- `/pages/daily-ops-v2/sales/index.vue` - V2 sales overview
- `V3-STRUCTURE-REFACTORED.md` - Architecture documentation
- `DASHBOARD-STRUCTURE-COMPLETE.md` - This file

### Modified
- `/components/AppSidebar.vue` - Added V2 and updated V3 navigation
- `/pages/daily-ops-v2/index.vue` - Updated to use consistent V2 dashboard label

### Deleted
- `/pages/daily-ops/productivity-v3.vue`
- `/pages/daily-ops/hours-v3/` directory
- `/pages/daily-ops/sales-v3/` directory
- `/pages/daily-ops/workforce-v3/` directory

---

## Conclusion

The Daily Ops dashboard now has a **clean, scalable, three-tier architecture** where:

✅ **V1** provides the original functionality
✅ **V2** offers an enhanced aggregation approach
✅ **V3** delivers real-time working-day snapshots

Each version is completely independent yet shares the same UI/UX patterns for consistency. The structure is clear, organized, and ready for further development and optimization.

---

*Last Updated: 2026-04-28*
*Status: Complete*
