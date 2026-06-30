import type { DailyOpsStaffTimeseriesPoint } from '~/types/daily-ops-staff'

export type StaffContractFilter = 'all' | 'ft' | 'pt' | 'zzp'

export type StaffContractBucketKey = 'ft' | 'pt' | 'zzp'

export type StaffContractBucketMetrics = {
  hours: number
  gewerkt_hours: number
  staff_count: number
  loaded_cost: number
}

export type StaffContractBuckets = Record<StaffContractBucketKey, StaffContractBucketMetrics>

export function emptyStaffContractBuckets(): StaffContractBuckets {
  const zero = (): StaffContractBucketMetrics => ({
    hours: 0,
    gewerkt_hours: 0,
    staff_count: 0,
    loaded_cost: 0,
  })
  return { ft: zero(), pt: zero(), zzp: zero() }
}

/** FT = uren contract · PT = nul uren · ZZP = zzp/zpp */
export function classifyStaffContractType(contractType: string): StaffContractBucketKey | null {
  const ct = String(contractType ?? '').trim()
  if (/zzp|zpp/i.test(ct)) return 'zzp'
  if (/nul\s*uren/i.test(ct)) return 'pt'
  if (/stage\s*\(/i.test(ct)) return 'ft'
  if (/uren contract/i.test(ct)) return 'ft'
  return null
}

export function pickContractMetrics(
  point: DailyOpsStaffTimeseriesPoint,
  filter: StaffContractFilter,
): Pick<DailyOpsStaffTimeseriesPoint, 'gewerkt_hours' | 'staff_count'> {
  if (filter === 'all') {
    return { gewerkt_hours: point.gewerkt_hours, staff_count: point.staff_count }
  }
  const slice = point.byContract?.[filter]
  if (!slice) return { gewerkt_hours: 0, staff_count: 0 }
  return { gewerkt_hours: slice.gewerkt_hours, staff_count: slice.staff_count }
}

export function applyStaffContractFilter(
  points: DailyOpsStaffTimeseriesPoint[],
  filter: StaffContractFilter,
): DailyOpsStaffTimeseriesPoint[] {
  if (filter === 'all') return points
  return points.map((p) => {
    const m = pickContractMetrics(p, filter)
    const slice = p.byContract?.[filter]
    return {
      ...p,
      gewerkt_hours: m.gewerkt_hours,
      staff_count: m.staff_count,
      labor_loaded_cost: slice?.loaded_cost ?? 0,
    }
  })
}
