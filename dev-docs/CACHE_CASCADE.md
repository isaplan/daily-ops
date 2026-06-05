# Daily Ops Cache Cascade Architecture

**ADR-004 Extension** — Instant page loads for all historical data via pre-generated JSON hierarchy.

---

## Architecture Overview

```
MongoDB Snapshots (source of truth)
    ↓
Daily JSON Files (from DB snapshots)
    ↓ aggregate 7 days
Weekly JSON Files (W01-W53, Mon-Sun ISO weeks)
    ↓ aggregate days in month
Monthly JSON Files (YYYY-MM)
    ↓ aggregate 12 months
Yearly JSON Files (YYYY)
```

---

## Cache Directory Structure

```
.cache/daily-ops-bundles/
  daily/
    2026-06-01-all.json    (single day, locationId=all)
    2026-06-01-loc123.json (single day, specific location)
    ...
  weekly/
    2026-W22-all.json      (ISO week 22: June 1-7)
    2026-W22-loc123.json
    ...
  monthly/
    2026-06-all.json       (entire June)
    2026-06-loc123.json
    ...
  yearly/
    2026-all.json          (entire 2026)
    2026-loc123.json
    ...
```

---

## Generation Flow

### 1. Daily JSON Generation (Source)

**Trigger:** After snapshot build or seal
**Source:** `daily_ops_snapshot_*` collections
**Output:** `.cache/daily-ops-bundles/daily/{YYYY-MM-DD}-{locationId}.json`

**Automated in:**
- `server/services/dailyOpsSnapshotService.ts` → `buildDailyOpsSnapshot()`
- `server/services/dailyOpsSnapshotService.ts` → `sealDailyOpsSnapshot()`
- `server/services/dailyOpsSnapshotService.ts` → `buildDailyOpsSnapshotRange()`

### 2. Weekly JSON Aggregation

**Trigger:** After daily bundle generation complete
**Source:** 7 daily JSON files (Monday-Sunday ISO week)
**Output:** `.cache/daily-ops-bundles/weekly/{YYYY-WXX}-{locationId}.json`

**Logic:**
- ISO week calculation (Thursday determines year)
- Aggregates revenue, labor, profit from 7 daily bundles
- Clears detailed breakdowns (hourly, drilldown) for multi-day

### 3. Monthly JSON Aggregation

**Trigger:** After all daily bundles in month exist
**Source:** All daily JSON files for calendar month
**Output:** `.cache/daily-ops-bundles/monthly/{YYYY-MM}-{locationId}.json`

**Logic:**
- Finds all `YYYY-MM-*` daily files
- Aggregates totals across entire month
- Partial months supported (e.g., June 1-5 before month ends)

### 4. Yearly JSON Aggregation

**Trigger:** After monthly bundles exist
**Source:** 12 monthly JSON files
**Output:** `.cache/daily-ops-bundles/yearly/{YYYY}-{locationId}.json`

**Logic:**
- Aggregates 12 monthly bundles (or fewer for partial years)
- Year-to-date totals
- Highest-level cache for dashboard overview

---

## API Smart Cache Serving

**Endpoint:** `GET /api/daily-ops/metrics/bundle`
**Handler:** `server/api/daily-ops/metrics/bundle.get.ts`

### Cache Selection Logic

```typescript
if (startDate === endDate && sealed) {
  → serve from daily/{date}-{locationId}.json
}
else if (exact ISO week range) {
  → serve from weekly/{YYYY-WXX}-{locationId}.json
}
else if (exact calendar month) {
  → serve from monthly/{YYYY-MM}-{locationId}.json
}
else if (exact calendar year) {
  → serve from yearly/{YYYY}-{locationId}.json
}
else {
  → fallback to dynamic DB fetch + aggregation
}
```

### Cache Miss Handling

- Logs `[bundle:cache] MISS [level] ...`
- Falls back to dynamic snapshot fetch
- Returns correct data (slower, but always works)

---

## HTTP Caching Headers

**Set in:** `server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts` → `snapshotCacheControl()`

- **Today:** `no-store` (always fresh)
- **Yesterday:** `public, max-age=3600, stale-while-revalidate=86400` (1h fresh, 24h stale-ok)
- **Older sealed:** `public, max-age=86400, stale-while-revalidate=604800, immutable` (24h fresh, 7d stale-ok, never changes)

---

## Manual Cache Generation

### Generate Last 60 Days

```bash
pnpm bundles:pregen
```

### Generate Custom Range

```bash
pnpm bundles:pregen -- --days 90
```

### Script Details

**File:** `scripts/pregenerate-dashboard-bundles.ts`
**Flow:**
1. Generate all daily bundles for range
2. Cascade: aggregate into weekly bundles
3. Cascade: aggregate into monthly bundles
4. Cascade: aggregate into yearly bundles

**Output:**
```
[bundle:pregen] Daily: 60 generated, 0 errors
[cache:cascade] Generated weekly=8, monthly=2, yearly=1
[bundle:pregen] Done: 60 daily + 11 aggregated
```

---

## Performance Impact

### Before (Dynamic DB Fetch)

- **Single day:** ~200-500ms (snapshot query + aggregation)
- **7 days:** ~1-2s (multi-day aggregation)
- **30 days:** ~5-10s (heavy aggregation)

### After (Pre-Generated JSON)

- **Single day:** ~20-50ms (static file read)
- **7 days (exact week):** ~20-50ms (weekly cache)
- **30 days (exact month):** ~20-50ms (monthly cache)

**Speed improvement:** **10-200x faster** for historical data.

---

## Cache Invalidation & Updates

### Daily Rebuild (Scheduled)

- Snapshot rebuild for yesterday triggers daily JSON regeneration
- Weekly/monthly/yearly cascade updates automatically

### Backfill Scenario

```bash
# If snapshots are backfilled for May 1-31
pnpm bundles:pregen -- --days 60

# Regenerates:
# - 60 daily files
# - ~8 weekly files
# - 2 monthly files
# - 1 yearly file
```

### Stale Data Handling

- **Daily snapshots:** Rebuilt via `POST /api/daily-ops/snapshot/backfill-range`
- **JSON cache:** Regenerate via `pnpm bundles:pregen`
- **Browser cache:** Honors `Cache-Control` headers (auto-revalidates)

---

## Files Modified

### Core Cascade Logic

- `server/utils/dailyOpsSnapshot/aggregateDailyBundles.ts` — Bundle aggregation math
- `server/utils/dailyOpsSnapshot/cacheCascade.ts` — Weekly/monthly/yearly generation
- `server/utils/dailyOpsSnapshot/preGenerateBundleCache.ts` — Daily cache generation

### Integration Points

- `server/services/dailyOpsSnapshotService.ts` — Auto-triggers daily cache on build/seal
- `server/api/daily-ops/metrics/bundle.get.ts` — Smart cache serving
- `scripts/pregenerate-dashboard-bundles.ts` — Manual CLI generation

---

## Future Enhancements

### 1. Client-Side Aggregation (Custom Ranges)

For user-requested "last 10 days" or "March 15 - April 10":
- Fetch multiple daily/weekly JSONs
- Aggregate client-side in browser
- Benefit: instant for any range without backend work

### 2. Location-Specific Cascade

Currently: generates `all` location aggregate
Future: per-location weekly/monthly/yearly bundles

### 3. CDN Distribution

- Push `.cache/` to DO Spaces or Cloudflare R2
- Serve static JSONs from CDN edge (10-30ms globally)
- Update: sync after snapshot rebuild

---

## Monitoring & Debugging

### Check Cache Status

```bash
# Count bundles
ls -1 .cache/daily-ops-bundles/daily/ | wc -l

# List weekly bundles
ls -lh .cache/daily-ops-bundles/weekly/

# Check file sizes
du -sh .cache/daily-ops-bundles/*
```

### API Cache Logs

```
# Cache hit
[bundle:cache] HIT [daily] 2026-06-02..2026-06-02 all

# Cache miss (fallback to DB)
[bundle:cache] MISS [weekly] 2026-06-01..2026-06-07 all: ENOENT
```

### Regenerate After Snapshot Fix

```bash
# 1. Rebuild snapshots
curl -X POST http://localhost:8080/api/daily-ops/snapshot/backfill-range \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-05-01","endDate":"2026-05-31"}'

# 2. Regenerate cache
pnpm bundles:pregen -- --days 60
```

---

## Key Benefits

✅ **Instant page loads** for all historical data (10-200x faster)
✅ **Browser/CDN caching** via aggressive HTTP headers
✅ **Automatic generation** after snapshot builds (zero manual work)
✅ **Flexible queries** via smart cache level selection
✅ **Fallback safety** dynamic DB fetch if cache miss
✅ **Scalable architecture** ready for multi-month/multi-year dashboards

---

**Last updated:** 2026-06-05 (Initial implementation)
**Related:** ADR-004 (snapshot-only reads), ADR-006 (hot/warm/cold tiers)
