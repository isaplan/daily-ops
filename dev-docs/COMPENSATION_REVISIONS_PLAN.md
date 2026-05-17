# Compensation Revisions — Implementation Plan

**Branch:** `feat/member-compensation-revisions`  
**Architecture:** [../ARCHITECTURE.md](../ARCHITECTURE.md)  
**ADRs:** [../DECISIONS.md](../DECISIONS.md) (ADR-001 … ADR-005)

This document is the **build checklist** for the feature. Durable rules live in `ARCHITECTURE.md` and `DECISIONS.md`.

---

## Schema (`members`)

```typescript
compensationHistory: CompensationRevision[]  // embedded array

// Denormalized current (mirror of latest open revision):
contract_type, hourly_rate, cost_per_hour, compensation_status?: 'ok' | 'missing'
unified_user_id?: ObjectId
```

See `types/member-compensation.ts` for `CompensationRevision` shape.

---

## Write paths

| Trigger | Handler | `source` | `effective_from` |
|---------|---------|----------|-------------------|
| Inbox contract CSV upsert | `dataMappingService` after `contracts` bulkWrite | `inbox_eitje_contract` | `start_date` \|\| `importedAt` |
| Manual member edit | `PUT /api/members/[id]` | `manual_ui` | `new Date()` |

---

## Read paths

| Consumer | Behavior |
|----------|----------|
| `GET /api/members/[id]` | No inbox fallback; `compensation_status`; return `compensationHistory` |
| `GET /api/daily-ops/eitje-staff` | `compensation_status` on matched member |
| Eitje rebuild agg | `memberDoc.cost_per_hour` before inbox contract lookup |
| Snapshots | Unchanged — read agg only |

---

## Phases (execution order)

1. Docs + ADRs (root)
2. `members.unified_user_id` + backfill + sync maintenance
3. `memberCompensationRevisions.ts` + inbox hook + members GET/PUT
4. UI: member timeline + eitje-staff missing block
5. Agg priority swap in `eitjeLoadedCostStages` / employer stages
6. Validate snapshot script on sample date

**Backfill unified_user_id:** `pnpm members:backfill-unified-user-id`

---

## Out of scope (v1)

- Retroactive agg/snapshot rebuild on revision (ADR-002)
- Bork fields on `members`
