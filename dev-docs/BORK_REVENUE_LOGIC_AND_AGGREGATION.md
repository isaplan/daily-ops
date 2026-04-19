# Bork revenue logic, aggregation, and alignment with the register

This document captures how we **want** revenue to behave (register and finance), how **just-daily-ops-platform-V2** approached the same problem, how **daily-ops** builds Bork aggregates today, and what to improve.

Related: `DEBUG_BUSINESS_HOUR_MAPPING.md` (April 2026 hour-by-hour CSV vs DB investigation).

---

## 1. Our business logic (register-first)

These rules are the reference for “correct” **guest revenue** and reconciliation with checkout / CSV:

1. **Business day**  
   The register closes the previous period and starts fresh at **06:00**. The meaningful “day” for reporting is **06:00 through 05:59** the next calendar morning (not naive midnight-to-midnight calendar day unless we explicitly choose that for a given report).

2. **Revenue is recognized when the sale is closed, not when lines are typed**  
   An order that spans clock days is **not** full revenue for an earlier day **until the ticket is settled** (paid / closed the way the POS defines it). Open guest tabs contribute **when they are paid**, in line with how the register attributes money.

3. **Internal consumption is not guest revenue**  
   **Huisbon** (and similar) represents staff / house consumption: food and drink for personnel, **not** a sale to a guest. It should not be mixed into **guest revenue** totals used for financial or “register truth” views. It may still exist in raw data for operational or audit purposes.

4. **Guest vs internal**  
   Long-running flows (open guest, house accounts, internal routes) are exactly where **API snapshots** can show the **same** ticket or lines on **many** consecutive `ticket/day.json` pulls until the system considers them closed or drops them from the export. Normal, **closed** guest checks should not behave like that in principle; in practice the integration must enforce **one logical line → one count** for revenue rolls.

6. **Open ticket sentinel from register vendor (critical)**  
   Vendor confirmation: an **open ticket** has `Ticket.ActualDate = 10101` (no close date yet).  
   - Open table: opened today, expected to close today.  
   - Open bar tab: may open on an earlier day and close in the future.  
   For daily revenue, these open tickets must be **ignored until closed**.

5. **One atomic fact, many rollups**  
   A single settled **order line** (amount, time, table, worker, product, location) can be **aggregated** into hour, table, worker, product, and day totals. Those are different `GROUP BY` keys over the **same** deduplicated facts—not five independent copies of reality.

---

## 1b. Conclusions we align on (implementation targets)

### 1) Map business day and hours ↔ ISO date and hours

ISO (calendar date + wall-clock hour) is what APIs and timestamps give you. The register thinks in **business coordinates**. Use **one explicit mapping** (single module / pure functions) so nothing argues in the codebase:

- **Input:** local timestamp or `(iso_date, iso_hour)` from Bork (`ticket.Time`, payment time, etc.).
- **Output:** `(business_date, business_hour)` where `business_hour` is **0–23**: hour 0 = 06:00–06:59, …, hour 17 = 23:00–23:59 on the same calendar date as the start of that business day segment, hours **18–23** = 00:00–05:59 on the **next** calendar morning (still part of **yesterday’s** business day).

**Inverse:** for charts or debugging “what ISO window is business hour 18 yesterday?”, the same module returns the local ISO range. Users see “yesterday” and “hour 18” in **business** terms; labels can show the underlying ISO span when useful.

Timezone: map in **venue local** time, not server UTC, unless we explicitly fix everything to UTC with a named offset.

### 2) Store both coordinate systems on every slice

Every aggregated row (or future fact row) should carry **both**:

| Field | Meaning |
|--------|--------|
| `business_date` | Register day id (YYYY-MM-DD of the business day that **started** at 06:00). |
| `business_hour` | 0–23 within that business day. |
| `iso_date` | Calendar date from the event (from Bork line/ticket/payment as defined). |
| `iso_hour` | 0–23 wall-clock hour for that same instant (or derive from full timestamp). |

**Why:** finance and CSV match **business_day**; Bork debugging and support match **iso_***. No silent mixing: same slice, two labels.

### 3) When a business day is concluded

A business day is **closed for reporting** when:

- **Operational closure:** the period 06:00–05:59 for that `business_date` has ended (clock-wise).
- **Financial closure:** totals are **fixed** for that day using rules you trust: e.g. **daily report** (email/PDF/CSV import), Z-report, or register export—**not** merely “API sync ran.” API raw data can be late or wrong; the **closed-day total** can be anchored on the imported daily report while slices are reconciled or scaled to it.

Until payment/settlement rules are applied, “concluded” for **revenue** means: lines that count as guest revenue for that business day are settled per POS rules (see §1.2–1.3). Open tabs belong to a day only when paid/closed per those rules.

### 4) References so slices tie to one business day

Use a **stable business-day key** everywhere:

- Prefer **`business_date`** (and `location_id`) as the foreign key for “this hour / this table / this worker / this product roll-up belongs to **this** register day.”
- Optional: explicit **`business_day_id`** if we ever need a surrogate (e.g. UUID per venue+day).
- **Slice references:** hourly rows should be joinable to the same `business_date` + `location_id` as cron/day totals; worker/table/product breakdowns should repeat the same `business_date` (and iso fields for audit) so sums over slices reconcile to the day total after dedup and revenue rules.

**Silo rule (raw):** for API-driven rolls, prefer building a day from **one raw silo per venue per fetch day** plus paid/internal rules, or dedupe keys—see §4—so slices are partitions of one pool, not stacked snapshots.

### 5) Optional: one “fat” hourly document per location

Instead of (or in addition to) separate collections for hour / table / worker / product, we can store **one document per** `(location, business_date, business_hour)` containing:

- `total_revenue`, `record_count`
- nested or embedded arrays: **workers** (id, name, revenue), **tables** (table nr, revenue), **products** (key, name, qty, revenue)
- still include **`iso_date` / `iso_hour`** range metadata for that bucket if useful

**Pros:** one query for “everything in this business hour”; easier mental model. **Cons:** large documents, more complex partial updates, versioning if schema evolves. A middle path is keeping **normalized** hour rows plus **materialized** “hour summary” docs for the UI.

### 6) `bork_business_days` — parent row per location per business day

Not required for pure math (slices can still sum on `location_id` + `business_date` alone), but **recommended** once register days are first-class and daily reports are imported.

**Purpose:** one canonical document per `(unified_location_id, business_date)` that anchors the day: status, optional **financial truth** from email/PDF/CSV, and reconciliation against API-derived totals.

**Suggested identity and keys**

- Natural key: **`location_id`** + **`business_date`** (YYYY-MM-DD of the business day that **started** at 06:00).
- Optional: **`_id`** as `business_day_id` referenced from child docs if we want a single ObjectId join.

**Typical fields (evolve as we implement)**

| Field | Role |
|--------|------|
| `location_id`, `location_name` | Unified venue |
| `business_date` | Register day id |
| `status` | e.g. `open`, `closed_clock`, `report_received`, `reconciled`, `locked` |
| `reported_total_revenue` | From daily report import (trusted closed-day guest revenue when applicable) |
| `aggregated_total_revenue` | Sum from API rebuild path (after dedup + rules) |
| `variance` | `reported - aggregated` (or null until both exist) |
| `report_import_id` / `source` | Link to Gmail parse job or file id |
| `closed_at` / `reconciled_at` | Audit timestamps |
| `iso_range_note` | Optional human-readable span of local ISO coverage for that business day |

**How children link**

- Hour / table / worker / product slices keep **`location_id + business_date`** (same as parent). Optionally add **`business_day_id`** pointing at `bork_business_days._id` for strict references.
- Queries: “all hours for this day” = filter slices by `business_date` + `location_id`; “day header” = one row in `bork_business_days`.

**Why not only slice collections?** Parent row gives a single place for **imported closed totals**, **variance**, and **workflow state** without scanning 24 hour buckets or aggregating on the fly.

---

## 2. What we documented in just-daily-ops-platform-V2

The V2 repo separates **revenue (checkout match)** from **operational (what was ordered)** and applies strict business rules. See `just-daily-ops-platform-V2/docs/sales-aggregation-services.md` and:

- **`sales-revenue-aggregation.service.ts`** (payment / checkout alignment)  
  - Uses **payment-oriented** grouping for CSV-style revenue (`Order.ActualDate` + time in the checkout window, per their doc).  
  - **Only counts orders with payments** (`Paymodes` present).  
  - **Excludes internal** transactions via product/group name keywords (e.g. `huisbon`, `personeelstafel`, `personeelsmaaltijd`, `staff meal`, `employee meal`). Extend as needed for Dutch variants like `personeelsbon` if not already covered.

- **`sales-daily-aggregation.service.ts`** (operational)  
  - Groups more by **when the order happened** (ticket/order semantics per their implementation).  
  - Again: **paid** tickets, **exclude internal** products, flag unclassifiable cases.

Takeaway for daily-ops: **guest revenue** that must match the register/CSV should gate on **settlement / Paymodes**, exclude **internal** lines, and use the **same business-day window** as checkout. Operational “what was sold” can remain a separate track if the product needs both.

---

## 3. How daily-ops aggregation works today

**Source:** `server/services/borkRebuildAggregationService.ts`  
**Input:** All documents in `bork_raw_data` with `endpoint: 'bork_daily'` (each doc is roughly one Bork `ticket/day.json` fetch per venue per requested calendar day, keyed by `syncDedupKey`).

**Process (simplified):**

1. Stream **every** `bork_daily` raw document (full collection scan for each rebuild range).

2. For each ticket, for each **order**, for each **line**:  
   - Keep orders whose bookkeeping date `order.Date || order.ActualDate` (YYYYMMDD) falls in the rebuild’s **inclusive date range**.  
   - **Hour** comes from **`ticket.Time`** (not `order.Time`).  
   - **Calendar date** on aggregate rows is derived from that order date (`dateStr`).  
   - **Register-oriented fields:** each hour/table/worker/guest document also gets **`business_date`** and **`business_hour`** (06:00–05:59 register day mapping).

3. **Rollups** (in-memory maps, then insert):  
   - **`bork_sales_by_cron`** — location + calendar `date`, sums all lines.  
   - **`bork_sales_by_hour`** — location + calendar `date` + `hour` (+ `business_date` / `business_hour`), nested products.  
   - **`bork_sales_by_table`** — same, only if `order.TableNr` is non-empty.  
   - **`bork_sales_by_worker`** — same + unified worker.  
   - **`bork_sales_by_guest_account`** — orders **without** table; uses `ticket.AccountName`.  
   - **`bork_products_master`** — product catalog merge.

4. **Location / user names** come from `bork_unified_location_mapping` and `bork_unified_user_mapping`. Unmapped locations are skipped with a warning.

**Important:** The current rebuild **does not**:

- Require **`Paymodes`** / paid settlement before counting revenue.  
- **Exclude** huisbon / personeel-style internal lines by keyword or account class.  
- Exclude **open tickets** via `Ticket.ActualDate === 10101`.  
- **Deduplicate** lines across raw documents (same `Order.Key` / `Line.Key` appearing in many daily snapshots is summed **once per snapshot appearance**).

That gap explains inflated hour totals and impossible transaction counts when compared to CSV or register logic: the same logical lines are **added repeatedly**, and **internal** flows are **included** in the same buckets as guest sales unless filtered elsewhere in the app.

Register-vendor clarification (Apr 2026): when `Ticket.ActualDate = 10101`, ticket/orders are still open and should not count yet. This was a major source of drift during validation.

---

## 4. How we can improve (direction)

Align implementation with §1, §1b, and §2 in this order:

0. **Dual coordinates and keys (§1b)**  
   Central mapper business ↔ ISO; persist `business_date`, `business_hour`, `iso_date`, `iso_hour` on slices; use `business_date` + `location_id` as the tie-in for all roll-ups; define “concluded” day with daily imports where needed.

0b. **`bork_business_days` (§1b.6)**  
   Upsert one parent document per `(location_id, business_date)`; store status, optional `reported_total_revenue` from imports, `aggregated_total_revenue` from API path, variance; child slices optionally reference `business_day_id`.

1. **Open-ticket gate first (vendor rule)**  
   Exclude tickets with `Ticket.ActualDate === 10101` from daily revenue aggregation. Include only after closure (non-`10101` ActualDate).

2. **Dedup or canonical source per venue per day**  
   Before aggregating revenue, either: only ingest **one** authoritative snapshot per `(location, calendar fetch day)`, or scan all raw docs but **count each unique line once** (stable key: e.g. `locationId` + `TicketKey` + `Order.Key` + `Line.Key` or Bork’s own keys), keeping the **newest** or **closed** state if the API exposes it.

3. **Two tracks (like V2)**  
   - **Revenue / register track:** paid-only (`Paymodes`), internal excluded, business-day window matching checkout (06:00–05:59), attribution per agreed field (`ActualDate` + time vs payment time—confirm with CSV spec).  
   - **Operational track (optional):** ordered-by-hour, still with clear rules for open tabs so dashboards are not confused with finance.

4. **Internal exclusions**  
   Match and extend V2 keyword lists; add account-name patterns where Bork puts **huisbon** / **personeelsbon** on `AccountName` rather than product name.

5. **Close-day attribution policy (open tabs/tables)**  
   Confirm and implement whether revenue for previously open tickets should be attributed to the **close/settlement day** (register behavior), not historical order-entry dates. This especially impacts bar tabs spanning multiple days.

6. **Optional storage shape (§1b.5)**  
   Evaluate a single hourly document per location with nested workers, tables, and products vs current split collections; trade-off is query simplicity vs update size.

7. **Validation**  
   Re-run comparisons like `DEBUG_BUSINESS_HOUR_MAPPING.md` after each change; keep a small set of **golden days** (CSV + expected totals) in CI or a script.

8. **Documentation sync**  
   When aggregation rules change, update this file and the metadata header on `borkRebuildAggregationService.ts` (`@last-modified`, `@last-fix`, `@exports-to` dependents).

---

## 5. Summary table

| Topic | Register / finance intent | V2 approach | daily-ops today |
|--------|----------------------------|------------|-----------------|
| Guest revenue timing | Closed / paid in business day | Paymodes + checkout window rules | All lines on order date, no Paymodes gate |
| Open ticket handling | Ignore while open (`Ticket.ActualDate = 10101`) | Intended in rules; must be explicit in code path | Not applied in current rebuild baseline |
| Internal (huisbon, etc.) | Not guest revenue | Exclude by product/group keywords | Not excluded in rebuild |
| Business day | 06:00–05:59 | Documented checkout window | `business_date` / `business_hour` on hour/table/worker/guest docs; cron keys still calendar `dateStr` from order; central mapper + `iso_*` on every slice is the target (§1b) |
| ISO vs business | Map once; store both on each slice | Per service | Partial: business fields added; full dual-coordinate + concluded-day import not done |
| Slice tie-in | All slices share `business_date` + location | N/A | To align explicitly (§1b.4); optional `bork_business_days` parent (§1b.6) |
| Day concluded | Clock end + financial anchor (daily report) | Checkout / import | Not formalized in pipeline |
| Parent per business day | One row per location + business day for status + reconciliation | N/A | Proposed: `bork_business_days` (§1b.6); not implemented yet |
| Duplicate lines across API days | Must not multiply revenue | Incremental / rules in services | Full scan; no cross-doc dedup |
| Hour bucket | Business hour after mapping | Per service | `ticket.Time` + `calendarToBusinessDay` for `business_*`; primary hour key still calendar-derived in places |

---

## 6. V2 rebuild from raw (operations)

`rebuildBorkSalesAggregationV2` **reads** `bork_raw_data` (`endpoint: bork_daily`) and **writes only** `bork_sales_hours` and `bork_business_days`. It does **not** insert, update, or delete raw documents.

- **Script:** `scripts/rebuild-bork-v2-date-range.ts` — default window is **last two calendar months** (UTC); override with `BORK_V2_START` / `BORK_V2_END` (YYYY-MM-DD). Requires **`BORK_V2_REBUILD_CONFIRM=1`**. Optional **`BORK_AGG_V2_SUFFIX`** (e.g. `_test`) targets alternate collection names.
- **Example:** `BORK_V2_REBUILD_CONFIRM=1 node --experimental-strip-types scripts/rebuild-bork-v2-date-range.ts`
- **CSV vs V2 table in DEBUG:** after a rebuild, refresh `DEBUG_BUSINESS_HOUR_MAPPING.md` daily section with `node --experimental-strip-types scripts/compare-bork-daily-omzet-csv.ts` (uses `omzet-per0dag-per-locatie-2025-2026.csv`).

---

*Last updated: 2026-04-18 — §6 V2 rebuild ops (rebuild-bork-v2-date-range, compare-bork-daily-omzet-csv).*
