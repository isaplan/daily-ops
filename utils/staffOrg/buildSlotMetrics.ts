/**
 * @registry-id: staffOrgBuildSlotMetrics
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:15:00.000Z
 * @description: Cell metrics — headcount, hours, labor €, min/max vs open hours
 * @last-fix: [2026-07-22] Skip underMin on closed cells; shared client/server
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/scenarios/[id].get.ts
 * ✓ server/api/staff-org/scenarios/[id].patch.ts
 * ✓ pages/staff-org/[id].vue
 */

import type {
  StaffOrgCellMetrics,
  StaffOrgLocationRule,
  StaffOrgPlacement,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { slotOpenHoursLookup } from '~/utils/staffOrg/buildOpeningSlots'

function cellKey(
  locationId: string,
  team: StaffOrgTeam,
  weekday: StaffOrgWeekday,
  slot: string,
): string {
  return `${locationId}|${team}|${weekday}|${slot}`
}

export function buildSlotMetrics(args: {
  placements: StaffOrgPlacement[]
  rules: StaffOrgLocationRule[]
  roster: StaffOrgRosterMember[]
  slotHours: StaffOrgSlotHours[]
}): StaffOrgCellMetrics[] {
  const openLookup = slotOpenHoursLookup(args.slotHours)
  const costByMember = new Map(args.roster.map((m) => [m.memberId, m.costPerHour]))
  const ruleLookup = new Map(
    args.rules.map((r) => [cellKey(r.locationId, r.team, r.weekday, r.slot), r]),
  )

  const buckets = new Map<string, { hours: number; cost: number; count: number }>()

  for (const p of args.placements) {
    const key = cellKey(p.locationId, p.team, p.weekday, p.slot)
    const openH = openLookup.get(key)
    const hours = typeof p.hours === 'number' && Number.isFinite(p.hours)
      ? p.hours
      : (openH ?? 0)
    const rate = costByMember.get(p.memberId) ?? 0
    const cur = buckets.get(key) ?? { hours: 0, cost: 0, count: 0 }
    cur.hours += hours
    cur.cost += hours * rate
    cur.count += 1
    buckets.set(key, cur)
  }

  const keys = new Set<string>([...openLookup.keys(), ...buckets.keys(), ...ruleLookup.keys()])
  const out: StaffOrgCellMetrics[] = []
  for (const key of keys) {
    const [locationId, team, weekdayStr, slot] = key.split('|')
    if (!locationId || !team || weekdayStr == null || !slot) continue
    const weekday = Number(weekdayStr) as StaffOrgWeekday
    const openHours = openLookup.get(key) ?? null
    const b = buckets.get(key) ?? { hours: 0, cost: 0, count: 0 }
    const rule = ruleLookup.get(key)
    const minStaff = rule?.minStaff ?? 0
    const maxStaff = rule?.maxStaff ?? 99
    const isOpen = openHours != null
    out.push({
      locationId,
      team: team as StaffOrgTeam,
      weekday,
      slot: slot as StaffOrgCellMetrics['slot'],
      openHours,
      assignedHours: b.hours,
      laborCost: Math.round(b.cost * 100) / 100,
      headcount: b.count,
      minStaff,
      maxStaff,
      underMin: isOpen && b.count < minStaff,
      overMax: isOpen && b.count > maxStaff,
    })
  }
  return out
}
