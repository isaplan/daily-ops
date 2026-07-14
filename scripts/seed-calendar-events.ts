/**
 * Seed national, religious, and regio Midden school holidays (2024–2029).
 *
 * Usage:
 *   pnpm calendar:seed
 */
import { getDb } from '../server/utils/db'
import { seedCalendarEvents } from '../server/utils/dailyOpsCalendarEvents/seedCalendarEvents'

async function main(): Promise<void> {
  const db = await getDb()
  const result = await seedCalendarEvents(db)
  process.stdout.write(`[calendar-seed] written=${result.written}\n`)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
