# V1, V2, V3 Dashboard Structure Refactored

## Overview
The Daily Ops dashboard now has three complete parallel versions (V1, V2, V3), each with its own independent aggregation pipeline, collections, and UI structure.

## Directory Structure

### V1: Legacy Dashboard (Original Implementation)
```
http://localhost:8080/daily-ops
├── /daily-ops/                 → Main dashboard (productivity)
├── /daily-ops/hours/           → Labor analytics (Day & Location, By Day, By Team, By Location)
├── /daily-ops/sales/           → Revenue analytics (Overview, By Hour, By Table, By Worker, By Product, By Guest Account, Day Breakdown)
├── /daily-ops/workers/         → Workers page
├── /daily-ops/insights/        → Insights page
└── Uses: V1 aggregation pipeline & collections
```

**Files Location**: `/pages/daily-ops/*`
**API Endpoint**: `/api/daily-ops/metrics/bundle` (or individual endpoints)
**Collections**: `bork_sales_aggregates`, `eitje_time_registration_aggregates`

---

### V2: Legacy Aggregation Version
```
http://localhost:8080/daily-ops-v2
├── /daily-ops-v2/              → Main dashboard (productivity V2)
├── /daily-ops-v2/hours/        → Labor analytics (Overview, By Day, By Team, By Worker, By Location)
├── /daily-ops-v2/sales/        → Revenue analytics (Overview, By Day, By Hour, By Product, By Worker)
└── Uses: V2 aggregation pipeline & collections
```

**Files Location**: `/pages/daily-ops-v2/*`
**API Endpoint**: `/api/daily-ops-v2/metrics/bundle`
**Collections**: `bork_sales_aggregates_v2`, `eitje_time_registration_aggregates_v2`

---

### V3: New Working-Day Snapshot Version (Current)
```
http://localhost:8080/daily-ops-v3
├── /daily-ops-v3/              → Main dashboard (productivity V3)
│   └── Uses V3 DashboardSnapshot aggregation
├── /daily-ops-v3/hours/        → Labor analytics (Overview, By Day, By Hour, By Team, By Contract)
│   └── Uses V3 LaborSnapshot aggregation
├── /daily-ops-v3/sales/        → Revenue analytics (Overview, By Day, By Hour, By Product, By Waiter)
│   └── Uses V3 SalesSnapshot aggregation
└── /daily-ops-v3/workforce/    → Teams & contracts overview
    └── Uses V3 LaborSnapshot aggregation
```

**Files Location**: `/pages/daily-ops-v3/*`
**API Endpoints**:
- `/api/v3/sales` → V3 Sales Snapshots
- `/api/v3/labor` → V3 Labor Snapshots
- `/api/v3/dashboard` → V3 Dashboard Snapshots (combines sales + labor)

**Collections**:
- `v3_sales_working_day_snapshots` (locationId, businessDate unique index)
- `v3_labor_working_day_snapshots` (locationId, businessDate unique index)
- `v3_dashboard_snapshots` (locationId, businessDate unique index)
- `v3_aggregation_metadata` (logs for debugging)

---

## V3 Architecture Highlights

### Key Features
- **Working-Day Snapshots**: Data updates continuously throughout the business day (06:00 UTC → 05:59:59 UTC next day)
- **Real-Time Sync**: Triggers V3 aggregation after each Bork and Eitje sync
- **Denormalized Views**: Dashboard snapshot combines sales + labor for quick queries
- **Business Day Logic**: Custom date boundaries via `getBusinessDate()` helpers in `server/utils/v3BusinessDay.ts`

### Data Flow
```
Raw Data (Bork/Eitje) → V3 Snapshot Services → MongoDB Collections → V3 API → UI
     ↓                        ↓                      ↓
 /api/bork/sync          v3SalesSnapshot         Indexed by
 /api/eitje/sync         v3LaborSnapshot         (locationId, businessDate)
                         v3DashboardSnapshot
```

### Sync Pipeline Integration
1. **After Bork Sync** (`borkSyncService.ts`):
   - Calls `runV3AggregationPipeline()` → Rebuilds V3 sales snapshots

2. **After Eitje Sync** (`eitjeSyncService.ts`):
   - Calls `runV3AggregationPipeline()` → Rebuilds V3 labor & dashboard snapshots

### UI/UX Consistency
- **V1, V2, V3 Main Dashboards**: All use `DailyOpsHomeDashboard.vue` component
  - V1: `metricsApiPath="/api/daily-ops/metrics/bundle"`
  - V2: `metricsApiPath="/api/daily-ops-v2/metrics/bundle"`
  - V3: `isV3="true"` (fetches from `/api/v3/dashboard` and transforms to MetricsBundle format)
- **Same UI/UX Layout**: All three versions display identical interface with version-specific data

---

## File Structure Summary

### Pages
```
pages/
├── daily-ops/
│   ├── index.vue (V1 dashboard)
│   ├── hours/
│   ├── sales/
│   ├── workers.vue
│   └── ... (other V1 pages)
├── daily-ops-v2/
│   ├── index.vue (V2 dashboard - "Productivity V2")
│   ├── hours/
│   │   └── index.vue
│   └── sales/
│       └── index.vue
└── daily-ops-v3/
    ├── index.vue (V3 dashboard - "Productivity V3")
    ├── hours/
    │   └── index.vue
    ├── sales/
    │   └── index.vue
    └── workforce/
        └── index.vue
```

### Services & Utils
```
server/
├── services/
│   ├── borkSyncService.ts (triggers V3 after sync)
│   ├── eitjeSyncService.ts (triggers V3 after sync)
│   └── v3Aggregation/
│       ├── v3SalesSnapshot.ts
│       ├── v3LaborSnapshot.ts
│       ├── v3DashboardSnapshot.ts
│       └── v3AggregationOrchestrator.ts
├── utils/
│   ├── v3BusinessDay.ts (business day helpers)
│   ├── v3Collections.ts (collection definitions & indexes)
│   └── v3Snapshots.ts (CRUD operations)
└── api/
    └── v3/
        ├── sales.get.ts
        ├── labor.get.ts
        ├── dashboard.get.ts
        └── aggregation/
            └── trigger.post.ts
```

### Types
```
types/
└── daily-ops-v3.ts
    ├── V3SalesWorkingDaySnapshot
    ├── V3LaborWorkingDaySnapshot
    ├── V3DailyOpsDashboardSnapshot
    └── Supporting types (HourlyBreakdownEntry, etc.)
```

### Components
```
components/
├── daily-ops/
│   └── DailyOpsHomeDashboard.vue (shared by V1, V2, V3)
└── AppSidebar.vue (navigation for all versions)
```

---

## Sidebar Navigation

The `AppSidebar.vue` now includes:

### Collapsed View Icons
- Dashboard (V1)
- Dashboard V2 (blue panel icon)
- Dashboard V3 (sparkles icon)

### Expanded View Menus
```
Navigation
├── Dashboard
├── Dashboard V2
├── Dashboard V3
├── Workers
├── Hours (V1)
├── Hours V2
├── Hours V3
├── Sales (V1)
├── Sales-V2
├── Sales-V3
├── Workforce V3
├── Settings
└── Inbox
```

---

## Testing the Structure

### V1 (Original - should work as before)
- Navigate to `http://localhost:8080/daily-ops`
- Check hours, sales, workers pages

### V2 (Existing aggregation)
- Navigate to `http://localhost:8080/daily-ops-v2`
- Check hours-v2 and sales-v2 sub-pages
- Verify data comes from `/api/daily-ops-v2/metrics/bundle`

### V3 (New working-day snapshots)
- Navigate to `http://localhost:8080/daily-ops-v3`
- Check hours-v3, sales-v3, workforce-v3 sub-pages
- Verify data updates continuously throughout the business day
- Check API: `GET /api/v3/dashboard?all=true` for all locations
- Check collections in MongoDB for `v3_*_snapshots`

---

## Next Steps

1. **Implement Child Pages**: Create detailed pages for Hours V2, Sales V2, and V3 sub-sections
2. **Data Validation**: Test that V3 snapshots update correctly after Bork/Eitje syncs
3. **Performance Testing**: Monitor snapshot generation time and index performance
4. **UI Polish**: Add charts, tables, and filtering to detail pages
5. **Documentation**: Update API documentation to reflect V3 endpoints

---

## Key Metadata

All V3 services include metadata headers with:
- `@registry-id`: Service identifier
- `@created`: Creation date
- `@last-modified`: Last modification date
- `@description`: Service purpose
- `@last-fix`: Latest fix/change with date
- `@exports-to`: Files that depend on this service (for sync tracking)

See individual service files for full details.
