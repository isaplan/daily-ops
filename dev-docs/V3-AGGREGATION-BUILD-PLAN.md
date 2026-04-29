# V3 Aggregation Architecture Build Plan

## 🎯 Vision: Working Day Snapshot System with Hourly Granularity

Build a **V3 aggregation pipeline** that creates evolving **working day snapshots** (like V2) but optimized for Nuxt/Nitro, with:
- Single document per location per working day
- Updated 6x daily via cron (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)
- Hour-by-hour breakdown for charts
- Immutable history after 05:59 UTC
- Part 1 (06:00-23:59) + Part 2 (00:00-05:59) tracking

---

## 📊 V2 vs V3 Comparison

### V2 (Next.js) Architecture
```
RAW DATA
├─ bork_raw_data (fetch daily)
└─ eitje_raw_data (fetch daily)

DAILY AGGREGATION (immutable after midnight)
├─ bork_aggregated
└─ eitje_aggregated

WORKING DAY SNAPSHOT (evolves throughout day)
└─ sales_working_day_snapshots (updates ~24x daily)
   ├─ Part 1 totals (06:00-23:59)
   ├─ Part 2 totals (00:00-05:59)
   ├─ Combined totals
   └─ hourlyBreakdown[24 hours with cumulative data]

DASHBOARD AGGREGATION
└─ daily_ops_dashboard_aggregated (denormalized, read-only)
   ├─ Revenue metrics
   ├─ Labor metrics
   ├─ Product metrics
   └─ Productivity metrics
```

### V3 (Nuxt) Architecture (PROPOSED)
```
RAW DATA
├─ bork_raw_data (fetch today only via cron)
└─ eitje_raw_data (fetch today only via cron)

V3 HOURLY AGGREGATION (updates 6x daily)
├─ v3_sales_working_day_snapshots (one per location)
│  ├─ Part 1 totals (06:00-23:59)
│  ├─ Part 2 totals (00:00-05:59)
│  ├─ Combined totals
│  ├─ hourlyBreakdown[24 hours]
│  └─ Metadata: workingDayStarted, workingDayFinished
│
├─ v3_labor_working_day_snapshots (one per location)
│  ├─ Teams summary (cumulative to this hour)
│  ├─ Contracts summary (cumulative to this hour)
│  ├─ Productivity metrics
│  └─ hourlyBreakdown[24 hours]
│
└─ v3_daily_ops_dashboard_snapshot (one per location)
   ├─ Revenue (from sales snapshot)
   ├─ Labor (from labor snapshot)
   ├─ Productivity (computed metrics)
   ├─ Top products
   ├─ Top teams
   └─ Current hour timestamp

HISTORICAL AGGREGATIONS (immutable, for date ranges)
├─ eitje_time_registration_aggregation (per day, final after 06:00)
└─ bork_sales_by_cron (per day, final after 06:00)
```

---

## 🏗️ V3 Collections Schema

### 1. `v3_sales_working_day_snapshots`
**Purpose:** Single evolving document per location per working day
**Updated:** 6x daily during cron runs (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)

```typescript
{
  _id: ObjectId,
  locationId: ObjectId,
  locationName: string,
  
  // Working day definition (06:00 Mon → 05:59 Tue)
  businessDate: string,           // "2026-04-26" (06:00 start date)
  workingDayStart: Date,          // 2026-04-26T06:00:00Z
  workingDayEnd: Date,            // 2026-04-27T05:59:59Z
  
  // Status flags
  workingDayStarted: boolean,     // true when Part 1 data arrives
  workingDayFinished: boolean,    // true at 05:59 or next day starts
  
  // PART 1 (06:00-23:59 on businessDate)
  part1: {
    date: Date,                   // 2026-04-26T00:00:00Z (ISO date)
    totalRevenue: number,
    totalRevenueExVat: number,
    totalRevenueIncVat: number,
    totalVat: number,
    totalQuantity: number,
    totalTransactions: number,
    revenueByCategory: Record<string, number>,
    drinksRevenue: number,
    foodRevenue: number,
  },
  
  // PART 2 (00:00-05:59 next day)
  part2: {
    date: Date,                   // 2026-04-27T00:00:00Z (ISO date)
    totalRevenue?: number,
    totalRevenueExVat?: number,
    totalRevenueIncVat?: number,
    totalVat?: number,
    totalQuantity?: number,
    totalTransactions?: number,
    revenueByCategory?: Record<string, number>,
    drinksRevenue?: number,
    foodRevenue?: number,
  },
  
  // COMBINED TOTALS (Part 1 + Part 2, what dashboard shows)
  totalRevenue: number,
  totalRevenueExVat: number,
  totalRevenueIncVat: number,
  totalVat: number,
  totalQuantity: number,
  totalTransactions: number,
  avgRevenuePerTransaction: number,
  
  // HOURLY BREAKDOWN (cumulative totals at each hour)
  hourlyBreakdown: Array<{
    hour: number,                 // 0-23 (UTC)
    isoDate: Date,                // Which ISO date this hour belongs to (Part 1 or 2)
    totalRevenue: number,         // Cumulative up to this hour
    totalRevenueExVat: number,
    totalRevenueIncVat: number,
    totalQuantity: number,
    totalTransactions: number,
    revenueByCategory?: Record<string, number>,
  }>,
  
  // BREAKDOWNS
  revenueByCategory: Record<string, number>,
  byPaymentMethod: Array<{ method: string, revenue: number, transactions: number }>,
  byWaiter: Array<{ name: string, revenue: number, transactions: number }>,
  byTable: Array<{ tableNumber: string, revenue: number, transactions: number }>,
  
  // METADATA
  lastUpdatedAt: Date,            // When this snapshot was last updated (cron run time)
  syncCount: number,              // How many times aggregated today
  version: 3,                     // Schema version
}
```

### 2. `v3_labor_working_day_snapshots`
**Purpose:** Single evolving document per location per working day
**Updated:** 6x daily during cron runs

```typescript
{
  _id: ObjectId,
  locationId: ObjectId,
  locationName: string,
  
  // Working day definition
  businessDate: string,           // "2026-04-26"
  workingDayStart: Date,          // 2026-04-26T06:00:00Z
  workingDayEnd: Date,            // 2026-04-27T05:59:59Z
  
  // Status flags
  workingDayStarted: boolean,
  workingDayFinished: boolean,
  
  // COMBINED TOTALS (from today's eitje_time_registration_aggregation)
  totalHours: number,
  totalCost: number,
  totalWorkers: number,           // Distinct worker count
  costPerHour: number,
  revenuePerHour?: number,        // From sales_working_day_snapshot
  
  // TEAMS SUMMARY (aggregated per team)
  teams: Array<{
    teamId: string,
    teamName: string,
    workerCount: number,
    totalHours: number,
    totalCost: number,
    pctOfTotalHours: number,
  }>,
  
  // CONTRACTS SUMMARY (aggregated per contract type)
  contracts: Array<{
    contractType: string,
    workerCount: number,
    totalHours: number,
    totalCost: number,
    pctOfTotalHours: number,
  }>,
  
  // PRODUCTIVITY METRICS
  productivity: {
    revenuePerLaborHour?: number,  // totalRevenue / totalHours
    laborCostPctOfRevenue?: number,// totalCost / totalRevenue
    bestHour?: number,             // Hour with highest revenue/cost ratio
    worstHour?: number,
  },
  
  // HOURLY BREAKDOWN (cumulative)
  hourlyBreakdown: Array<{
    hour: number,                 // 0-23
    totalHours: number,           // Cumulative
    totalCost: number,            // Cumulative
    totalWorkers: number,
    byTeam?: Array<{
      teamName: string,
      hours: number,
      cost: number,
    }>,
  }>,
  
  // METADATA
  lastUpdatedAt: Date,
  syncCount: number,
  version: 3,
}
```

### 3. `v3_daily_ops_dashboard_snapshot`
**Purpose:** Denormalized read-only snapshot for fast dashboard queries
**Updated:** 6x daily, combines sales + labor + computed metrics

```typescript
{
  _id: ObjectId,
  locationId: ObjectId,
  locationName: string,
  
  // Working day reference
  businessDate: string,
  workingDayFinished: boolean,
  currentHour?: number,           // UTC hour when last updated
  
  // REVENUE METRICS (from v3_sales_working_day_snapshots)
  revenue: {
    totalRevenue: number,
    totalRevenueExVat: number,
    totalTransactions: number,
    avgTransactionValue: number,
    drinksRevenue: number,
    foodRevenue: number,
    drinksRevenuePercent: number,
  },
  
  // LABOR METRICS (from v3_labor_working_day_snapshots)
  labor: {
    totalHours: number,
    totalCost: number,
    totalWorkers: number,
    costPerHour: number,
    revenuePerLaborHour?: number,
    laborCostPctOfRevenue?: number,
  },
  
  // SUMMARY CARDS
  cards: {
    totalRevenue: number,
    totalLaborCost: number,
    laborCostPctOfRevenue?: number,
    revenuePerLaborHour?: number,
  },
  
  // PRODUCTIVITY
  productivity: {
    revenuePerLaborHour?: number,
    laborCostPctOfRevenue?: number,
    bestHour?: { hour: number, efficiency: number },
    worstHour?: { hour: number, efficiency: number },
  },
  
  // TOP ITEMS
  topProducts: Array<{ name: string, quantity: number, revenue: number }>,
  topTeams: Array<{ teamName: string, workerCount: number, totalHours: number, totalCost: number }>,
  topContracts: Array<{ contractType: string, workerCount: number, totalHours: number }>,
  
  // HOURLY DATA FOR CHARTS
  hourlyRevenue: Array<{ hour: number, revenue: number, transactions: number }>,
  hourlyLabor: Array<{ hour: number, hours: number, cost: number, workers: number }>,
  
  // METADATA
  lastUpdatedAt: Date,
  version: 3,
}
```

---

## 🔄 Data Flow & Aggregation Pipeline

### CRON SCHEDULE (6x daily)
```
06:00 UTC → Run daily-data sync + aggregate
13:00 UTC → Run daily-data sync + aggregate
16:00 UTC → Run daily-data sync + aggregate
18:00 UTC → Run daily-data sync + aggregate
20:00 UTC → Run daily-data sync + aggregate
22:00 UTC → Run daily-data sync + aggregate
```

### EACH CRON RUN (pseudo-code)

```typescript
async function v3CronAggregation() {
  // Step 1: Fetch raw data for TODAY
  const borkData = await fetchBorkRawData(todayDate)           // TODAY only
  const eitjeData = await fetchEitjeRawData(todayDate)         // TODAY only
  
  // Step 2: Store in raw data collections
  await upsertBorkRawData(borkData)
  await upsertEitjeRawData(eitjeData)
  
  // Step 3: Rebuild daily aggregations (historical, final)
  await rebuildBorkSalesAggregation(todayDate, todayDate)      // Today's daily aggregation
  await rebuildEitjeTimeRegistrationAggregation(todayDate, todayDate)
  
  // Step 4: Build/update TODAY's working day snapshots (6x updated)
  for (const location of allLocations) {
    // SALES SNAPSHOT
    await updateSalesWorkingDaySnapshot(location, todayDate)
    
    // LABOR SNAPSHOT
    await updateLaborWorkingDaySnapshot(location, todayDate)
    
    // DASHBOARD SNAPSHOT (combines both)
    await updateDailyOpsDashboardSnapshot(location, todayDate)
  }
  
  // Step 5: Check if working day finished (at 05:59 UTC)
  if (isWorkingDayFinished(currentUTC)) {
    for (const location of allLocations) {
      await markSnapshotsAsFinished(location, todayDate)  // Set workingDayFinished = true
    }
  }
}
```

---

## 📁 V3 File Structure

```
server/
├── services/
│   ├── v3Aggregation/                    # NEW: V3 aggregation orchestrator
│   │   ├── v3AggregationOrchestrator.ts  # Main cron handler
│   │   ├── v3SalesSnapshot.ts            # Sales snapshot logic
│   │   ├── v3LaborSnapshot.ts            # Labor snapshot logic
│   │   └── v3DashboardSnapshot.ts        # Dashboard snapshot logic
│   │
│   ├── borkRebuildAggregationService.ts  # Keep existing (unchanged)
│   ├── eitjeRebuildAggregationService.ts # Keep existing (unchanged)
│   │
│   └── integrationCronRunner.ts          # Update: call v3Aggregation after rebuild
│
├── utils/
│   ├── dailyOpsBusinessDay.ts            # Working day utilities (new)
│   └── v3Snapshots.ts                    # Snapshot helpers (new)
│
└── tasks/
    └── integrations/
        └── bork-eitje-daily.ts           # Update: call v3Aggregation

pages/
├── daily-ops/
│   ├── productivity-v3.vue               # NEW: V3 main dashboard (from snapshot)
│   ├── sales-v3/
│   │   ├── index.vue                     # Sales overview
│   │   ├── by-day-v3.vue                 # V3 daily sales breakdown
│   │   ├── by-hour-v3.vue                # NEW: V3 hourly sales chart
│   │   ├── by-product-v3.vue             # V3 product analysis
│   │   ├── by-waiter-v3.vue              # V3 waiter performance
│   │   └── by-category-v3.vue            # V3 category breakdown
│   ├── hours-v3/
│   │   ├── index.vue                     # Hours/Labor overview (NEW)
│   │   ├── by-day-v3.vue                 # V3 daily hours breakdown (NEW)
│   │   ├── by-hour-v3.vue                # V3 hourly labor chart (NEW)
│   │   ├── by-team-v3.vue                # V3 team hours analysis (NEW)
│   │   ├── by-contract-v3.vue            # V3 contract hours (NEW)
│   │   └── productivity-v3.vue           # V3 labor productivity (NEW)
│   ├── workforce-v3/
│   │   ├── teams-v3.vue                  # V3 teams summary
│   │   └── contracts-v3.vue              # V3 contracts summary
│
components/
└── daily-ops-v3/
    ├── WorkingDaySnapshot.vue            # Display working day snapshot
    ├── HourlyBreakdown.vue               # Hour-by-hour chart
    ├── TeamsCard.vue                     # Teams summary card
    ├── ContractsCard.vue                 # Contracts summary card
    └── SnapshotStatus.vue                # Shows sync count, last update, etc.

types/
└── daily-ops-v3.ts                       # V3 TypeScript types (new)
```

---

## 📋 Implementation Phases

### Phase 1: Infrastructure (Week 1)
- [ ] Create V3 types in `types/daily-ops-v3.ts`
- [ ] Add V3 collections to MongoDB schema
- [ ] Create working day utility functions
- [ ] Add business day helper functions

### Phase 2: Snapshot Services (Week 1-2)
- [ ] Implement `v3SalesSnapshot.ts` service
- [ ] Implement `v3LaborSnapshot.ts` service
- [ ] Implement `v3DashboardSnapshot.ts` service
- [ ] Create `v3AggregationOrchestrator.ts` to coordinate

### Phase 3: Integration with Existing Cron (Week 2)
- [ ] Update `integrationCronRunner.ts` to call V3 aggregation
- [ ] Update `bork-eitje-daily.ts` task to include V3 step
- [ ] Add V3 aggregation after daily-data sync completes

### Phase 4: Dashboard Pages (Week 2-3)
- [ ] Create `productivity-v3.vue` (main dashboard)
- [ ] Create `sales-v3/` pages:
  - [ ] `index.vue` (overview)
  - [ ] `by-day-v3.vue` (daily breakdown)
  - [ ] `by-hour-v3.vue` (hourly chart)
  - [ ] `by-product-v3.vue` (product analysis)
  - [ ] `by-waiter-v3.vue` (waiter performance)
  - [ ] `by-category-v3.vue` (category breakdown)
- [ ] Create `hours-v3/` pages (NEW):
  - [ ] `index.vue` (overview)
  - [ ] `by-day-v3.vue` (daily hours breakdown)
  - [ ] `by-hour-v3.vue` (hourly labor chart)
  - [ ] `by-team-v3.vue` (team hours analysis)
  - [ ] `by-contract-v3.vue` (contract hours)
  - [ ] `productivity-v3.vue` (labor productivity)
- [ ] Create `workforce-v3/` pages:
  - [ ] `teams-v3.vue` (teams summary)
  - [ ] `contracts-v3.vue` (contracts summary)
- [ ] Create supporting components in `components/daily-ops-v3/`

### Phase 5: Testing & Refinement (Week 3)
- [ ] Test snapshot creation during cron runs
- [ ] Test hourly updates (6 throughout day)
- [ ] Test Part 1 → Part 2 transition (00:00 UTC)
- [ ] Test working day finished flag (05:59 UTC)
- [ ] Compare V3 dashboard vs existing (accuracy check)

### Phase 6: Migration & Cleanup (Week 4)
- [ ] Redirect existing dashboard to V3
- [ ] Archive old dashboard pages (keep as v2)
- [ ] Performance testing (snapshot queries)
- [ ] Documentation update

---

## 🗺️ V3 Page Navigation Structure

### URL Routes

```
/daily-ops/productivity-v3                    Main V3 Dashboard
/daily-ops/sales-v3                           Sales Overview (index)
/daily-ops/sales-v3/by-day-v3                 Daily Sales Breakdown
/daily-ops/sales-v3/by-hour-v3                Hourly Sales Chart
/daily-ops/sales-v3/by-product-v3             Product Analysis
/daily-ops/sales-v3/by-waiter-v3              Waiter Performance
/daily-ops/sales-v3/by-category-v3            Category Breakdown

/daily-ops/hours-v3                           Hours/Labor Overview (index) [NEW]
/daily-ops/hours-v3/by-day-v3                 Daily Hours Breakdown [NEW]
/daily-ops/hours-v3/by-hour-v3                Hourly Labor Chart [NEW]
/daily-ops/hours-v3/by-team-v3                Team Hours Analysis [NEW]
/daily-ops/hours-v3/by-contract-v3            Contract Hours [NEW]
/daily-ops/hours-v3/productivity-v3           Labor Productivity [NEW]

/daily-ops/workforce-v3                       Workforce Overview (index)
/daily-ops/workforce-v3/teams-v3              Teams Summary
/daily-ops/workforce-v3/contracts-v3          Contracts Summary
```

### Page Descriptions

#### Sales V3 Pages
- **by-day-v3**: Daily revenue breakdown, top products, top waiters, payment methods
- **by-hour-v3**: Hour-by-hour revenue progression chart, cumulative data
- **by-product-v3**: Product sales quantity, revenue, profit margin per product
- **by-waiter-v3**: Waiter performance, transactions, average ticket value
- **by-category-v3**: Drinks vs Food breakdown, category revenue trends

#### Hours V3 Pages (NEW)
- **by-day-v3**: Daily hours worked, cost, worker count per team
- **by-hour-v3**: Hour-by-hour labor hours progression, cumulative workers
- **by-team-v3**: Team member count, total hours, cost per team
- **by-contract-v3**: Contract type hours, worker count, cost per contract
- **productivity-v3**: Revenue per labor hour, labor cost % of revenue, best/worst performing hours

---

## 📊 V3 Pages Data Sources

All V3 pages read from working day snapshots (updated 6x daily):

```
v3_sales_working_day_snapshots
├─ Used by: sales-v3/* pages
├─ Data: hourlyBreakdown, byWaiter, byCategory, revenueByPaymentMethod, etc.
└─ Updated: 6x daily (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)

v3_labor_working_day_snapshots
├─ Used by: hours-v3/* pages
├─ Data: teams, contracts, hourlyBreakdown, productivity metrics
└─ Updated: 6x daily (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)

v3_daily_ops_dashboard_snapshot
├─ Used by: productivity-v3, workforce-v3/*
├─ Data: combined revenue + labor, top items, productivity metrics
└─ Updated: 6x daily (06:00, 13:00, 16:00, 18:00, 20:00, 22:00 UTC)
```

---

## 🔄 Data Flow for Hours V3 Pages

```
Raw Eitje Data (today only)
  ↓
Upsert to eitje_raw_data
  ↓
Rebuild eitje_time_registration_aggregation (today only, final after 06:00)
  ↓
Update v3_labor_working_day_snapshots
  ├─ Extract teams summary
  ├─ Extract contracts summary
  ├─ Calculate productivity metrics
  ├─ Build hourly breakdown (cumulative)
  └─ Updated 6x daily
  ↓
Hours V3 Pages Read Snapshot
  ├─ /daily-ops/hours-v3/* pages fetch v3_labor_working_day_snapshots
  ├─ Display hourly labor progression
  ├─ Show team/contract breakdowns
  ├─ Calculate productivity ratios
  └─ Live updates 6x daily
```

---

### 1. `updateSalesWorkingDaySnapshot(location, businessDate)`
```
1. Get both ISO daily aggregations (Part 1 & Part 2)
2. Calculate combined totals
3. Extract hourly breakdown from Part 1 data
4. Extract hourly breakdown from Part 2 data (if exists)
5. Upsert snapshot with latest values
6. Set workingDayStarted=true if Part 1 exists
7. Set workingDayFinished=true if at 05:59 UTC AND Part 2 complete
```

### 2. `updateLaborWorkingDaySnapshot(location, businessDate)`
```
1. Query v3_labor_working_day_snapshots for today
2. Fetch today's eitje_time_registration_aggregation
3. Aggregate by team → teams summary
4. Aggregate by contract → contracts summary
5. Calculate productivity metrics
6. Extract hourly breakdown from labor data
7. Upsert snapshot with latest values
```

### 3. `updateDailyOpsDashboardSnapshot(location, businessDate)`
```
1. Fetch sales snapshot for this location/date
2. Fetch labor snapshot for this location/date
3. Combine metrics (revenue + labor)
4. Calculate productivity ratios
5. Extract top products, teams, contracts
6. Prepare hourly data for charts
7. Upsert dashboard snapshot
```

### 4. `markSnapshotsAsFinished(location, businessDate)`
```
1. Update workingDayFinished=true for sales snapshot
2. Update workingDayFinished=true for labor snapshot
3. Update workingDayFinished=true for dashboard snapshot
4. Log snapshot finalization
```

---

## 🎯 Expected Results

After V3 implementation:

✅ **Single document per location** - Much faster dashboard queries  
✅ **Hourly updates throughout day** - Dashboard refreshes live  
✅ **Part 1 + Part 2 tracking** - Knows business day composition  
✅ **Immutable history** - Yesterday's data locked at 05:59  
✅ **Dashboard pages fast** - Reads from single snapshot doc  
✅ **Hour-by-hour charts** - Can show revenue/labor by hour  
✅ **Teams live updates** - Updates 6x daily  
✅ **Contracts live updates** - Updates 6x daily  
✅ **Clean architecture** - V1 (legacy) → V2 (reference) → V3 (production)

---

## 📊 Query Examples (V3 vs V2)

### GET Today's Dashboard (V3 - FAST)
```typescript
const snapshot = await db.collection('v3_daily_ops_dashboard_snapshots').findOne({
  locationId: locationId,
  businessDate: '2026-04-26',
})
// Returns entire dashboard in ONE query
// Results: totalRevenue, totalCost, teamsSummary, contractsSummary, hourlyBreakdown, etc.
```

### GET Today's Dashboard (V2 - SLOW)
```typescript
// Need 4+ separate queries:
const sales = await db.collection('v2_sales_working_day_snapshots').findOne({...})
const labor = await db.collection('v2_labor_costs_aggregated').find({...}).toArray()
const hours = await db.collection('v2_labor_hours_aggregated').find({...}).toArray()
const dashboard = await db.collection('v2_daily_ops_dashboard_aggregated').findOne({...})
// Still need to combine in application logic
```

---

## 🚀 Success Metrics

- Dashboard loads in **< 100ms** (single doc fetch)
- Teams/Contracts show **live data** (6 updates per day)
- Historical queries still work (existing aggregations)
- No breaking changes to existing functionality
- V3 production ready by end of implementation

---

## 📝 Notes

- Keep V2 as reference (don't delete)
- V1 stays in production until V3 fully tested
- Gradual rollout: V3 dashboard first, migrate pages incrementally
- All V3 collections use `v3_` prefix (like V2 did with `v2_`)
- Cron calls BOTH old aggregations (for history) + new V3 snapshot
