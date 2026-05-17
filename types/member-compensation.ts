/**
 * @registry-id: memberCompensationTypes
 * @created: 2026-05-16T12:00:00.000Z
 * @last-modified: 2026-05-16T12:00:00.000Z
 * @description: Compensation revision shapes embedded on members documents
 * @last-fix: [2026-05-16] Initial — ADR-001, ADR-002, ADR-005
 *
 * @architecture-ref: ARCHITECTURE.md#5-business-rules
 * @adr-ref: ADR-001, ADR-002, ADR-005
 *
 * @exports-to:
 * ✓ server/utils/memberCompensationRevisions.ts
 * ✓ server/api/members/[id].get.ts
 * ✓ server/api/members/[id].put.ts
 */

export type CompensationCostModel =
  | 'stored_cph'
  | 'nul_uren_1_36'
  | 'zzp_invoice'
  | 'manual'

export type CompensationRevisionSource =
  | 'inbox_eitje_contract'
  | 'manual_ui'
  | 'migration_seed'

export type CompensationStatus = 'ok' | 'missing'

export type CompensationRevision = {
  effective_from: Date
  effective_to: Date | null
  contract_type: string
  hourly_rate: number | null
  cost_per_hour: number | null
  cost_model: CompensationCostModel
  source: CompensationRevisionSource
  source_ref?: string
  created_at: Date
}

export type CompensationMaterialFields = {
  contract_type: string
  hourly_rate: number | null
  cost_per_hour: number | null
}
