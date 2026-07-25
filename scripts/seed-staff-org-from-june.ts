/**
 * Seed Staff Org scenario from June 2026 labor (multi-day FT placements).
 * Usage: npx --yes tsx scripts/seed-staff-org-from-june.ts
 */
import { getDb } from '../server/utils/db'
import { seedScenarioFromMonth } from '../server/utils/staffOrg/seedScenarioFromMonth'
import { DAILY_OPS_VENUE_OPENING_HOURS } from '../utils/dailyOpsVenueOpeningHours'

async function main() {
  const db = await getDb()
  const scenario = await seedScenarioFromMonth(db, {
    name: 'June 2026 baseline — all locations',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  })

  const byLoc = new Map<string, number>()
  const byMember = new Map<string, { hours: number; days: number; name: string }>()
  const rosterName = new Map(scenario.roster.map((m) => [m.memberId, m]))

  for (const p of scenario.placements) {
    byLoc.set(p.locationId, (byLoc.get(p.locationId) ?? 0) + 1)
    const cur = byMember.get(p.memberId) ?? {
      hours: 0,
      days: 0,
      name: rosterName.get(p.memberId)?.name ?? p.memberId,
    }
    cur.hours += p.hours ?? 0
    cur.days += 1
    byMember.set(p.memberId, cur)
  }

  const locNames = new Map(DAILY_OPS_VENUE_OPENING_HOURS.map((v) => [v.locationId, v.locationName]))
  console.log(JSON.stringify({
    id: scenario._id,
    name: scenario.name,
    placements: scenario.placements.length,
    uniqueMembers: byMember.size,
    roster: scenario.roster.length,
    byLocation: Object.fromEntries(
      [...byLoc.entries()].map(([id, n]) => [locNames.get(id) ?? id, n]),
    ),
    sampleMembers: [...byMember.values()]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 12)
      .map((m) => {
        const r = [...rosterName.values()].find((x) => x.name === m.name)
        return {
          name: m.name,
          contract: r?.weeklyContractHours ?? null,
          placedWeekHours: Math.round(m.hours * 10) / 10,
          days: m.days,
        }
      }),
  }, null, 2))
  console.log(`\nOpen: http://localhost:8080/staff-org/${scenario._id}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
