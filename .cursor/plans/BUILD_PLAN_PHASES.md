# Daily Ops Build Plan: Complete Implementation

**Stack:** Next.js 15 • React 18 • TypeScript • Tailwind • Shadcn UI • MongoDB • Socket.io

**Architecture Principle:** Start from Final View → Build backwards through layers
- Layer 3: Aggregated Dashboard (All names embedded, zero lookups)
- Layer 2: Enriched Raw Data (IDs + Names added)
- Layer 1: Raw Data (IDs only, preserved)

---

## Phase 0: Preparation (1 Day)

### 0.1 Master Data Collections (Foundation)

**Files to Create:**
- `app/models/ProductMaster.ts` (TypeScript model)
- `app/models/CategoryMaster.ts`
- `app/models/ContractTypeMaster.ts`

**What:** Define schemas for product, category, contract types that will be used for enrichment.

**Requirements:**
- ProductMaster: `_id`, `name`, `code`, `category_id`, `cogs`, `margin`
- CategoryMaster: `_id`, `name`
- ContractTypeMaster: `_id`, `code`, `name`, `hourly_rate`

**MVVM Structure:** These are pure data models (no UI logic).

---

### 0.2 Type Definitions (Critical Path)

**Files to Create:**
- `app/lib/types/dashboard.types.ts` (Final view contract)
- `app/lib/types/enrichment.types.ts` (Enriched records)
- `app/lib/types/raw-data.types.ts` (Layer 1 records)

**What:** Define TypeScript interfaces that travel through all layers.

**Key Contract (from Final View):**

```typescript
// app/lib/types/dashboard.types.ts
export interface DashboardTeamRevenue {
  team_id: ObjectId;
  team_name: string;        // ← No lookup!
  location_id: ObjectId;
  location_name: string;    // ← No lookup!
  revenue: number;
}

export interface DashboardProduct {
  product_id: ObjectId;
  product_name: string;     // ← No lookup!
  category_id: ObjectId;
  category_name: string;    // ← No lookup!
  quantity: number;
  revenue: number;
  cogs: number;
  margin: number;
}

export interface DailyOpsDashboard {
  _id: ObjectId;
  date: string;
  location_id: ObjectId;
  revenue: {
    total: number;
    byProduct: DashboardProduct[];
    byTeam: DashboardTeamRevenue[];
  };
  // ... more fields
}
```

**Rule Compliance:** ✅ No `any`, typed throughout

---

## Phase 1: Master Data Layer (3 Days)

### 1.1 Master Data Cache Service

**Files to Create:**
- `app/lib/services/cache/masterDataCacheService.ts`

**What:** Load all master data into memory once, provide O(1) lookups.

**Metadata Header Required:**
```typescript
/**
 * @registry-id: masterDataCacheService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cache service for master data (members, locations, teams, products)
 * @last-fix: [2026-01-30] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */
```

**Key Methods:**
- `loadAllMasterData()` - Fetch all master data to maps
- `getMember(id)` - O(1) lookup
- `getProduct(id)` - O(1) lookup
- `getLocation(id)` - O(1) lookup
- `getTeam(id)` - O(1) lookup
- `getCategory(id)` - O(1) lookup

**Rule Compliance:**
- ✅ Server Functions for backend work
- ✅ No `any` types
- ✅ Modular (single responsibility)
- ✅ Metadata header complete

---

### 1.2 API Credentials & Configuration

**Files to Update:**
- `app/models/Location.ts` (add Bork + Eitje API credentials references)

**What:** Store Bork API credentials per location.

**Requirements:**
- Each location can have Bork credentials (baseUrl, apiKey)
- Each location can have Eitje credentials
- Use environment variables as fallback

---

### 1.3 Collections Setup

**Files to Create:**
- `app/lib/bork/v2-ensure-collections.ts` (update existing)
- `app/lib/eitje/ensure-collections.ts` (new)

**What:** Ensure all required collections exist with indexes.

**Collections:**
```
Layer 1 Raw:
├─ test-eitje-hours
├─ test-eitje-contracts
├─ test-eitje-finance-summary
├─ test-bork-sales-unified (NEW - unified CSV+API)
└─ test-bork-basis-rapport

Snapshots:
├─ snapshots_email (4x daily)
├─ snapshots_api (24x daily)
├─ snapshot_reconciliation
└─ bork_reconciliation (NEW)

Final:
└─ v2_daily_ops_dashboard_aggregated
```

---

## Phase 2: Source Collectors (5 Days)

### 2.1 Email Snapshot Collector

**Files to Create:**
- `app/lib/services/sync/emailSnapshotCollector.ts`

**What:** Collect email snapshots at 08:00, 15:00, 19:00, 23:00.

**What It Does:**
1. Check inbox for latest Eitje finance CSV
2. Check inbox for latest Bork basis report CSV
3. Parse both
4. Store raw snapshots
5. Return snapshot metadata

**Metadata Required:**
```typescript
/**
 * @registry-id: emailSnapshotCollector
 * @created: 2026-01-30T00:00:00.000Z
 * @exports-to:
 *   ✓ app/api/cron/sync/email-snapshot/route.ts
 */
```

---

### 2.2 API Snapshot Collector

**Files to Create:**
- `app/lib/services/sync/apiSnapshotCollector.ts`

**What:** Collect API snapshots hourly (00-23).

**What It Does:**
1. Call Eitje API for hours (if configured)
2. Call Bork API for sales (if configured)
3. Store raw API responses
4. Return snapshot metadata

**Metadata Required:**
```typescript
/**
 * @registry-id: apiSnapshotCollector
 * @exports-to:
 *   ✓ app/api/cron/sync/api-snapshot/route.ts
 */
```

---

### 2.3 Import Services

**Files to Create:**
- `app/lib/services/data-sources/eitjeCSVImportService.ts`
- `app/lib/services/data-sources/borkCSVImportService.ts`
- `app/lib/services/data-sources/eitjeAPIImportService.ts`
- `app/lib/services/data-sources/borkAPIImportService.ts`

**What:** Transform CSV/API data to unified raw format (Layer 1).

**Each Service:**
1. Parse CSV row OR API object
2. Lookup IDs (from Location, Member, Team, Product)
3. Create raw record with IDs only
4. Store in raw collection
5. Return result

**Key:** Layer 1 has only IDs, no names yet!

---

## Phase 3: Enrichment Layer (4 Days)

### 3.1 Enrichment Services

**Files to Create:**
- `app/lib/services/enrichment/laborEnrichmentService.ts`
- `app/lib/services/enrichment/salesEnrichmentService.ts`

**What:** Add names to raw records (IDs → IDs + Names).

**What They Do:**
1. Load MasterDataCache (once)
2. For each raw record:
   - Get member from cache → add member_name, member_role
   - Get location from cache → add location_name
   - Get team from cache → add team_name
   - Get product from cache → add product_name, category_name (for sales)
3. Return enriched record (now has names!)

**Key:** O(1) per record, no DB queries!

**Metadata Required:**
```typescript
/**
 * @registry-id: laborEnrichmentService
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */
```

---

### 3.2 Validation Services

**Files to Create:**
- `app/lib/services/validation/eitjeValidationService.ts`
- `app/lib/services/validation/borkValidationService.ts`

**What:** Compare email CSV totals vs API totals.

**What They Do:**
1. Get CSV total (labor_cost, hours, or revenue)
2. Get API total (sum of raw records)
3. Compare within tolerance (e.g., ±1%)
4. Flag if variance
5. Store reconciliation result

**Rule Compliance:**
- ✅ Server Functions
- ✅ Modular services
- ✅ Typed inputs/outputs

---

## Phase 4: Aggregation Layer (4 Days)

### 4.1 Dashboard Aggregation Service

**Files to Create:**
- `app/lib/services/aggregation/dailyOpsAggregationService.ts`

**What:** Transform enriched records → final dashboard document (Layer 3).

**What It Does:**
```typescript
async buildDailyAggregation(
  date: string,
  locationId: string,
  enrichedLaborRecords: EnrichedLaborRecord[],
  enrichedSalesRecords: EnrichedSalesRecord[]
): Promise<DailyOpsDashboard>
```

1. Load enriched records (already have names!)
2. Group by product, category, team (for sales)
3. Group by team, member (for labor)
4. Calculate KPIs
5. Create final document
6. Store in v2_daily_ops_dashboard_aggregated

**Key:** Just grouping and summing, no lookups!

**Metadata Required:**
```typescript
/**
 * @registry-id: dailyOpsAggregationService
 * @created: 2026-01-30T00:00:00.000Z
 * @exports-to:
 *   ✓ app/api/cron/daily-aggregation/route.ts
 */
```

---

### 4.2 Cron Job: Daily Aggregation

**Files to Create:**
- `app/api/cron/daily-aggregation/route.ts`

**What:** Run at 23:10 to build final dashboard.

**Flow:**
```
1. Get all active locations
2. For each location:
   a. Fetch test-eitje-hours (raw)
   b. Fetch test-bork-sales-unified (raw)
   c. Enrich labor records
   d. Enrich sales records
   e. Validate (compare CSV vs API)
   f. Aggregate
   g. Store
3. Return results
```

**Rule Compliance:**
- ✅ Route handler only (no UI logic)
- ✅ Server-side computation
- ✅ Pagination if needed

---

## Phase 5: Snapshot & Reconciliation (3 Days)

### 5.1 Snapshot Reconciliation Service

**Files to Create:**
- `app/lib/services/sync/snapshotReconciliationService.ts`

**What:** Compare email snapshots with nearby API snapshots.

**What It Does:**
1. Email arrives at 15:00
2. Find API snapshots from 14:00 and 15:00
3. Compare labor totals (CSV vs API)
4. Compare sales totals (CSV vs API)
5. Flag variance if > tolerance
6. Store reconciliation result

**Metadata Required:**
```typescript
/**
 * @registry-id: snapshotReconciliationService
 * @exports-to:
 *   ✓ app/api/cron/sync/email-snapshot/route.ts
 *   ✓ app/api/cron/sync/api-snapshot/route.ts
 */
```

---

### 5.2 Cron Jobs: Email & API Snapshots

**Files to Create:**
- `app/api/cron/sync/email-snapshot/route.ts`
- `app/api/cron/sync/api-snapshot/route.ts`

**Cron Schedules:**

Email Snapshots:
```
0 8 * * *    (08:00)
0 15 * * *   (15:00)
0 19 * * *   (19:00)
0 23 * * *   (23:00)
```

API Snapshots:
```
0 * * * *    (Every hour)
```

**Flow:**
```
Email Snapshot (15:00):
  1. Collect email data
  2. Store in snapshots_email
  3. Trigger reconciliation

API Snapshot (15:00):
  1. Collect API data
  2. Store in snapshots_api
  3. Trigger reconciliation (if email already there)
```

---

## Phase 6: Server Actions & API Routes (3 Days)

### 6.1 Server Actions for Dashboard

**Files to Create:**
- `app/actions/daily-ops.ts`

**What:** Server Functions for querying dashboard data.

**Functions:**
```typescript
'use server'

export async function getDailyDashboard(date: string, locationId: string)
export async function getRevenueBreakdown(date: string, locationId: string)
export async function getLaborMetrics(date: string, locationId: string)
export async function getProductAnalysis(date: string, locationId: string)
export async function getKPIs(date: string, locationId: string)
export async function getDailyHealth(date: string, locationId: string)
```

**Rule Compliance:**
- ✅ Server-side only
- ✅ TypeScript throughout
- ✅ Modular functions

---

### 6.2 API Routes for Admin/Setup

**Files to Create:**
- `app/api/data/import/eitje-csv/route.ts` (CSV upload)
- `app/api/data/import/bork-csv/route.ts` (CSV upload)
- `app/api/data/validation/status/route.ts` (Check validation status)

**What:** Manual import endpoints and status checks.

---

## Phase 7: React Components (MVVM Pattern) (5 Days)

### 7.1 ViewModel Hooks (Business Logic)

**Files to Create:**
- `app/lib/hooks/useDailyOpsDashboard.ts`
- `app/lib/hooks/useRevenueBreakdown.ts`
- `app/lib/hooks/useLaborMetrics.ts`
- `app/lib/hooks/useProductAnalysis.ts`
- `app/lib/hooks/useDailyHealth.ts`

**Pattern:**
```typescript
// app/lib/hooks/useDailyOpsDashboard.ts
export function useDailyOpsDashboard(date: string, locationId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', date, locationId],
    queryFn: () => getDailyDashboard(date, locationId),
  });

  return {
    dashboard: data,
    isLoading,
    error,
    // Derived data
    laborCostPercentage: computed(() => ...),
    topProducts: computed(() => ...),
  };
}
```

**Rule Compliance:**
- ✅ Custom hooks (camelCase)
- ✅ Composition API pattern
- ✅ React Query for data fetching
- ✅ No business logic in components

---

### 7.2 UI Components (View Layer)

**Files to Create:**
- `app/components/dashboard/RevenueCard.tsx`
- `app/components/dashboard/LaborCard.tsx`
- `app/components/dashboard/ProductsCard.tsx`
- `app/components/dashboard/KPIGrid.tsx`
- `app/components/dashboard/HealthStatus.tsx`
- `app/components/dashboard/DataQualityAlert.tsx`

**Pattern:**
```typescript
// app/components/dashboard/RevenueCard.tsx
'use client'

interface RevenueCardProps {
  revenue: DashboardRevenue;
  isLoading: boolean;
}

export function RevenueCard({ revenue, isLoading }: RevenueCardProps) {
  if (isLoading) return <Skeleton />;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">€{revenue.total}</div>
        {/* No lookups! All data embedded */}
        {revenue.byTeam.map(team => (
          <div key={team.team_id}>
            <p>{team.team_name}</p>  {/* ← Name already here! */}
            <p>€{team.revenue}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Rule Compliance:**
- ✅ PascalCase component names
- ✅ `'use client'` directive
- ✅ No business logic
- ✅ SSR-friendly (async if needed with Suspense)

---

### 7.3 Page Layout

**Files to Create:**
- `app/daily-ops/page.tsx` (Main page)

**Pattern:**
```typescript
// app/daily-ops/page.tsx
'use client'

import { useSearchParams } from 'next/navigation';
import { useDailyOpsDashboard } from '@/lib/hooks/useDailyOpsDashboard';
import { RevenueCard } from '@/components/dashboard/RevenueCard';
// ... more imports

export default function DailyOpsPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const locationId = searchParams.get('location') || 'default';

  const { dashboard, isLoading } = useDailyOpsDashboard(date, locationId);

  if (isLoading) return <LoadingState />;

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <RevenueCard revenue={dashboard.revenue} isLoading={isLoading} />
        <LaborCard labor={dashboard.labor} isLoading={isLoading} />
        <ProductsCard products={dashboard.products} isLoading={isLoading} />
      </div>
      <KPIGrid kpis={dashboard.kpis} />
      <HealthStatus sources={dashboard.sources} />
    </div>
  );
}
```

---

## Phase 8: Testing & Validation (3 Days)

### 8.1 Unit Tests

**Files to Create:**
- `app/lib/services/aggregation/__tests__/dailyOpsAggregation.test.ts`
- `app/lib/services/enrichment/__tests__/enrichment.test.ts`

**What:** Test enrichment and aggregation logic.

---

### 8.2 Integration Tests

**Files to Create:**
- `app/api/cron/__tests__/daily-aggregation.test.ts`

**What:** Test full pipeline (raw → enriched → aggregated).

---

### 8.3 Manual Testing

**Checklist:**
- [ ] CSV import works (Eitje contracts, hours, finance)
- [ ] Bork API sync works
- [ ] Enrichment adds names correctly
- [ ] Validation compares CSV vs API
- [ ] Aggregation produces correct totals
- [ ] Dashboard renders without lookups
- [ ] No console errors in production

---

## Implementation Timeline

```
Week 1:
  - Phase 0: Master data types (1 day)
  - Phase 1: Cache service + collections (2 days)
  - Phase 2: Collectors (2 days)

Week 2:
  - Phase 3: Enrichment (2 days)
  - Phase 4: Aggregation + cron (2 days)
  - Phase 5: Snapshots + reconciliation (1 day)

Week 3:
  - Phase 6: Server actions + API (2 days)
  - Phase 7: Components (MVVM) (3 days)

Week 4:
  - Phase 8: Testing (2 days)
  - Buffer/Polish (3 days)
```

---

## File Structure

```
app/
├── api/
│   ├── cron/
│   │   ├── daily-aggregation/route.ts
│   │   ├── sync/
│   │   │   ├── email-snapshot/route.ts
│   │   │   └── api-snapshot/route.ts
│   │   └── ...
│   └── data/
│       ├── import/
│       │   ├── eitje-csv/route.ts
│       │   └── bork-csv/route.ts
│       └── validation/
│           └── status/route.ts
│
├── components/
│   └── dashboard/
│       ├── RevenueCard.tsx
│       ├── LaborCard.tsx
│       ├── ProductsCard.tsx
│       ├── KPIGrid.tsx
│       ├── HealthStatus.tsx
│       └── DataQualityAlert.tsx
│
├── daily-ops/
│   └── page.tsx
│
├── actions/
│   └── daily-ops.ts
│
├── lib/
│   ├── hooks/
│   │   ├── useDailyOpsDashboard.ts
│   │   ├── useRevenueBreakdown.ts
│   │   └── ...
│   ├── services/
│   │   ├── cache/
│   │   │   └── masterDataCacheService.ts
│   │   ├── sync/
│   │   │   ├── emailSnapshotCollector.ts
│   │   │   ├── apiSnapshotCollector.ts
│   │   │   └── snapshotReconciliationService.ts
│   │   ├── data-sources/
│   │   │   ├── eitjeCSVImportService.ts
│   │   │   ├── eitjeAPIImportService.ts
│   │   │   ├── borkCSVImportService.ts
│   │   │   └── borkAPIImportService.ts
│   │   ├── enrichment/
│   │   │   ├── laborEnrichmentService.ts
│   │   │   ├── salesEnrichmentService.ts
│   │   │   └── __tests__/
│   │   ├── validation/
│   │   │   ├── eitjeValidationService.ts
│   │   │   └── borkValidationService.ts
│   │   └── aggregation/
│   │       ├── dailyOpsAggregationService.ts
│   │       └── __tests__/
│   ├── types/
│   │   ├── dashboard.types.ts
│   │   ├── enrichment.types.ts
│   │   └── raw-data.types.ts
│   ├── bork/
│   │   ├── v2-ensure-collections.ts
│   │   ├── v2-api-client.ts
│   │   └── ...
│   └── eitje/
│       ├── ensure-collections.ts
│       └── ...
│
└── models/
    ├── ProductMaster.ts
    ├── CategoryMaster.ts
    ├── ContractTypeMaster.ts
    └── ...
```

---

## Rules Compliance Checklist

✅ **RULE #0: UNDERSTAND → CLARIFY → CONFIRM**
- Full plan shown above
- All files listed
- Permission needed before execution

✅ **RULE #11: METADATA HEADERS**
- Every service has metadata header
- @exports-to tracks dependencies
- @last-modified updated on changes

✅ **NEXT.JS 15 SPECIFICS**
- App Router (`app/` directory)
- Server Components by default
- Client Components only with `'use client'`
- Route handlers in `app/api/`

✅ **REACT 18 + MVVM**
- ViewModels as custom hooks (business logic)
- Components as pure views (UI only)
- React Query for data fetching
- No business logic in components

✅ **TYPE SAFETY**
- No `any` types
- All interfaces defined
- Type-safe across all layers

✅ **MODULAR**
- Single responsibility per file
- Services separated by concern
- Small functions (<100 lines)

✅ **SSR-FRIENDLY**
- Server Functions for backend
- Client Components explicitly marked
- Suspense boundaries used

---

## Ready to Build?

This plan follows your principle (start from final view) + my execution approach (build through layers).

**Proceed with Phase 0?** ✅

Once approved, I will:
1. Create TypeScript models & types
2. Set up collections
3. Build services layer by layer
4. Never show code unless asked
5. Update function-registry.json
6. Commit in small chunks
