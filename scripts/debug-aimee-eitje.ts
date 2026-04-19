/**
 * One-off diagnostic: find Aimée / support 123453 across Eitje collections and sum hours by location + team.
 * Run: npx tsx scripts/debug-aimee-eitje.ts
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { MongoClient } from 'mongodb'

function loadEnvLocal () {
  const envFile = join(process.cwd(), '.env.local')
  if (!existsSync(envFile)) return
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const SUPPORT = '123453'
const NAME_HINTS = [/aimée/i, /aimee/i, /leeuwen/i]

async function main () {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME || 'daily-ops-db'
  if (!uri) {
    console.error('Missing MONGODB_URI (set in .env.local)')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)

  console.log('Database:', dbName, '\n')

  // --- members ---
  const members = await db
    .collection('members')
    .find({
      $or: [
        { support_id: SUPPORT },
        { support_id: Number(SUPPORT) },
        ...NAME_HINTS.map((r) => ({ name: r })),
      ],
    })
    .project({ name: 1, email: 1, support_id: 1 })
    .toArray()
  console.log('=== members ===')
  console.log(JSON.stringify(members, null, 2))

  // --- unified_user ---
  const sid = Number(SUPPORT)
  const uu = await db
    .collection('unified_user')
    .find({
      $or: [
        { support_id: SUPPORT },
        { support_id: sid },
        { eitjeIds: sid },
        { allIdValues: sid },
        { allIdValues: SUPPORT },
        ...NAME_HINTS.map((r) => ({ canonicalName: r })),
        ...NAME_HINTS.map((r) => ({ primaryName: r })),
      ],
    })
    .project({
      canonicalName: 1,
      primaryName: 1,
      support_id: 1,
      eitjeIds: 1,
      allIdValues: 1,
      primaryId: 1,
    })
    .limit(15)
    .toArray()
  console.log('\n=== unified_user (matches) ===')
  console.log(JSON.stringify(uu, null, 2))

  const idSet = new Set<unknown>()
  idSet.add(SUPPORT)
  idSet.add(sid)
  for (const u of uu) {
    const d = u as Record<string, unknown>
    if (Array.isArray(d.eitjeIds)) for (const x of d.eitjeIds) idSet.add(x)
    if (Array.isArray(d.allIdValues)) for (const x of d.allIdValues) idSet.add(x)
    if (d.primaryId != null) idSet.add(d.primaryId)
    if (d.support_id != null) idSet.add(d.support_id)
  }
  const allIds = [...idSet].filter((x) => x != null && x !== '')
  console.log('\n=== candidate ids for raw/agg match ===')
  console.log(allIds)

  // --- time registration aggregation ---
  const aggMatch: Record<string, unknown> = {
    period_type: 'day',
    $or: [
      { userId: { $in: allIds } },
      { user_name: { $regex: 'leeuwen', $options: 'i' } },
      { user_name: { $regex: 'aimée', $options: 'i' } },
      { user_name: { $regex: 'aimee', $options: 'i' } },
    ],
  }
  const aggTime = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate([
      { $match: aggMatch },
      {
        $group: {
          _id: { location: '$location_name', team: '$team_name', userId: '$userId', user_name: '$user_name' },
          hours: { $sum: '$total_hours' },
          rows: { $sum: '$record_count' },
        },
      },
      { $sort: { hours: -1 } },
      { $limit: 30 },
    ])
    .toArray()
  console.log('\n=== eitje_time_registration_aggregation (grouped location/team) ===')
  console.log(JSON.stringify(aggTime, null, 2))

  // --- raw: by support id ---
  const rawBySupport = await db
    .collection('eitje_raw_data')
    .aggregate([
      {
        $match: {
          endpoint: 'time_registration_shifts',
          $or: [
            { 'extracted.supportId': { $in: [SUPPORT, sid] } },
            { 'rawApiResponse.support_id': { $in: [SUPPORT, sid] } },
          ],
        },
      },
      {
        $addFields: {
          hours: {
            $ifNull: [
              { $toDouble: '$extracted.hours' },
              {
                $ifNull: [
                  { $toDouble: '$extracted.hoursWorked' },
                  { $ifNull: [{ $toDouble: '$rawApiResponse.hours' }, 0] },
                ],
              },
            ],
          },
          loc: {
            $ifNull: [
              '$extracted.locationName',
              {
                $ifNull: [
                  '$extracted.environmentName',
                  {
                    $ifNull: [
                      '$rawApiResponse.location_name',
                      { $ifNull: ['$rawApiResponse.environment_name', ''] },
                    ],
                  },
                ],
              },
            ],
          },
          teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
        },
      },
      {
        $lookup: {
          from: 'unified_team',
          let: { tid: '$teamId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] },
                    { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] },
                    { $eq: ['$primaryId', '$$tid'] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { primaryName: 1, canonicalName: 1 } },
          ],
          as: 't',
        },
      },
      {
        $addFields: {
          team: {
            $ifNull: [
              { $arrayElemAt: ['$t.canonicalName', 0] },
              { $ifNull: [{ $arrayElemAt: ['$t.primaryName', 0] }, 'Unknown'] },
            ],
          },
        },
      },
      {
        $group: {
          _id: { location: '$loc', team: '$team' },
          hours: { $sum: '$hours' },
          shifts: { $sum: 1 },
        },
      },
      { $sort: { hours: -1 } },
      { $limit: 30 },
    ])
    .toArray()
  console.log('\n=== eitje_raw_data time_registration (by support id) location/team ===')
  console.log(JSON.stringify(rawBySupport, null, 2))

  // --- raw: by userId candidates ---
  if (allIds.length > 2) {
    const rawByUid = await db
      .collection('eitje_raw_data')
      .aggregate([
        {
          $match: {
            endpoint: 'time_registration_shifts',
            $or: [
              { 'extracted.userId': { $in: allIds } },
              { 'rawApiResponse.user_id': { $in: allIds } },
            ],
          },
        },
        {
          $addFields: {
            hours: {
              $ifNull: [
                { $toDouble: '$extracted.hours' },
                {
                  $ifNull: [
                    { $toDouble: '$extracted.hoursWorked' },
                    { $ifNull: [{ $toDouble: '$rawApiResponse.hours' }, 0] },
                  ],
                },
              ],
            },
            loc: {
              $ifNull: [
                '$extracted.locationName',
                {
                  $ifNull: [
                    '$extracted.environmentName',
                    {
                      $ifNull: [
                        '$rawApiResponse.location_name',
                        { $ifNull: ['$rawApiResponse.environment_name', ''] },
                      ],
                    },
                  ],
                },
              ],
            },
            teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
          },
        },
        {
          $lookup: {
            from: 'unified_team',
            let: { tid: '$teamId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] },
                      { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] },
                      { $eq: ['$primaryId', '$$tid'] },
                    ],
                  },
                },
              },
              { $limit: 1 },
              { $project: { primaryName: 1, canonicalName: 1 } },
            ],
            as: 't',
          },
        },
        {
          $addFields: {
            team: {
              $ifNull: [
                { $arrayElemAt: ['$t.canonicalName', 0] },
                { $ifNull: [{ $arrayElemAt: ['$t.primaryName', 0] }, 'Unknown'] },
              ],
            },
          },
        },
        {
          $group: {
            _id: { location: '$loc', team: '$team' },
            hours: { $sum: '$hours' },
            shifts: { $sum: 1 },
          },
        },
        { $sort: { hours: -1 } },
        { $limit: 30 },
      ])
      .toArray()
    console.log('\n=== eitje_raw_data (by resolved user ids) location/team ===')
    console.log(JSON.stringify(rawByUid, null, 2))
  }

  // counts
  const cAgg = await db.collection('eitje_time_registration_aggregation').countDocuments(aggMatch)
  const cRawS = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts',
    $or: [
      { 'extracted.supportId': { $in: [SUPPORT, sid] } },
      { 'rawApiResponse.support_id': { $in: [SUPPORT, sid] } },
    ],
  })
  console.log('\n=== counts ===')
  console.log({ aggDocsMatchingUserOrName: cAgg, rawShiftsBySupportId: cRawS })

  // --- broader raw: any field that might carry "Leeuwen" ---
  const nameOr = [
    { 'extracted.userName': { $regex: 'leeuwen', $options: 'i' } },
    { 'extracted.name': { $regex: 'leeuwen', $options: 'i' } },
    { 'rawApiResponse.user_name': { $regex: 'leeuwen', $options: 'i' } },
    { 'rawApiResponse.employee_name': { $regex: 'leeuwen', $options: 'i' } },
  ]
  const rawByName = await db
    .collection('eitje_raw_data')
    .find({
      endpoint: 'time_registration_shifts',
      $or: nameOr,
    })
    .project({
      date: 1,
      'extracted.userId': 1,
      'extracted.supportId': 1,
      'rawApiResponse.user_id': 1,
      'rawApiResponse.support_id': 1,
      'extracted.locationName': 1,
      'extracted.environmentName': 1,
    })
    .limit(10)
    .toArray()
  console.log('\n=== eitje_raw_data (name contains leeuwen, sample) ===')
  console.log(JSON.stringify(rawByName, null, 2))

  const contracts = await db
    .collection('test-eitje-contracts')
    .find({
      $or: [
        { employee_name: { $regex: 'leeuwen', $options: 'i' } },
        { support_id: SUPPORT },
        { support_id: sid },
      ],
    })
    .limit(10)
    .toArray()
  console.log('\n=== test-eitje-contracts (leeuwen or support) ===')
  console.log(JSON.stringify(contracts, null, 2))

  const collNames = await db.listCollections().toArray()
  const hasHours = collNames.some((c) => c.name === 'test-eitje-hours')
  if (hasHours) {
    const hoursDocs = await db
      .collection('test-eitje-hours')
      .find({
        $or: [
          { naam: { $regex: 'leeuwen', $options: 'i' } },
          { name: { $regex: 'leeuwen', $options: 'i' } },
        ],
      })
      .limit(5)
      .toArray()
    console.log('\n=== test-eitje-hours (leeuwen) ===')
    console.log(JSON.stringify(hoursDocs, null, 2))
  } else {
    console.log('\n=== test-eitje-hours: collection not present ===')
  }

  const totalRaw = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts',
  })
  const totalAgg = await db.collection('eitje_time_registration_aggregation').countDocuments({})
  console.log('\n=== collection counts (time reg) ===')
  console.log({ eitje_raw_data_time_registration_shifts: totalRaw, eitje_time_registration_aggregation: totalAgg })

  const allCols = await db.listCollections().toArray()
  const interesting = [
    'eitje_raw_data',
    'eitje_time_registration_aggregation',
    'eitje_planning_registration_aggregation',
    'test-eitje-hours',
    'test-eitje-contracts',
    'unified_user',
    'members',
  ]
  console.log('\n=== document counts (selected collections) ===')
  for (const n of interesting) {
    if (!allCols.some((c) => c.name === n)) {
      console.log(n, '(missing)')
      continue
    }
    const total = await db.collection(n).countDocuments({})
    console.log(n, total)
  }

  const rawEndpoints = await db
    .collection('eitje_raw_data')
    .aggregate([{ $group: { _id: '$endpoint', n: { $sum: 1 } } }, { $sort: { n: -1 } }])
    .toArray()
  console.log('\n=== eitje_raw_data endpoints (if any) ===')
  console.log(JSON.stringify(rawEndpoints, null, 2))

  const names = allCols.map((c) => c.name).sort()
  console.log('\n=== all collections in this database ===')
  console.log(names.join(', '))
  const perCol: Record<string, number> = {}
  for (const n of names) {
    perCol[n] = await db.collection(n).countDocuments({})
  }
  console.log('\n=== per-collection document counts ===')
  console.log(JSON.stringify(perCol, null, 2))

  const needle = /leeuwen|123453|aasvanleeuwen/i
  console.log('\n=== collections with at least one doc matching loose needle (sample field scan) ===')
  for (const n of names) {
    if (perCol[n] === 0) continue
    const hit = await db.collection(n).findOne({
      $or: [
        { name: needle },
        { email: needle },
        { support_id: needle },
        { support_id: SUPPORT },
        { support_id: Number(SUPPORT) },
        { 'extracted.userName': needle },
        { 'extracted.name': needle },
        { 'rawApiResponse.user_name': needle },
        { 'rawApiResponse.employee_name': needle },
        { user_name: needle },
        { userId: SUPPORT },
        { userId: Number(SUPPORT) },
      ],
    })
    if (hit) console.log(n, '→ match _id:', hit._id)
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
