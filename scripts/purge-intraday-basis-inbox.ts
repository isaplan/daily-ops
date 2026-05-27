/**
 * Delete intraday Basis inbox rows (cron 12/15/18/23). Headline revenue uses morning 7|8 + Bork only.
 *
 * Usage:
 *   pnpm inbox:purge-intraday
 *   pnpm inbox:purge-intraday -- --dry-run
 */

import { getDb } from '../server/utils/db'
import { INTRADAY_BASIS_CRON_HOURS } from '../server/utils/inbox/basis-report-mapper'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const db = await getDb()
  const coll = db.collection('inbox-bork-basis-report')

  const filter = { cron_hour: { $in: [...INTRADAY_BASIS_CRON_HOURS] } }
  const count = await coll.countDocuments(filter)

  console.info(
    `[inbox:purge-intraday] ${dryRun ? 'would delete' : 'deleting'} ${count} row(s) with cron_hour in [${INTRADAY_BASIS_CRON_HOURS.join(', ')}]`,
  )

  if (!dryRun && count > 0) {
    const r = await coll.deleteMany(filter)
    console.info(`[inbox:purge-intraday] deleted ${r.deletedCount}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
