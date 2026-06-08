/**
 * @registry-id: dailyOpsLeerlingWageFallback
 * @created: 2026-06-09T00:00:00.000Z
 * @last-modified: 2026-06-09T12:00:00.000Z
 * @description: Leerling wage fallback when inbox/Eitje CSV has no uurloon (€2/h); name or overig
 * @last-fix: [2026-06-09] Explicit case-insensitive leerling match (name or overig)
 * @adr-ref: ADR-001, ADR-009
 *
 * @exports-to:
 * ✓ server/utils/memberCompensationRevisions.ts
 * ✓ server/utils/eitjeAggCompensationEnrich.ts
 */

/** Standard fallback bruto €/h for Leerling when CSV has no uurloon. */
export const LEERLING_FALLBACK_HOURLY_EUR = 2

/** Case-insensitive: matches leerling, Leerling, LEERLING, etc. in name or overig. */
function textContainsLeerling(value: string | null | undefined): boolean {
  return String(value ?? '').trim().toLowerCase().includes('leerling')
}

export function isLeerlingName(name: string): boolean {
  return textContainsLeerling(name)
}

/** Leerling when display name or Eitje CSV `overig` contains leerling (any casing). */
export function isLeerlingEmployee(name: string, overig?: string | null): boolean {
  return textContainsLeerling(name) || textContainsLeerling(overig)
}

/** Weekly contract hours embedded in e.g. `uren contract (16.0)`. */
export function weeklyHoursFromContractType(contractType: string): number | null {
  const m = /uren contract\s*\(([\d.]+)\)/i.exec(String(contractType ?? ''))
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Detect when weekly contract hours were stored as hourly rate (common inbox export bug).
 * e.g. Chelsea: contract (16.0) + hourly_rate 16.6 with no uurloon in CSV.
 */
export function isLikelyWeeklyHoursMisreadAsHourly(
  employeeName: string,
  contractType: string,
  hourlyRate: number | null,
  overig?: string | null,
): boolean {
  if (!isLeerlingEmployee(employeeName, overig) || hourlyRate == null) return false
  const weekly = weeklyHoursFromContractType(contractType)
  if (weekly == null) return false
  return Math.abs(hourlyRate - weekly) < 0.75
}

export type LeerlingWageResolution = {
  hourly_rate: number
  cost_per_hour: number
  appliedFallback: boolean
}

/**
 * When name or overig contains leerling (any case) and CSV has no valid uurloon, use €2/h.
 * Returns null when CSV hourly should be used as-is.
 */
export function resolveLeerlingInboxWages(
  employeeName: string,
  contractType: string,
  hourlyRate: number | null,
  _costPerHour: number | null,
  overig?: string | null,
): LeerlingWageResolution | null {
  if (!isLeerlingEmployee(employeeName, overig)) return null

  const hasValidCsvHourly =
    hourlyRate != null &&
    hourlyRate > 0 &&
    !isLikelyWeeklyHoursMisreadAsHourly(employeeName, contractType, hourlyRate, overig)

  if (hasValidCsvHourly) return null

  return {
    hourly_rate: LEERLING_FALLBACK_HOURLY_EUR,
    cost_per_hour: LEERLING_FALLBACK_HOURLY_EUR,
    appliedFallback: true,
  }
}
