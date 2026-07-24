/**
 * @registry-id: staffOrgBuildSlotMetrics
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-24T12:30:00.000Z
 * @description: Cell metrics — hours/€ all staff; min/max vs FT headcount only
 * @last-fix: [2026-07-24] underMin/overMax count Chef/Manager/Floor/FT only
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/scenarios/[id].get.ts
 * ✓ server/api/staff-org/scenarios/[id].patch.ts
 * ✓ server/api/staff-org/seed-from-month.post.ts
 * ✓ pages/staff-org/[id].vue
 */

import type {
  StaffOrgAssignment,
  StaffOrgCellMetrics,
  StaffOrgLocationRule,
  StaffOrgPlacement,
  StaffOrgRole,
  StaffOrgRosterMember,
  StaffOrgSlotHours,
  StaffOrgTeam,
  StaffOrgWeekday,
} from '~/types/staff-org'
import { slotOpenHoursLookup } from '~/utils/staffOrg/buildOpeningSlots'
import { isContractFtMember } from '~/utils/staffOrg/contractLabor'

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
  /** Organogram roles — used so min/max only counts FT (Chef/Manager/Floor/FT). */
  orgAssignments?: StaffOrgAssignment[]
}): StaffOrgCellMetrics[] {
  const openLookup = slotOpenHoursLookup(args.slotHours)
  const costByMember = new Map(args.roster.map((m) => [m.memberId, m.costPerHour]))
  const rosterById = new Map(args.roster.map((m) => [m.memberId, m]))
  const roleByKey = new Map<string, StaffOrgRole>()
  for (const a of args.orgAssignments ?? []) {
    roleByKey.set(`${a.memberId}|${a.locationId}|${a.team}`, a.role)
  }
  const ruleLookup = new Map(
    args.rules.map((r) => [cellKey(r.locationId, r.team, r.weekday, r.slot), r]),
  )

  const buckets = new Map<string, { hours: number; cost: number; ftCount: number }>()

  for (const p of args.placements) {
    const key = cellKey(p.locationId, p.team, p.weekday, p.slot)
    const openH = openLookup.get(key)
    const hours = typeof p.hours === 'number' && Number.isFinite(p.hours)
      ? p.hours
      : (openH ?? 0)
    const rate = costByMember.get(p.memberId) ?? 0
    const member = rosterById.get(p.memberId)
    const role = roleByKey.get(`${p.memberId}|${p.locationId}|${p.team}`)
    const isFt = member ? isContractFtMember(member, role) : false

    const cur = buckets.get(key) ?? { hours: 0, cost: 0, ftCount: 0 }
    cur.hours += hours
    cur.cost += hours * rate
    if (isFt) cur.ftCount += 1
    buckets.set(key, cur)
  }

  const keys = new Set<string>([...openLookup.keys(), ...buckets.keys(), ...ruleLookup.keys()])
  const out: StaffOrgCellMetrics[] = []
  for (const key of keys) {
    const [locationId, team, weekdayStr, slot] = key.split('|')
    if (!locationId || !team || weekdayStr == null || !slot) continue
    const weekday = Number(weekdayStr) as StaffOrgWeekday
    const openHours = openLookup.get(key) ?? null
    const b = buckets.get(key) ?? { hours: 0, cost: 0, ftCount: 0 }
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
      // Headcount vs min/max = FT only (Chef / Manager / Floor / FT)
      headcount: b.ftCount,
      minStaff,
      maxStaff,
      underMin: isOpen && b.ftCount < minStaff,
      overMax: isOpen && b.ftCount > maxStaff,
    })
  }
  return out
}
