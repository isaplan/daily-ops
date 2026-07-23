/**
 * @registry-id: staffOrgDefaultVenues
 * @created: 2026-07-23T01:45:00.000Z
 * @last-modified: 2026-07-23T01:45:00.000Z
 * @description: Default Staff Org venues from Daily Ops profit locations
 * @last-fix: [2026-07-23] Seed VKB/Bea/LAT as open
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/utils/staffOrg/scenarioRepo.ts
 * ✓ components/staffOrg/StaffOrgTeamBuilder.vue
 */

import type { StaffOrgVenue } from '~/types/staff-org'
import { DAILY_OPS_PROFIT_VENUE_LOCATIONS } from '~/utils/dailyOpsProfitIntervals'

export function defaultStaffOrgVenues(): StaffOrgVenue[] {
  return DAILY_OPS_PROFIT_VENUE_LOCATIONS.map((v) => ({
    locationId: v.locationId,
    name: v.label,
    short: v.short,
    status: 'open' as const,
  }))
}

export function normalizeStaffOrgVenues(raw: unknown): StaffOrgVenue[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultStaffOrgVenues()
  const out: StaffOrgVenue[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const locationId = String(r.locationId ?? '').trim()
    if (!locationId) continue
    out.push({
      locationId,
      name: String(r.name ?? r.label ?? 'Venue').trim() || 'Venue',
      short: String(r.short ?? '').trim() || locationId.slice(-3).toUpperCase(),
      status: r.status === 'closed' ? 'closed' : 'open',
    })
  }
  return out.length > 0 ? out : defaultStaffOrgVenues()
}
