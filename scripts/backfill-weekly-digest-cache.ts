/**
 * Ensure period-cache week cascade for weeks in range (Phase 7 — no weekly-digest profile).
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-weekly-digest-cache.ts -- --from 2026-06-01 --to 2026-08-09
 *   npx --yes tsx scripts/backfill-weekly-digest-cache.ts -- --stop-start 2024-08-05
 */

import { getDb } from '../server/utils/db'
import { cascadePeriodRange } from '../server/utils/dailyOpsPeriodCache/cascadePeriod'
import {
  resolveWeeklyRange,
  previousWeekRange,
  weekRangeFromKey,
} from '../server/utils/dailyOpsWeeklyReport/weekRange'
import { getIsoWeek } from '../server/utils/dailyOpsSnapshot/aggregateDailyBundles'

function arg (name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`)
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : defaultValue
}

async function main (): Promise<void> {
  const from = arg('from')
  const to = arg('to')
  const stopStart = arg('stop-start', from ?? '2024-08-05')!

  const db = await getDb()

  let range = to
    ? (weekRangeFromKey(getIsoWeek(to)) ?? resolveWeeklyRange({ period: 'last-week', anchor: to }))
    : resolveWeeklyRange({ period: 'last-week' })

  const floor = from ?? stopStart
  process.stdout.write(
    `[period-cache:week] cascade weeks with startDate in [${floor} .. ${range.startDate}]\n`,
  )

  let weeks = 0

  while (range.startDate >= floor) {
    process.stdout.write(`[period-cache:week] cascading ${range.weekKey}…\n`)
    const r = await cascadePeriodRange(db, range.startDate, range.endDate)
    weeks += 1
    process.stdout.write(
      `[period-cache:week] ${range.weekKey} ${range.startDate}..${range.endDate} result=${JSON.stringify(r)}\n`,
    )
    range = previousWeekRange(range)
  }

  process.stdout.write(`[period-cache:week] Done weeks=${weeks}\n`)
  process.exit(0)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
