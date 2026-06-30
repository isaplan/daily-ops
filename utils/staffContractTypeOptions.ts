/**
 * @registry-id: staffContractTypeOptions
 * @created: 2026-06-29T18:30:00.000Z
 * @last-modified: 2026-06-29T18:30:00.000Z
 * @description: Preset contract-type options for staff profile inline edit
 * @last-fix: [2026-06-29] Shared FT/PT/ZZP select options for staff overview
 *
 * @exports-to:
 * ✓ pages/daily-ops/staff/index.vue
 */

export type StaffContractSelectOption = { label: string; value: string }

/** Bruto €/h for stage / stagiair contracts (fixed). */
export const STAGE_CONTRACT_HOURLY_EUR = 2

const FT_WEEKLY_HOURS = [8, 12, 14, 16, 20, 24, 28, 32, 36, 38, 40] as const

const STAGE_CONTRACTS: StaffContractSelectOption[] = [
  { label: 'FT — stage (16)', value: 'stage (16)' },
]

export function isStageContractType(contractType: string | null | undefined): boolean {
  return /^stage\s*\(/i.test(String(contractType ?? '').trim())
}

/** Weekly hours from e.g. `stage (16)`. */
export function stageWeeklyHoursFromContractType(contractType: string): number | null {
  const m = /stage\s*\(([\d.]+)\)/i.exec(String(contractType ?? ''))
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** Stage contracts always use €2/h (bruto + loaded). */
export function applyStageContractCompensation(
  contractType: string,
): { hourly_rate: number; cost_per_hour: number } | null {
  if (!isStageContractType(contractType)) return null
  return {
    hourly_rate: STAGE_CONTRACT_HOURLY_EUR,
    cost_per_hour: STAGE_CONTRACT_HOURLY_EUR,
  }
}

function formatHoursInContract(base: 'uren contract' | 'zzp', hours: number): string {
  const h = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
  return `${base} (${h})`
}

const PRESET_OPTIONS: StaffContractSelectOption[] = [
  { label: 'PT — nul uren', value: 'nul uren' },
  ...FT_WEEKLY_HOURS.map((h) => ({
    label: `FT — uren contract (${h})`,
    value: formatHoursInContract('uren contract', h),
  })),
  ...STAGE_CONTRACTS,
  { label: 'ZZP — zzp (0)', value: 'zzp (0)' },
  ...FT_WEEKLY_HOURS.filter((h) => h <= 24).map((h) => ({
    label: `ZZP — zzp (${h})`,
    value: formatHoursInContract('zzp', h),
  })),
  { label: 'Geen contract', value: 'geen contract' },
]

/** Options for contract-type USelectMenu; keeps unknown stored values selectable. */
export function staffContractTypeSelectOptions(existingValue?: string | null): StaffContractSelectOption[] {
  const cur = String(existingValue ?? '').trim()
  if (!cur || cur === '—') return PRESET_OPTIONS
  if (PRESET_OPTIONS.some((o) => o.value === cur)) return PRESET_OPTIONS
  return [{ label: `Saved: ${cur}`, value: cur }, ...PRESET_OPTIONS]
}
