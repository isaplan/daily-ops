/**
 * @registry-id: memberEitjeSaldoTypes
 * @created: 2026-06-11T18:00:00.000Z
 * @last-modified: 2026-06-11T18:00:00.000Z
 * @description: Eitje monthly plus/min + verlof saldo snapshots (CSV SSOT)
 * @last-fix: [2026-06-11] Types for member_eitje_saldo_snapshot collection
 *
 * @exports-to:
 * ✓ server/utils/memberEitjeSaldoSnapshots.ts
 * ✓ scripts/import-eitje-uren-saldo-csvs.ts
 */

export type MemberEitjeSaldoHoursBlock = {
  start: number
  opbouw: number
  correcties: number
  eind: number
}

export type MemberEitjeVerlofHoursBlock = {
  start: number
  opgebouwd: number
  opgenomen: number
  correcties: number
  eind: number
}

export type MemberEitjeSaldoSnapshot = {
  support_id: string
  member_id: string | null
  employee_name: string
  snapshot_date: string
  contract_location: string | null
  monthly_contract_hours: number
  total_worked_hours: number
  plusmin: MemberEitjeSaldoHoursBlock
  verlof: MemberEitjeVerlofHoursBlock
  sick_hours: number
  is_uren_contract: boolean
  source_file: string
  imported_at: Date
}
