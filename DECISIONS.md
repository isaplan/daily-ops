# Architecture Decision Records (ADR)

Append-only log of locked decisions. When changing behavior that contradicts an ADR, add a new ADR that supersedes the old one — do not edit history in place.

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md)

---

## ADR-001 — Members are SSOT for current compensation

**Status:** Accepted (2026-05-16)

**Context:** `GET /api/members/[id]` fell back to `inbox-eitje-contracts` when `cost_per_hour` was missing, creating two display truths.

**Decision:** `members` holds current `contract_type`, `hourly_rate`, `cost_per_hour` (denormalized from the latest open revision). APIs and UI read compensation from `members` only. Inbox contract rows are input/audit, not a runtime fallback.

**Consequences:** Missing rates return `compensation_status: 'missing'`. Eitje staff hub shows a dedicated block for members missing compensation data.

---

## ADR-002 — Forward-only effective dating (detection date)

**Status:** Accepted (2026-05-16)

**Context:** Eitje does not expose reliable metadata for when a wage change took effect in the past.

**Decision:** New revisions use `effective_from = contract_start_date` from the import row when present, else `importedAt` (detection date). No retroactive rebuild of `eitje_time_registration_aggregation` or `daily_ops_snapshot*` in v1.

**Consequences:** Historical labor cost in snapshots reflects rates known at aggregation time. Manual “effective from date X” with scoped rebuild is deferred (see ROADMAP).

---

## ADR-003 — `members.unified_user_id` is the canonical cross-system FK

**Status:** Accepted (2026-05-16)

**Context:** Fuzzy matching (`support_id`, name, `eitjeIds`) caused duplicate resolution paths and partial joins.

**Decision:** Every `members` document should store `unified_user_id` (ObjectId → `unified_user._id`). Aggregation and cross-system features use this FK first; fuzzy resolution is admin/repair-only when FK is null.

**Consequences:** Eitje sync maintains the link. Backfill script seeds existing members.

---

## ADR-004 — Snapshots are the only dashboard read source

**Status:** Accepted (2026-05-16)

**Context:** Live `$lookup` pipelines on each dashboard load were slow and inconsistent.

**Decision:** Daily Ops home and bundle metrics read `daily_ops_snapshot` + `daily_ops_snapshot_section_*` only. UI performs no aggregation math on raw or inbox collections.

**Consequences:** Snapshot rebuilds are event-driven (Bork/Eitje sync, inbox seal). Writers never read raw collections.

---

## ADR-005 — Idempotent compensation revisions

**Status:** Accepted (2026-05-16)

**Context:** Re-importing the same contract CSV must not spam revision history.

**Decision:** Open a new revision only when `contract_type`, `hourly_rate`, or `cost_per_hour` (material fields) change vs the latest open revision.

**Consequences:** `materialFieldsChanged()` guard in `server/utils/memberCompensationRevisions.ts`.
