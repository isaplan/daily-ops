/**
 * Fill September Scenario from June 2026 FT work patterns (days), hours = contract÷days.
 */
import { getDb } from '../server/utils/db'
import { fillScenarioFromMonth } from '../server/utils/staffOrg/seedScenarioFromMonth'
import { DAILY_OPS_VENUE_OPENING_HOURS } from '../utils/dailyOpsVenueOpeningHours'

const SEPTEMBER_ID = '6a613fc242443fddd737c424'

async function main() {
  const db = await getDb()
  const scenario = await fillScenarioFromMonth(db, SEPTEMBER_ID, {
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  })
  if (!scenario) {
    console.error('Scenario not found', SEPTEMBER_ID)
    process.exit(1)
  }

  const locNames = new Map(DAILY_OPS_VENUE_OPENING_HOURS.map((v) => [v.locationId, v.locationName]))
  const byLoc = new Map<string, number>()
  for (const p of scenario.placements) {
    byLoc.set(p.locationId, (byLoc.get(p.locationId) ?? 0) + 1)
  }
  console.log(JSON.stringify({
    id: scenario._id,
    name: scenario.name,
    placements: scenario.placements.length,
    uniqueMembers: new Set(scenario.placements.map((p) => p.memberId)).size,
    byLocation: Object.fromEntries(
      [...byLoc.entries()].map(([id, n]) => [locNames.get(id) ?? id, n]),
    ),
  }, null, 2))
  console.log(`\nOpen: http://localhost:8080/staff-org/${scenario._id}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
