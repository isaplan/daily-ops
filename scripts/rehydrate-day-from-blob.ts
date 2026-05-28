/**
 * Rehydrate archived raw day from DO Spaces back into Mongo.
 *
 * Usage:
 *   pnpm retention:rehydrate-day -- --date 2026-05-01 --source bork_raw
 *   pnpm retention:rehydrate-day -- --date 2026-05-01 --source eitje_raw --location 69d6cfa63d2adf93b79d1ae7
 */

import { getDb } from '../server/utils/db'
import { rehydrateRawDayFromBlob } from '../server/utils/dailyOpsBlob/archiveRawDay'
import type { ColdManifestSource } from '../server/utils/dailyOpsBlob/coldManifest'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

async function main() {
  const businessDate = arg('date')
  const source = arg('source') as ColdManifestSource | undefined
  const locationId = arg('location') ?? null

  if (!businessDate || !source || (source !== 'bork_raw' && source !== 'eitje_raw')) {
    process.stderr.write('Usage: --date YYYY-MM-DD --source bork_raw|eitje_raw [--location id]\n')
    process.exit(1)
  }

  const db = await getDb()
  const r = await rehydrateRawDayFromBlob(db, businessDate, source, locationId)
  process.stdout.write(`Rehydrated ${r.inserted} docs for ${businessDate} ${source}\n`)
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exit(1)
})
