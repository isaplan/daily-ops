---
name: daily-ops-revenue-overhaul
overview: "Complete overhaul of /daily-ops/revenue: new modular API namespace, extended period+compare system (week/month/quarter/season/year + YoY/2Y), new revenue-only components, Simple PnL, snapshot extensions for products/tables/hours, and migration of worker/table/order-payment-timing surfaces to the Productivity page. Investigation only — global outline for moulding before per-section deep-dives."
todos:
  - id: decisions
    content: Lock §L open decisions (split vs single, compare scope, snapshot timing, co-occurrence, order/payment timing, productivity migration, seasons, picker UX)
    status: completed
  - id: phase-1-foundations
    content: Phase 1 — period+compare resolver, types, useDailyOpsRevenuePeriod composable, RevenuePageShell skeleton (no data fetches yet)
    status: completed
  - id: phase-2-overview
    content: "Phase 2 — Overview: summary + pnl + locations endpoints, KPI strip, Simple PnL card, location pie"
    status: completed
  - id: phase-3-trends
    content: "Phase 3 — Trends: timeseries + rolling medians + weekday pattern endpoints and charts"
    status: completed
  - id: phase-4-mix
    content: "Phase 4 — Mix: product mix + category share endpoints and components; co-occurrence stub"
    status: completed
  - id: phase-5-hourly
    content: "Phase 5 — Hourly: hour×weekday matrix + hour-category stack + profit interval migration"
    status: completed
  - id: phase-6-productivity
    content: Phase 6 — Move worker/table revenue and order-payment rhythm to productivity; fix variant=productivity wiring
    status: completed
  - id: phase-7-snapshots
    content: Phase 7 — Snapshot section writers for products/hours/tables/workers; flip read paths to snapshot-first
    status: completed
  - id: phase-8-cooccurrence
    content: "Phase 8 — Co-occurrence (basket analysis): pick V2-aggregate vs raw-ticket approach based on Phase 1-7 learnings"
    status: completed
isProject: false
---

# Daily Ops Revenue Overhaul — Global Outline

> This is the **moldable global outline** the user asked for. No code, no md. Every section is intentionally open so we can shape it together, then drill into one phase at a time.

---

## 0. Baseline (what's actually there today)

- [`pages/daily-ops/revenue.vue`](pages/daily-ops/revenue.vue) is a **9-line wrapper** around `DailyOpsHomeDashboard` — shares everything with overview + productivity.
- Period system in [`utils/dailyOpsPeriod.ts`](utils/dailyOpsPeriod.ts) supports only `today / yesterday / d2-d7 / this-week / last-week`. **No** quarters, seasons, YoY, rolling windows, or "compare to".
- Revenue data already in Mongo via V2 pipeline ([`server/services/borkRebuildAggregationV2Service.ts`](server/services/borkRebuildAggregationV2Service.ts)) → `bork_sales_by_hour_v2`, `_by_day_v2`, `_by_product_v2`, `_by_table_v2`, `_by_worker_v2`, `_by_guest_account_v2`, `bork_business_days_v2`. Both ex-VAT and inc-VAT on every row.
- Ground-truth daily totals (ex-VAT) in `inbox-bork-basis-report` from Gmail Basis Report (cron 8/12/18/23 in [`server/tasks/inbox/gmail-sync.ts`](server/tasks/inbox/gmail-sync.ts)).
- Labor cost helper that we should reuse: `aggregateLaborForRange` in [`server/utils/dailyOpsSnapshot/aggregateLaborForRange.ts`](server/utils/dailyOpsSnapshot/aggregateLaborForRange.ts) (returns `wages`, `loaded`, `hours`, `byTeam`, `coverage`).
- Snapshot section for revenue exists but is **not yet the primary read path** ([`server/utils/dailyOpsSnapshot/buildRevenueSection.ts`](server/utils/dailyOpsSnapshot/buildRevenueSection.ts)).
- Chart lib in repo: **d3 v7** only (no chart.js / apex). Existing wrappers: [`components/charts/D3PieChartV2.vue`](components/charts/D3PieChartV2.vue), `D3StackedBarChart.vue`, and the inline donut in [`components/daily-ops/DailyOpsProfitIntervalDonut.vue`](components/daily-ops/DailyOpsProfitIntervalDonut.vue).
- VAT policy is already "**display ex-VAT**" (`VAT_DISCLAIMER` in [`server/utils/dailyOpsDashboardMetrics.ts`](server/utils/dailyOpsDashboardMetrics.ts)). Storage has both — we just always pick `total_revenue_ex_vat` and `final_revenue_ex_vat`.
- **Gaps** vs the user's ask:
  1. No quarter / season / YoY / rolling-window period IDs.
  2. No "compare to" infrastructure on any API.
  3. No co-occurrence / basket analytics (`inbox-bork-product-mix` stores raw CSV but no analysis).
  4. No per-ticket payment-time vs order-time series — paymodes are day-level only on `bork_sales_by_day_v2`.
  5. `daily_ops_snapshot_section_products / _tables / _hours / _workers` are planned but **not built**.

---

## A. Page topology: 1-page with tabs (confirmed by user)

**Single page `/daily-ops/revenue` with internal tabs** (matches daily-ops shell pattern):

**Tab 1: Overview** 
- KPI strip (revenue, items, €/item, compare deltas vs LY)
- Simple PnL card (revenue − COGS − labor − overhead + assumptions popover)
- Location comparison pie (3 venues) + summary table (venue, revenue, items, €/item, % share)
- Period picker (Day/Week/Month/Quarter/Season/Year/Rolling) + Compare to picker (none / LY only)

**Tab 2: Trends** 
- Timeseries chart (line/area): current period vs LY overlay, points per day/week/month/quarter
- Rolling medians card (30/60/90d: median, mean, p25, p75)
- Weekday pattern: "last 10 Mondays / Tuesdays / etc" table (12 rows, shows daily revenue with LY %)

**Tab 3: Hourly & Mix**
- Hour × weekday heatmap (0–23h rows, Mon–Sun cols, cells = revenue ex-VAT, color intensity)
- Hour × category stacked bar (keuken / dranken-hoog / dranken-laag per hour)
- Category pie (keuken, dranken, overige % split)
- Top-20 products table (product name, qty, € revenue, weekday distribution as mini-bars or % per day)

**Tab 4: Per-Dimension Views** (tables or toggleable charts)
- Toggle: Revenue by Day / by Hour / by Staff / by Table / by Location Space (bar/restaurant/terras)
- Revenue per location space (revenue, items, turnover proxy if applicable)
- Revenue per staff (name, revenue ex-VAT, order count, avg unique products per order, last 14d)
- Revenue per table (table#, location space, revenue, turnover metric)
- Order time vs payment time (workload rhythm: hourly order count vs hourly payment count as overlaid bars/line)

**Move to `/daily-ops/productivity`** (separate namespace, same 3-location shell pattern):
- These per-staff/per-table/order-payment metrics belong in productivity, not revenue strategy.
- Productivity page already has `variant="productivity"` flag; extend it to surface these.

Rationale: revenue strategy is KPI + PnL + trends + category mix; operations (staff/table/workload) belong to productivity page.

---

## B. Period & compare system: single LY compare (confirmed by user)

Replace `DailyOpsPeriodId` with a richer model:

**Primary period picker** (one of):
- **Day**: `today`, `yesterday`, `d2..d7`
- **Week**: `this-week`, `last-week`, `wtd` (week-to-date), `last-7d`
- **Month**: `this-month`, `last-month`, `mtd`, `last-30d`
- **Quarter**: `q1`, `q2`, `q3`, `q4` (calendar year), `last-q`, `qtd`
- **Season**: `spring`, `summer`, `autumn`, `winter` (hardcoded Mar–May / Jun–Aug / Sep–Nov / Dec–Feb)
- **Year**: `this-year`, `last-year`, `ytd`, `last-365d`
- **Rolling**: `last-14d`, `last-60d`, `last-90d`
- **Custom**: user picks startDate + endDate via popover

**Compare picker** (single secondary period):
- `none` (primary period only)
- `previous` (same length, immediately before)
- `ly` (last year: same calendar dates, 365 days back)
- `custom` (user picks secondary range)

**Chart overlays**: when compare is active, draw current + compare as two series on same axes (line + line, or line + area-transparent). Delta badges: € diff and % change from compare to current.

**Anchor & business-day rules**: keep Amsterdam open-register day 08:00 ([`utils/dailyOpsBusinessDate.ts`](utils/dailyOpsBusinessDate.ts)) and ISO weeks; no UTC midnight mixing.

**Deliverable**: `utils/dailyOpsRevenuePeriod.ts` exporting:
- `resolveDailyOpsRevenuePeriod(period, anchor?, now?)` → `{ id, label, startDate, endDate }`
- `resolveCompareRange(compareKind, primaryRange, now?)` → `{ label, startDate, endDate }` or null
- Types: `DailyOpsRevenuePeriodId`, `DailyOpsRevenueCompareKind`

---

## C. Data layer (server) — mirror daily-ops architecture

New folder `server/utils/dailyOpsRevenue/` (matches `server/utils/dailyOpsSnapshot/` pattern):

**Metadata header** (per RULE #11) on each file:
```typescript
/**
 * @registry-id: dailyOpsRevenue*
 * @created: YYYY-MM-DD
 * @last-modified: YYYY-MM-DD
 * @description: [role]
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/* => imported for data fetches
 * ✓ composables/useDailyOpsRevenueMetrics.ts => used for hydration
 */
```

**Core utilities**:
- `resolveRevenuePeriod.ts` — wraps `resolveDailyOpsRevenuePeriod` + `resolveCompareRange` from utils layer.
- `fetchRevenueRange.ts` — returns `{ revenue: number, itemsCount: number, €PerItem: number }` for a `{range, locationId?}`. Lead source: `inbox-bork-basis-report` (ex-VAT, sealed days) → `bork_business_days_v2` → `bork_sales_by_hour_v2` rollup.
- `fetchRevenueTimeseries.ts` — granularity `day | week | month | quarter`; emits `Array<{date, revenue, itemsCount}>` so UI can plot. Each call returns single series (current period); caller handles overlay with compare series.
- `fetchLocationSplit.ts` — array of `{locationId, locationName, revenue, itemsCount, pctOfTotal}` for 3 venues + totals row.
- `fetchLocationSpace.ts` — group tables into bar/restaurant/terras; return per-space revenue breakdown. Reads table → space mapping from constant or Bork metadata (confirm with user in phase 1).
- `fetchProductMix.ts` — top-N products by revenue ex-VAT, weekday distribution, food/drinks classification.
- `fetchHourlyMatrix.ts` — `24 × 7` grid (hours × weekdays); cells = `{revenue, itemsCount, foodRevenue, drinksRevenue}` per cell.
- `computeRollingMedians.ts` — 30/60/90d daily windows; returns `{windows: [{label: '30d', median, mean, p25, p75}]}`.
- `computeSimplePnL.ts` — see §D.
- `computeWeekdayPattern.ts` — "last 10 Mondays / Tuesdays / etc" as table rows with current + LY column.

**Shared query parser** (matches `parseDailyOpsMetricsQuery` pattern):
```typescript
export function parseRevenueQuery(q: Record<string, unknown>): RevenueQueryContext {
  return {
    primaryPeriod: resolveDailyOpsRevenuePeriod(...),
    comparePeriod: resolveCompareRange(...),
    locationId: q.location as string | undefined,
    locationSpace: q.space as string | undefined,
  }
}
```

**No new Mongo pipelines required for v1** — V2 collections have all needed data; we aggregate in-memory or via Mongo `$group` / `$sum`.

**Collections read**:
- `inbox-bork-basis-report` (ground truth daily totals, ex-VAT)
- `bork_business_days_v2`, `bork_sales_by_hour_v2`, `bork_sales_by_product_v2`, `bork_sales_by_table_v2`, `bork_sales_by_worker_v2`
- `eitje_time_registration_aggregation` (for labor in PnL via `aggregateLaborForRange`)
- `daily_ops_snapshot_section_labor` (labor fallback per ADR-004)

---

## D. Simple PnL (configurable, not hardcoded)

Defaults from user spec:
- **Revenue**: ex-VAT, from `fetchRevenueRange`.
- **Cost of sales**: 30 % of food revenue, 4 % of beverage revenue (existing `computeMostProfitableHour` already uses 30/4 — keep consistent). Allow override per location.
- **Labor cost**: `aggregateLaborForRange().loaded` from snapshot section (ADR-004) with `wage_cost` fallback. Coverage badge if any day missing.
- **Fixed overhead**: 25 % of revenue (user spec).
- **Result**: revenue − COGS − labor − overhead.

UI:
- Single card with editable assumptions popover (food %, beverage %, overhead %).
- Compare column when compareTo is active.
- Per-location toggle (combined / individual venue).

Store defaults in a single constants file `server/utils/dailyOpsRevenue/pnlAssumptions.ts` so finance can tune without touching multiple files.

---

## E. Snapshot extension (optional but recommended phase 2)

Match ADR-004's snapshot-first principle. Add:
- `daily_ops_snapshot_section_products` — per-day product totals + top-N.
- `daily_ops_snapshot_section_hours` — 24 hourly slots per day (food/drink split).
- `daily_ops_snapshot_section_tables` — per-day per-table revenue + cover proxy.
- `daily_ops_snapshot_section_workers` — per-day per-worker revenue / orders / avg items.

Each section follows the existing `buildLaborSection` pattern (one writer, one reader, fallback to V2 aggregates). The read helpers in §C become "snapshot-first, aggregate-fallback".

**Open decision:** do we ship v1 reading aggregates directly (faster) and add snapshots in v1.5, or block on snapshots? Recommendation: **ship reading aggregates first** — snapshot extension can be additive without touching the new APIs' contracts.

---

## F. API surface (new `/api/daily-ops/revenue/*` namespace)

All endpoints:
- Accept query: `period`, `anchor?`, `compareTo?` (none | previous | ly | custom), `location?`, `space?`
- Return ex-VAT values consistently
- Use `parseRevenueQuery` for common validation

**Revenue page endpoints** (overview tab):
- `GET /api/daily-ops/revenue/summary` — `{revenue, itemsCount, €PerItem, leadSource, currentLabel, compareLabel?, compareDelta?}`
- `GET /api/daily-ops/revenue/pnl` — `{revenue, foodCogs, bevCogs, laborCost, overhead, result, assumptions}`
- `GET /api/daily-ops/revenue/locations` — array of `{locationId, locationName, revenue, itemsCount, €PerItem, pctOfTotal}`

**Trends tab endpoints**:
- `GET /api/daily-ops/revenue/timeseries?granularity=day|week|month|quarter` — `{current: Array<{date, revenue, itemsCount}>, compare: Array<...>?}`
- `GET /api/daily-ops/revenue/rolling-medians` — `{windows: [{label: '30d', median, mean, p25, p75}, ...]}`
- `GET /api/daily-ops/revenue/weekday-pattern?weekday=monday` — array of `{date, dayOfWeek, revenue, itemsCount, compareRevenue?, comparePct?}` (last 10 occurrences)

**Hourly & Mix tab endpoints**:
- `GET /api/daily-ops/revenue/hourly-matrix` — `{rows: [{hour: 0–23, weekdays: [{dow: 'mon', revenue, items, food, drinks}, ...]}]}`
- `GET /api/daily-ops/revenue/categories` — `{categories: [{name, revenue, itemsCount, pctOfTotal, breakdown: {byWeekday: [...]}}]}`
- `GET /api/daily-ops/revenue/products?limit=20` — array of `{productName, revenue, itemsCount, byWeekday: [...]}`

**Per-dimension tab endpoints**:
- `GET /api/daily-ops/revenue/per-location-space?space=bar|restaurant|terras` — array of `{space, revenue, itemsCount, €PerItem}`
- `GET /api/daily-ops/revenue/per-staff` — array of `{staffName, revenue, orderCount, avgProductsPerOrder, days: 14}`
- `GET /api/daily-ops/revenue/per-table?locationSpace?` — array of `{tableNum, locationSpace, revenue, coverEstimate?}`
- `GET /api/daily-ops/revenue/order-payment-rhythm` — array of `{hour: 0–23, orderCount, paymentCount, orderCountCompare?, paymentCountCompare?}`

**Stub/deprecate**:
- Delete `server/api/daily-ops/revenue.get.ts` (currently placeholder).

**Productivity namespace** (separate, moved from revenue):
- `GET /api/daily-ops/productivity/workers-revenue` — same as `/api/daily-ops/revenue/per-staff` (mirror for ergonomics)
- `GET /api/daily-ops/productivity/tables-revenue` — same as `/api/daily-ops/revenue/per-table`
- `GET /api/daily-ops/productivity/order-payment-rhythm` — same as `/api/daily-ops/revenue/order-payment-rhythm`

---

## G. Component surface (mirror daily-ops pattern)

New folder `components/daily-ops/revenue/` (matches `components/daily-ops/labor/` pattern).

**Shell & filters** (sticky header above tabs):
- `RevenuePage.vue` — wrapper, handles `useDailyOpsRevenuePeriod` (URL state), renders tabs + sticky filter bar.
- `RevenueFilterBar.vue` — period picker + compare picker + location filter + export button. Same pills/popover UX as daily-ops shell.
- `RevenuePeriodPicker.vue` — dropdown groups: Day / Week / Month / Quarter / Season / Year / Rolling / Custom. Custom opens popover with date pickers.
- `RevenueComparePicker.vue` — single-select: none / previous / ly / custom. When active, show delta badges.
- `RevenueLocationFilter.vue` — all / VKB / Bar Bea / L'Amour or per-space radio (bar / restaurant / terras).

**Tab 1: Overview components**:
- `RevenueKpiStrip.vue` — 4 KPI cards: revenue, items, €/item, (optional: lead source badge). Each card shows compare delta if compare is active.
- `RevenuePnLCard.vue` — Simple PnL grid (revenue | COGS | Labor | Overhead | Result). Assumptions editable popover (food %, beverage %, overhead %). Compare column if active.
- `RevenueLocationPie.vue` — pie chart (d3) showing 3 venues + "Andere" bucket; size = revenue; legend shows € + %.
- `RevenueLocationTable.vue` — table: venue | revenue | items | €/item | % of total. Compare column if active (delta € + %).

**Tab 2: Trends components**:
- `RevenueTimeseriesChart.vue` — line/area chart (d3); x = date, y = revenue; current period = solid line, compare = dashed line or area-transparent. Hover = tooltip with both series values + delta %.
- `RevenueRollingMediansCard.vue` — 3 stat cards: 30d, 60d, 90d; each shows median, mean, p25, p75 sparkline.
- `RevenueWeekdayTable.vue` — "last 10 Mondays" (or selected weekday); rows = most recent 10 occurrences; columns: date | dayOfWeek | revenue | items | compare revenue | compare %.

**Tab 3: Hourly & Mix components**:
- `RevenueHourlyHeatmap.vue` — 24h × 7d grid (d3); cells colored by revenue intensity (gradient white → dark). Hover = revenue + items.
- `RevenueHourlyCategoryStack.vue` — stacked bar per hour (0–23), segments: keuken (yellow) / dranken-hoog (blue) / dranken-laag (green).
- `RevenueCategoryPie.vue` — pie: keuken % | dranken % | overige %; legend shows € breakdown.
- `RevenueProductTopTable.vue` — top-20 products; columns: product | revenue | items | €/item | weekday distribution (7 mini-bars Mon–Sun).

**Tab 4: Per-Dimension components**:
- `RevenueDimensionTabs.vue` — inner tabs: by-day | by-hour | by-staff | by-table | by-space.
- `RevenueByDayTable.vue` — calendar view or row table: date | revenue | items | €/item | compare.
- `RevenueByHourChart.vue` — bar chart: hours 0–23 on x-axis, revenue on y, color-coded category.
- `RevenueByStaffTable.vue` — staff name | revenue | order count | avg products per order | trend badge.
- `RevenueByTableTable.vue` — table# | location space | revenue | cover proxy | trend.
- `RevenueBySpaceChart.vue` — bar or pie: bar (restaurant) | terras | bar on x-axis, revenue on y. Or pie if categorical.
- `WorkloadRhythmChart.vue` — line/bar overlaid: order count (line, left y-axis) + payment count (bar, right y-axis or same scale); x = hours 0–23. Compare overlay optional.

**Reusable utilities**:
- `RevenueDeltaBadge.vue` — component: current € | compare € | delta (green/red up/down arrow) | % change.
- `RevenueLoadingState.vue` — skeleton loaders for all major sections.

---

## H. Types (mirror daily-ops pattern)

Create `types/daily-ops-revenue.ts` with:

```typescript
export type DailyOpsRevenuePeriodId = 
  | 'today' | 'yesterday' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7'
  | 'this-week' | 'last-week' | 'wtd' | 'last-7d'
  | 'this-month' | 'last-month' | 'mtd' | 'last-30d'
  | 'q1' | 'q2' | 'q3' | 'q4' | 'last-q' | 'qtd'
  | 'spring' | 'summer' | 'autumn' | 'winter'
  | 'this-year' | 'last-year' | 'ytd' | 'last-365d'
  | 'last-14d' | 'last-60d' | 'last-90d'
  | 'custom'

export type DailyOpsRevenueCompareKind = 'none' | 'previous' | 'ly' | 'custom'

export type DailyOpsRevenueRange = { startDate: string; endDate: string; label: string }

export interface DailyOpsSimplePnLAssumptions {
  foodCogsPct: number // default 30
  bevCogsPct: number // default 4
  overheadPct: number // default 25
}

export interface DailyOpsSimplePnLDto {
  revenue: number
  foodCogs: number
  bevCogs: number
  laborCost: number
  laborCoverage: { daysFound: number; daysExpected: number; pctComplete: number }
  overhead: number
  result: number
  assumptions: DailyOpsSimplePnLAssumptions
}

export interface DailyOpsRevenueKpiDto {
  revenue: number
  itemsCount: number
  €PerItem: number
  leadSource: 'inbox-basis' | 'bork-api' | 'unknown'
  currentLabel: string
  compareDelta?: { €: number; pct: number }
  compareLabel?: string
}

export interface DailyOpsRevenueLocationDto {
  locationId: string
  locationName: string
  revenue: number
  itemsCount: number
  €PerItem: number
  pctOfTotal: number
}

export interface DailyOpsRevenueTimeseriesPoint {
  date: string // YYYY-MM-DD
  revenue: number
  itemsCount: number
}

export interface DailyOpsRevenueTimeseriesDto {
  current: DailyOpsRevenueTimeseriesPoint[]
  compare?: DailyOpsRevenueTimeseriesPoint[]
  compareLabel?: string
}

export interface DailyOpsRollingMediansWindow {
  label: string // '30d', '60d', '90d'
  median: number
  mean: number
  p25: number
  p75: number
}

export interface DailyOpsRevenueRollingMediansDto {
  windows: DailyOpsRollingMediansWindow[]
}

export interface DailyOpsWeekdayPatternRow {
  date: string
  dayOfWeek: string // 'monday', etc
  revenue: number
  itemsCount: number
  compareRevenue?: number
  comparePct?: number
}

export interface DailyOpsHourlyMatrixCell {
  revenue: number
  itemsCount: number
  foodRevenue: number
  drinksRevenue: number
}

export interface DailyOpsHourlyMatrixRow {
  hour: number // 0–23
  weekdays: DailyOpsHourlyMatrixCell[] // 7 cells: Mon–Sun
}

export interface DailyOpsRevenueHourlyMatrixDto {
  rows: DailyOpsHourlyMatrixRow[]
}

export interface DailyOpsRevenueCategoryDto {
  name: string // 'keuken', 'dranken', 'overige'
  revenue: number
  itemsCount: number
  pctOfTotal: number
  byWeekday?: Array<{ dayOfWeek: string; revenue: number }>
}

export interface DailyOpsRevenueProductRow {
  productName: string
  revenue: number
  itemsCount: number
  €PerItem: number
  byWeekday?: Array<{ dayOfWeek: string; itemsCount: number }> // mini-bar data
}

export interface DailyOpsRevenueStaffRow {
  staffName: string
  revenue: number
  orderCount: number
  avgProductsPerOrder: number
  days: number
}

export interface DailyOpsRevenueTableRow {
  tableNum: string
  locationSpace: string // 'bar', 'restaurant', 'terras'
  revenue: number
  coverEstimate?: number
}

export interface DailyOpsOrderPaymentRhythmPoint {
  hour: number // 0–23
  orderCount: number
  paymentCount: number
  orderCountCompare?: number
  paymentCountCompare?: number
}
```

Extend or reference from [`types/daily-ops-dashboard.ts`](types/daily-ops-dashboard.ts) if appropriate (e.g., reuse `VenueStripResponseDto` pattern for consistency).

---

## I. Composables (mirror daily-ops pattern)

- `composables/useDailyOpsRevenuePeriod.ts` — URL state manager for `?period=`, `?anchor=`, `?compareTo=`, `?location=`, `?space=`.
  - Returns `{ period, anchor, compareTo, location, space }` from URL; exposes setter to update all params together.
  - Matches [`composables/useDailyOpsDashboardRoute.ts`](composables/useDailyOpsDashboardRoute.ts) API for consistency.

- `composables/useDailyOpsRevenueMetrics.ts` — parallel data fetchers (one composable per endpoint, or single multi-endpoint version).
  - Exposes `{ summary, pnl, locations, timeseries, rollingMedians, weekdayPattern, hourlyMatrix, categories, products, staff, tables, orderPayment }` as reactive refs.
  - Combines series into overlay data for charts (current + compare overlay helpers).

- `composables/useDailyOpsRevenueCompare.ts` — helper to compute delta badges and overlay series for charts.
  - Returns: `{ deltaLabel, deltaPct, deltaColor, overlayedSeries }`.

- `composables/useDashboardEurFormat.ts` (existing) — reuse for formatting revenue values.

- `composables/useDashboardKpiFormat.ts` (existing) — reuse for formatting KPI cards.

---

## J. Location spaces (bar / restaurant / terras) — hardcoded mapping (confirmed by user)

Add constant in `server/utils/dailyOpsRevenue/locationSpaces.ts`:

```typescript
export const LOCATION_SPACES = {
  bar: {
    id: 'bar',
    name: 'Bar',
    tableNumbers: [99, 100, 101, 102, 103, /* ... */], // tables 100–145 approx (Kinsbergen PDF page 1)
    locationIds: ['69d6cfa63d2adf93b79d1ae7', '69d6cfa63d2adf93b79d1ae6', '69d6cfa73d2adf93b79d1ae8'], // all 3 venues
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    tableNumbers: [1, 2, 3, /* ... 40 */],
  },
  terras: {
    id: 'terras',
    name: 'Terras',
    tableNumbers: [200, 201, /* ... 250 */],
  },
} as const

export function getLocationSpace(tableNum: number | string): keyof typeof LOCATION_SPACES | null {
  // Binary search or map lookup to find which space contains this table
}
```

The `fetchLocationSpace.ts` helper will use this mapping to group `bork_sales_by_table_v2` rows into space buckets.

Rationale: table grouping is operational (physical venue layout) and unlikely to change; hardcoding is simpler than querying Bork metadata every time.

---

## K. Order time vs payment time — for Productivity page (confirmed by user)

**This metric belongs on Productivity page, not Revenue**, because it's a workload/operational indicator.

Implement endpoint in `/api/daily-ops/productivity/order-payment-rhythm`:
- Query: `period`, `anchor?`, `compareTo?`, `location?`
- Response: `Array<{ hour: 0–23, orderCount, paymentCount, orderCountCompare?, paymentCountCompare? }>`

**Implementation** (phased):
1. **Phase 1 (fast):** Use `ticket.Time` (order time) and `ticket.ActualDate`/`ActualTime` (payment approximation).
   - Hour buckets from `bork_sales_by_hour_v2` = order time (current approach).
   - Payment count = count of `bork_raw_data` tickets where `ActualDate.hour` falls in the hour window (via re-parse on demand or cached pass).
   - Works immediately; payment time is approximate (assumes ticket close ≈ payment time).

2. **Phase 2+ (if needed):** Inspect `bork_raw_data` `Paymodes[].Date` field. If Bork includes payment timestamps per payment method, parse into new `bork_payments_by_hour_v2` collection, then read from that instead.

UI: on Productivity page, new tab "Workload" with two overlaid series (line + bar or both bars):
- Order count (line, primary y-axis): "when did we take orders?" (peak workload pre-delivery).
- Payment count (bar, secondary y-axis or same scale): "when did we conclude payments?" (back-office load).
- Both series can show compare overlay if compareTo is active.

Rationale: order vs payment rhythm is operational (when staff is busiest) not revenue strategy.

---

## L. Phasing (so we don't try to do everything at once)

## L. Phasing (so we don't try to do everything at once)

1. **Phase 1 — Foundations**: period/compare resolver (`utils/dailyOpsRevenuePeriod.ts`), types (`types/daily-ops-revenue.ts`), `useDailyOpsRevenuePeriod` composable, `RevenuePage.vue` skeleton with tab structure + filter bar. No data APIs yet.

2. **Phase 2 — Overview tab**: Endpoints: `summary`, `pnl`, `locations`. Components: KPI strip, PnL card, location pie, location table, filter bar wired.

3. **Phase 3 — Trends tab**: Endpoints: `timeseries`, `rolling-medians`, `weekday-pattern`. Components: timeseries chart, rolling medians card, weekday table.

4. **Phase 4 — Hourly & Mix tab**: Endpoints: `hourly-matrix`, `categories`, `products`. Components: hourly heatmap, hourly category stack, category pie, product top-20 table.

5. **Phase 5 — Per-Dimension tab**: Endpoints: `per-location-space`, `per-staff`, `per-table`, `order-payment-rhythm`. Components: dimension tabs (by-day / by-hour / by-staff / by-table / by-space), workload rhythm chart.

6. **Phase 6 — Productivity page wiring**: Add endpoints to `/api/daily-ops/productivity/*` (mirror revenue endpoints). Add Workload tab to Productivity page. Fix `variant="productivity"` routing bug in `pages/daily-ops/productivity.vue`.

7. **Phase 7 — Snapshot extensions** (optional): Add snapshot section writers for products/hours/tables/workers. Flip read paths to snapshot-first with V2 aggregate fallback.

8. **Phase 8 — Co-occurrence** (if time permits): Basket pair analysis; decide V2 hour-product vs raw-ticket parse approach.

Each phase ships independently with a clean commit.

---

## M. Decisions locked by user

✅ **Split vs single page**: **1 page with internal tabs** (not 5 subroutes).
✅ **Compare scope**: **Single LY compare only** (not multi-overlay LY + 2Y).
✅ **Staff/table revenue placement**: **Move to Productivity page** (not revenue).
✅ **Order vs payment timing**: **Move to Productivity page** (workload indicator, not revenue strategy).
✅ **Location spaces**: **Hardcoded bar / restaurant / terras** (not dynamic from Bork).
✅ **Architecture**: **Mirror daily-ops pattern** (metadata headers, types, composables, utils, registry where needed).

Remaining open (decide anytime before Phase 1):
- ✅ **Seasons**: **Dutch meteorological** (Lente Mar–May / Zomer Jun–Aug / Herfst Sep–Nov / Winter Dec–Feb). Labels in Dutch.
- Custom date picker UX: pills + popover, or full popover?
- Snapshot extension timing: ship with V2 aggregates (faster) or block on snapshot writers?

---

## N. Out of v1 (revisit later)

- Weather overlay (PDFs include it; cool but out of user's ask).
- Forecasting model (PDFs use LY ± %; we can mimic cheaply later).
- Multi-tenant assumptions (per-location PnL %), beyond a single global override.
- Bork product master enrichment (allergen / supplier) for product mix drilldown.

---

## O. Risk & dependencies

- **Registry**: `function-registry.json` has **no protected revenue files** today, so we can move fast. New revenue utils will be tagged with metadata headers but not registry-locked (touch_again: true initially).
- **Existing helpers**: `dailyOpsDashboardMetrics.ts` and `dailyOpsVenueStrip.ts` are flagged in workspace rules. We only **import** them (e.g., `fetchInboxBasisRevenueTotalExVat`, `BORK_DOC_REVENUE_EXPR`); we do **not** modify them in v1.
- **Productivity wiring bug**: `pages/daily-ops/productivity.vue` doesn't pass `variant="productivity"` to `DailyOpsHomeDashboard`. Fix in Phase 6 when we wire the workload content.
- **Anchor consistency**: Register-day boundary is **08:00 Amsterdam** (keep using `amsterdamOpenRegisterBusinessDateYmd` everywhere); **no** UTC midnight mixing.
- **Agent-rules compliance** (RULE #0.5): After creating/modifying data-fetch or API endpoints, check the dev terminal for Nuxt build errors immediately.
- **Metadata headers** (RULE #11): All files in `server/utils/dailyOpsRevenue/` must include the header with `@exports-to` listing dependent composables/APIs. Update `@last-modified` on each touch. Small commits per feature chunk (RULE #10).

---

✅ **Date picker UX**: **Full popover** (single date-range picker, replace pills entirely).
✅ **Snapshot timing**: **Build snapshot writers first** (products/hours/tables/workers sections), then read from snapshots in Phase 1–5 APIs. Matches ADR-004.

---

## P. Adjusted phasing (snapshots first)

Since we're building snapshots first (ADR-004 alignment), the real sequence is:

**Phase 0 (prep)** — Snapshot section writers:
- `server/utils/dailyOpsSnapshot/buildRevenueHourlySection.ts` — 24 hourly slots per day (revenue, items, food, drinks per hour).
- `server/utils/dailyOpsSnapshot/buildRevenueProductsSection.ts` — top-N products, category breakdown per day.
- `server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts` — per-table revenue + turnover proxy per day.
- `server/utils/dailyOpsSnapshot/buildRevenueWorkersSection.ts` — per-worker revenue / orders / avg items per day.
- Register these in `dailyOpsSnapshotService.ts` so they're triggered after Bork rebuild + Eitje rebuild.
- Seed collections: `daily_ops_snapshot_section_revenue_hourly`, `_products`, `_tables`, `_workers` (new; match pattern of existing `_revenue`, `_labor`).

**Phase 1** — Foundations (now read from snapshots):
- Types, period resolver, composables, page skeleton.
- Data layer now reads `daily_ops_snapshot_section_*` first, falls back to V2 aggregates.

**Phases 2–5** — Component delivery (tabs + charts), all reading from Phase 0 snapshots.

This adds 1–2 days prep but ensures day-1 correctness per ADR-004.

---

## Q. Ready to launch Phase 0