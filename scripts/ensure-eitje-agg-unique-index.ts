/**
 * One-time / maintenance: dedupe all labor agg rows, normalize keys to strings,
 * create unique index on business key.
 *
 * Usage:
 *   npx --yes tsx scripts/ensure-eitje-agg-unique-index.ts
 *   npx --yes tsx scripts/ensure-eitje-agg-unique-index.ts --skip-index
 */
import { getDb } from '../server/utils/db'
import { fixAggregationDuplicates } from '../server/services/dataIntegrityService'

const INDEX_NAME = 'uniq_eitje_labor_day_key'

async function periodBounds (): Promise<{ start: string; end: string } | null> {
  const db = await getDb()
  const [row] = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: { period_type: 'day', period: { $type: 'string' } } },
      { $group: { _id: null, start: { $min: '$period' }, end: { $max: '$period' } } },
    ])
    .toArray() as { start?: string; end?: string }[]
  if (!row?.start || !row?.end) return null
  return { start: row.start, end: row.end }
}

async function normalizeKeyTypes (): Promise<{ locationId: number; userId: number; teamId: number }> {
  const db = await getDb()
  const coll = db.collection('eitje_time_registration_aggregation')
  const [loc, user, team] = await Promise.all([
    coll.updateMany({ locationId: { $type: 'objectId' } }, [{ $set: { locationId: { $toString: '$locationId' } } }]),
    coll.updateMany({ userId: { $type: 'number' } }, [{ $set: { userId: { $toString: '$userId' } } }]),
    coll.updateMany({ teamId: { $type: 'number' } }, [{ $set: { teamId: { $toString: '$teamId' } } }]),
  ])
  return {
    locationId: loc.modifiedCount,
    userId: user.modifiedCount,
    teamId: team.modifiedCount,
  }
}

async function main () {
  const skipIndex = process.argv.includes('--skip-index')
  const bounds = await periodBounds()
  if (!bounds) {
    console.log('No day aggregation rows found — nothing to do.')
    return
  }

  console.log(`Deduping labor aggregation ${bounds.start} .. ${bounds.end} ...`)
  const deduped = await fixAggregationDuplicates(bounds)
  console.log(`Removed ${deduped} duplicate row(s).`)

  console.log('Normalizing key field types to string ...')
  const normalized = await normalizeKeyTypes()
  console.log(normalized)

  if (skipIndex) {
    console.log('Skipped unique index (--skip-index).')
    return
  }

  const db = await getDb()
  const coll = db.collection('eitje_time_registration_aggregation')
  const indexes = await coll.indexes()
  const existing = indexes.find((i) => i.name === INDEX_NAME)
  if (existing) {
    console.log(`Index ${INDEX_NAME} already exists.`)
    return
  }

  console.log(`Creating unique index ${INDEX_NAME} ...`)
  await coll.createIndex(
    { period_type: 1, period: 1, locationId: 1, userId: 1, teamId: 1 },
    { unique: true, name: INDEX_NAME },
  )
  console.log('Done.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
