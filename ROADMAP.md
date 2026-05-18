# Daily Ops — Roadmap

Living list of planned work. Completed items move to git history; do not delete ADRs when shipping.

**Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md) · **Decisions:** [DECISIONS.md](./DECISIONS.md)

---

## In progress — Compensation revisions (branch `feat/member-compensation-revisions`)

| Item | Status |
|------|--------|
| Root architecture docs + ADRs | Shipped on branch |
| `members.compensationHistory[]` + write path | Shipped on branch |
| `members.unified_user_id` + backfill script | Shipped on branch |
| Eitje staff “missing compensation” block | Shipped on branch |
| Member profile compensation timeline | Shipped on branch |
| Aggregation: members-first cost resolution | Shipped on branch |

---

## Planned — Post v1

### Manual effective date + scoped rebuild

Allow ops to set “this rate started on YYYY-MM-DD” on a member revision. On save, re-run `eitje_time_registration_aggregation` for affected `(member, period ≥ date)` and enqueue snapshot rebuild via existing job coalescer.

**Depends on:** ADR-002 superseded or extended with explicit override ADR.

### AI extraction layer

MCP / HTTP tool catalogue over pre-aggregated data (no raw Mongo from the model):

- `getSnapshot(businessDate, locationId)`
- `getMemberCompensationHistory(memberId)`
- `getLaborRollup(startDate, endDate, locationId?)`
- `searchMembers(query)`

Requires short machine-readable dictionary derived from `ARCHITECTURE.md` §3–§5.

### Notes semantic search

Optional vector index on `notes.content` for “find agreements about X” — not required for numeric labor/revenue questions.

---

## Completed (reference)

| Item | ADR / doc |
|------|-----------|
| Daily Ops snapshot collections (`daily_ops_snapshot*`) | ADR-004, `dev-docs/DAILY_OPS_SNAPSHOT_PLAN.md` |
| Bork V2 aggregation with ex/inc VAT fields | `dev-docs/BORK_REVENUE_LOGIC_AND_AGGREGATION.md` |
