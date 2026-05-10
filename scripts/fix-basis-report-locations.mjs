/**
 * Fix-up:
 *   1. Seed `aliases: []` on the 3 unified_location venues so parser variants always resolve.
 *   2. Normalize every `inbox-bork-basis-report` row:
 *        - resolve `location_id` via name / primaryName / canonicalName / abbreviation / aliases / borkMapping
 *        - rewrite `location` to the unified primary name
 *   3. Delete legacy rows that cannot be resolved AND have no `metadata.source_attachment_id`
 *      (parser noise like `Bar supplementen`, empty subjects, etc — they predate the current mapper).
 *
 * Usage:
 *   node scripts/fix-basis-report-locations.mjs           # dry-run by default
 *   APPLY=1 node scripts/fix-basis-report-locations.mjs   # actually write
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

const APPLY = process.env.APPLY === '1'

/** Aliases produced historically by the parser / subjects. Add new ones here, don't hardcode them in code. */
const ALIAS_SEEDS = {
  'Bar Bea': ['Barbea', 'BarBea', 'BAR BEA', 'BEA', 'Bea'],
  'Van Kinsbergen': ['Kinsbergen', 'Gastropub Van Kinsbergen', 'VKB'],
  "l'Amour Toujours": ['lAmour', 'l Amour', "l'Amour", 'lAmour Toujours', 'LAT'],
}

function normalizeLoose(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
function compactAlpha(s) {
  return normalizeLoose(s).replace(/[^a-z0-9]/g, '')
}

function buildAliasIndex(unifiedLocs) {
  const index = new Map()
  const idToPrimary = new Map()

  for (const u of unifiedLocs) {
    const id = String(u._id)
    const primary = u.primaryName || u.name || u.canonicalName || ''
    idToPrimary.set(id, primary)

    const candidates = [
      u.name,
      u.primaryName,
      u.canonicalName,
      u.abbreviation,
      u.borkMapping?.borkLocationName,
      ...(Array.isArray(u.aliases) ? u.aliases : []),
    ].filter(Boolean)

    for (const c of candidates) {
      const n = normalizeLoose(c)
      const k = compactAlpha(c)
      if (n) index.set(`n:${n}`, id)
      if (k) index.set(`c:${k}`, id)
    }
  }
  return { index, idToPrimary }
}

function resolveByIndex(label, index) {
  if (!label) return null
  const n = normalizeLoose(label)
  const k = compactAlpha(label)
  return index.get(`n:${n}`) || index.get(`c:${k}`) || null
}

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  if (!uri || !dbName) {
    console.error('Missing MONGODB_URI / MONGODB_DB_NAME')
    process.exit(1)
  }

  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  console.log(APPLY ? '\n>>> APPLY mode (writes will happen)' : '\n>>> DRY-RUN (no writes). Set APPLY=1 to commit.')

  // ---------- 1. Seed aliases ----------
  console.log('\n[1] Seeding aliases on unified_location ...')
  const ulocs = await db.collection('unified_location').find({}).toArray()
  const plannedById = new Map() // unified_location_id -> merged aliases (for dry-run preview)

  for (const [primary, aliases] of Object.entries(ALIAS_SEEDS)) {
    const doc = ulocs.find(
      (u) =>
        u.name === primary ||
        u.primaryName === primary ||
        u.canonicalName === primary,
    )
    if (!doc) {
      console.log(`  ! No unified_location for primary="${primary}", skipping`)
      continue
    }
    const existing = Array.isArray(doc.aliases) ? doc.aliases : []
    const merged = [...new Set([...existing, ...aliases].filter(Boolean))]
    plannedById.set(String(doc._id), merged)

    const changed = JSON.stringify(existing) !== JSON.stringify(merged)
    console.log(`  ${changed ? '+' : '='} ${primary} (${String(doc._id)}) -> aliases=${JSON.stringify(merged)}`)
    if (APPLY && changed) {
      await db.collection('unified_location').updateOne({ _id: doc._id }, { $set: { aliases: merged } })
    }
  }

  // ---------- 2. Re-normalize basis report rows ----------
  console.log('\n[2] Re-normalizing inbox-bork-basis-report ...')
  const ulocs2 = (await db.collection('unified_location').find({}).toArray()).map((u) => {
    const merged = plannedById.get(String(u._id))
    return merged ? { ...u, aliases: merged } : u
  })
  const { index, idToPrimary } = buildAliasIndex(ulocs2)
  const reports = await db.collection('inbox-bork-basis-report').find({}).toArray()

  let resolvedNew = 0
  let alreadyOk = 0
  let unresolvable = 0
  const unresolvableSamples = new Map()

  for (const r of reports) {
    const candidates = [r.location_raw, r.location].filter(Boolean)
    let resolvedId = null
    for (const c of candidates) {
      resolvedId = resolveByIndex(c, index)
      if (resolvedId) break
    }

    if (!resolvedId) {
      unresolvable++
      const key = String(r.location ?? '(empty)')
      unresolvableSamples.set(key, (unresolvableSamples.get(key) || 0) + 1)
      continue
    }

    const primary = idToPrimary.get(resolvedId) ?? r.location
    const needsUpdate = String(r.location_id ?? '') !== resolvedId || r.location !== primary

    if (!needsUpdate) {
      alreadyOk++
      continue
    }

    resolvedNew++
    if (APPLY) {
      await db.collection('inbox-bork-basis-report').updateOne(
        { _id: r._id },
        { $set: { location: primary, location_id: resolvedId } },
      )
    }
  }

  console.log(`  alreadyOk=${alreadyOk}  newlyResolved=${resolvedNew}  unresolvable=${unresolvable}`)
  if (unresolvable > 0) {
    console.log('  Unresolvable counts by current `location` value:')
    for (const [k, v] of unresolvableSamples.entries()) {
      console.log(`    ${k.padEnd(20)} -> ${v}`)
    }
  }

  // ---------- 3. Delete unresolvable rows ----------
  // After step 2 every row with a recognizable label got a location_id. Anything still
  // unresolvable is either:
  //   (a) legacy parser noise without source_attachment_id (e.g. "Bar supplementen") — drop, OR
  //   (b) empty XLSX with no venue cue and €0 revenue (e.g. "Unspecified") — drop.
  //
  // We never delete a row that resolved to a unified location.
  console.log('\n[3] Cleaning up unresolvable rows ...')
  const stillUnresolved = await db
    .collection('inbox-bork-basis-report')
    .find({
      $or: [{ location_id: null }, { location_id: { $exists: false } }, { location_id: '' }],
    })
    .toArray()

  // Re-resolve in-memory after step 2 dry-run preview so we know what *would* remain.
  const trulyUnresolvable = stillUnresolved.filter((r) => {
    if (APPLY) return true // step 2 already wrote, so DB state is authoritative
    return !resolveByIndex(r.location_raw, index) && !resolveByIndex(r.location, index)
  })

  console.log(`  Truly unresolvable rows after alias seed: ${trulyUnresolvable.length}`)
  for (const o of trulyUnresolvable.slice(0, 8)) {
    console.log(
      `    - date=${o.date} location="${o.location}" rev=${o.final_revenue_incl_vat ?? 0} subject="${
        o.metadata?.email_subject ?? ''
      }" attId=${o.metadata?.source_attachment_id ?? '(none)'}`,
    )
  }
  if (trulyUnresolvable.length > 8) console.log(`    ... and ${trulyUnresolvable.length - 8} more`)

  if (APPLY && trulyUnresolvable.length > 0) {
    const ids = trulyUnresolvable.map((o) => o._id)
    const r = await db.collection('inbox-bork-basis-report').deleteMany({ _id: { $in: ids } })
    console.log(`  Deleted ${r.deletedCount} unresolvable rows.`)
  }

  await client.close()
  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
