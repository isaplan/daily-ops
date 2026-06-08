# Revenue Nav + Filter V2 — Build Plan

**Branch:** `feat/revenue-nav-v2`  
**Status:** Planning (2026-06-08)  
**Goal:** Replace revenue analytics dropdown filters with a two-tier tab nav (mode + child period), venue bar, and compare mode — behind a V2 toggle so V1 stays switchable.

**Constraints:** ADR-004 (snapshot-only GET), ADR-010 (register business day for “today”), no monoliths (~150 lines/file target), match `DailyOpsDashboardShell` nav styling, metadata headers + `function-registry.json`.

---

## 1. Current state

| Layer | V1 today |
|-------|----------|
| Page | `pages/daily-ops/revenue.vue` → `RevenuePage.vue` |
| Filter nav | `RevenueAnalyticsNav.vue` — location, space, **5 `<select>` period groups** |
| Period SSOT | `utils/dailyOpsRevenueAnalyticsNav.ts`, `utils/dailyOpsRevenuePeriod.ts`, `types/daily-ops-revenue.ts` |
| Route state | `composables/useDailyOpsRevenueAnalyticsPeriod.ts` (query: `period`, `location`, `space`, `compare`) |
| Content tabs | Dutch labels: Overzicht, Trends, Uur & Mix, Ruimtes |
| Data | `/api/daily-ops/revenue/*` — snapshot-backed (ADR-004) |

**Pain:** Period UX is opaque (many selects); compare is limited; child options don’t match mental model (daily vs weekly vs menu).

---

## 2. Target UX (V2)

```
┌─ Daily Ops section nav (unchanged) ─────────────────────────────┐
│ Daily Ops | Revenue | Productivity | …                          │
└─────────────────────────────────────────────────────────────────┘
┌─ Mode tabs (NEW primary bar) ─────────────────────────────────┐
│ Daily | Weekly | Monthly | Quarterly | Yearly | Seasonal | Menu | Period │
└─────────────────────────────────────────────────────────────────┘
┌─ Child tabs (contextual) ───────────────────────────────────────┐
│ [mode-specific pills + optional picker/dropdown]                │
└─────────────────────────────────────────────────────────────────┘
┌─ Venue bar (unchanged layout) ──────────────────────────────────┐
│ All | VKB | BEA | LAT  (+ space row when venue selected)        │
└─────────────────────────────────────────────────────────────────┘
┌─ Compare toggle ────────────────────────────────────────────────┐
│ Compare off → single selection | Compare on → multi-select child tabs │
└─────────────────────────────────────────────────────────────────┘
┌─ Content tabs (English) ────────────────────────────────────────┐
│ Overview | Trends | Hourly & Mix | Spaces                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Child tab specs

| Mode | Child options | Extra control |
|------|---------------|---------------|
| **Daily** | Today, Yesterday, Sat…Mon (rolling register days) | Date picker (register business_date) |
| **Weekly** | This week, Last week, 2w ago, 3w ago | — |
| **Monthly** | This month, Last month, + last 10 month pills | Dropdown: last 12 months (Mon YYYY) |
| **Quarterly** | Q1–Q4 current year, Last quarter | — |
| **Yearly** | This year, Last year, 2y ago | — |
| **Seasonal** | Spring, Summer, Autumn, Winter | Year selector (current + prior) |
| **Menu** | All, Drinks, Food, last 4 menus (newest first) | Menu selector (older menus) |
| **Period** | Last 7d, 14d, 28d, 6w, 12w, 24w, 12m | Granularity: day / week / month (chart bucket) |

**Compare mode:** When enabled, child tabs become multi-select (max 4–6); API receives `compare[]` or repeated query keys; charts/tables show side-by-side or overlaid series.

---

## 3. Architecture decisions (propose ADR-011)

1. **V2 is opt-in** via `runtimeConfig.public.revenueNavVersion: 'v1' | 'v2'` (default `v1` until stable). `DailyOpsDashboardShell` renders `RevenueAnalyticsNav` **or** `RevenueAnalyticsNavV2`.
2. **URL is SSOT** for nav state — same pattern as dashboard: `?mode=daily&slot=today&location=…&compare=1&pick=2026-06-07`. Deep-linkable, refresh-safe (SPA).
3. **Period resolution is pure functions** — new `utils/dailyOpsRevenueNavV2/` (no Vue): `resolveRevenueNavV2Query()` → `{ startDate, endDate, bucket, compareRanges[] }`. Reuse `amsterdamOpenRegisterBusinessDateYmd()` for “today”.
4. **GET stays snapshot-only** — V2 only changes query → date-range mapping; no new raw Bork reads on page load.
5. **No monolith** — one component per bar (`RevenueNavModeTabs`, `RevenueNavChildDaily`, …); composable `useDailyOpsRevenueNavV2()` orchestrates.

---

## 4. File plan (new / touch)

### 4.1 New (V2 module)

| File | Role |
|------|------|
| `types/daily-ops-revenue-nav-v2.ts` | `RevenueNavMode`, child slot ids, compare types |
| `utils/dailyOpsRevenueNavV2/modes.ts` | Mode + child option definitions |
| `utils/dailyOpsRevenueNavV2/resolveRange.ts` | Query → `{ startDate, endDate, bucket }` |
| `utils/dailyOpsRevenueNavV2/monthOptions.ts` | Last 12 months labels |
| `utils/dailyOpsRevenueNavV2/menuOptions.ts` | Fetch menu list shape (client calls API) |
| `composables/useDailyOpsRevenueNavV2.ts` | Route read/write, compare state |
| `components/daily-ops/revenue/nav-v2/RevenueAnalyticsNavV2.vue` | Shell: stacks mode + child + venue + compare |
| `components/daily-ops/revenue/nav-v2/RevenueNavModeTabs.vue` | Primary mode bar |
| `components/daily-ops/revenue/nav-v2/RevenueNavChildBar.vue` | Dispatches to mode-specific child |
| `components/daily-ops/revenue/nav-v2/child/*.vue` | One file per mode (daily, weekly, …) |
| `components/daily-ops/revenue/nav-v2/RevenueCompareToggle.vue` | Compare on/off |
| `components/daily-ops/revenue/RevenuePageV2.vue` | Optional wrapper; or flag inside `RevenuePage.vue` |

### 4.2 Touch (minimal)

| File | Change |
|------|--------|
| `components/daily-ops/DailyOpsDashboardShell.vue` | `v-if` V1 vs V2 nav on revenue route |
| `components/daily-ops/revenue/RevenuePage.vue` | English content tab labels; accept V2 period from composable |
| `composables/useDailyOpsRevenueAnalyticsPeriod.ts` | Delegate to V2 resolver when flag on |
| `nuxt.config.ts` | `revenueNavVersion` public runtime flag |
| `DECISIONS.md` | ADR-011 Revenue Nav V2 |

### 4.3 Do not touch (V1 frozen)

- `RevenueAnalyticsNav.vue` — keep until V2 sign-off
- Existing `/api/daily-ops/revenue/*` handlers — extend query parsing only if needed

---

## 5. Styling SSOT

Reuse patterns from `DailyOpsDashboardShell.vue`:

```txt
nav bar:  scrollbar-hide inline-flex … rounded-md border-2 border-gray-900 bg-white p-1
active:   bg-gray-900 text-white
inactive: text-gray-700 hover:bg-gray-100
pills:    px-3 py-1.5 text-sm font-semibold
```

Child bar sits **below** mode bar, same visual weight. Compare toggle: outline button right-aligned above venue bar.

---

## 6. Phased delivery

### Phase A — Foundation (no UI visible)

- [ ] ADR-011 draft in `DECISIONS.md`
- [ ] `types/daily-ops-revenue-nav-v2.ts`
- [ ] `resolveRange.ts` + unit tests for each mode (Amsterdam TZ fixtures)
- [ ] `useDailyOpsRevenueNavV2.ts` — URL sync only
- [ ] Feature flag in `nuxt.config.ts` (default `v1`)

**Exit:** `resolveRevenueNavV2Query({ mode:'daily', slot:'today' })` → correct register `business_date`.

### Phase B — Nav chrome (flag `v2`, data still V1 APIs)

- [ ] `RevenueAnalyticsNavV2.vue` + mode/child/venue/compare components
- [ ] Wire shell toggle
- [ ] English content tabs in `RevenuePage.vue`
- [ ] Child bars: Daily, Weekly, Monthly first (80% traffic)

**Exit:** V2 nav renders; changing tabs updates URL; existing charts load with mapped period.

### Phase C — Remaining modes + compare

- [ ] Quarterly, Yearly, Seasonal, Menu, Period child bars
- [ ] Compare multi-select + `compareRanges[]` in composable
- [ ] API: ensure `timeseries.get` / `summary.get` accept compare array (or sequential fetches client-side for v2.0)

**Exit:** All modes navigable; compare shows 2+ series on Overview/Trends.

### Phase D — Menu mode data

- [ ] `GET /api/daily-ops/revenue/menus` — last N menu versions (snapshot or menu collection)
- [ ] Menu child bar + selector

### Phase E — Polish + cutover

- [ ] Mobile: horizontal scroll on child bars (`overflow-x-auto overscroll-x-contain`)
- [ ] Default flag → `v2` on staging; soak test
- [ ] Remove V1 nav after approval (separate PR)

---

## 7. API / data notes

- **Daily “today”** → open register `business_date` (ADR-010), not ISO calendar.
- **Sealed days** → disk bundle cache OK (ADR-008); today → `no-store`.
- **Menu mode** may need snapshot section `revenueProducts` or menu builder collection — confirm SSOT in Phase D spike.
- **Period granularity** (`day|week|month`) affects chart bucket only; totals sum full range.

---

## 8. Future (out of scope — track separately)

**Admin gate + app split** (user’s “last revision”):

- Role: `admin` hides Hours, Sales, Inbox, Eitje/Bork API settings, Design system, Ops alerts, Organisation from default nav.
- Top-level pages: Daily Ops, Revenue, Workforce, Spaces & Tables, Products, Insights — each own route bundle for code-splitting / performance.
- Requires: auth roles ADR, route middleware, sidebar refactor — **not part of Revenue Nav V2**.

---

## 9. Registry + metadata checklist (per phase)

Before each merge chunk:

1. Grep `function-registry.json` for touched paths
2. Update `@last-modified`, `@last-fix`, `@exports-to` on new composables/utils/components
3. Keep files &lt; ~200 lines; split child bars per mode
4. No `console.log` in production paths
5. `pnpm exec nuxi typecheck` after route/composable changes

---

## 10. Open questions (resolve in Phase A)

1. **Daily child order:** Sat→Mon or Mon→Sun? (User spec: “sa fr th we tu mo” — use **Sat first**, register-day labels.)
2. **Compare max selections:** 4 or 6?
3. **Menu SSOT:** `menu/menus` API vs snapshot product sections?
4. **Quarterly child:** calendar quarters vs fiscal?

---

## 11. Success criteria

- [ ] V1 and V2 switchable via env flag without deploy rollback
- [ ] URL reflects full nav state; hard refresh shows same period
- [ ] No GET-time raw Bork/Eitje reads (ADR-004)
- [ ] Child bar matches mode; no orphan selects
- [ ] Content tabs in English
- [ ] Compare works for Daily + Weekly at minimum
