import { MongoClient } from 'mongodb'
async function run() {
  const c = new MongoClient(process.env.MONGODB_URI!)
  await c.connect()
  const db = c.db(process.env.MONGODB_DB_NAME!)

  const master = db.collection('daily_ops_snapshot')
  const labor = db.collection('daily_ops_snapshot_section_labor')
  const revenue = db.collection('daily_ops_snapshot_section_revenue')

  const [mTotal, lTotal, rTotal] = await Promise.all([
    master.countDocuments({}),
    labor.countDocuments({}),
    revenue.countDocuments({}),
  ])

  const dateAgg = await master
    .aggregate([
      { $group: { _id: null, min: { $min: '$businessDate' }, max: { $max: '$businessDate' }, locs: { $addToSet: '$locationId' } } },
    ])
    .toArray()
  const meta = dateAgg[0] ?? null

  // Sample yesterday's labor section for kins
  const sample = await labor.findOne({ businessDate: '2026-05-11', locationId: '69d6cfa63d2adf93b79d1ae7' })
  const sampleSummary = sample
    ? {
        businessDate: sample.businessDate,
        locationName: sample.locationName,
        totals: sample.totals,
        teamCount: (sample.teams ?? []).length,
        firstThreeTeams: (sample.teams ?? []).slice(0, 3).map((t: any) => ({
          team: t.teamName,
          hours: t.hours,
          wages: t.wage_cost,
          loaded: t.loaded_cost,
        })),
      }
    : null

  console.log({
    master_count: mTotal,
    labor_section_count: lTotal,
    revenue_section_count: rTotal,
    date_min: meta?.min,
    date_max: meta?.max,
    locations: meta?.locs?.length ?? 0,
    sample_labor_2026_05_11_kinsbergen: sampleSummary,
  })

  await c.close()
}
run().catch((e) => { console.error(e); process.exit(1) })
