/**
 * Validate: Jan 1 2026 CSV eind + API forward → compare Jun 1 2026 CSV.
 * Run: npx tsx scripts/validate-plusmin-jan-to-jun.ts
 */

import { ObjectId } from 'mongodb'
import { getDb } from '../server/utils/db'
import { weeklyHoursFromContractType } from '../utils/dailyOpsLeerlingWageFallback'
import { addCalendarDaysYmd } from '../utils/dailyOpsBusinessDate'
import { isoWeekKey } from '../server/utils/memberWeeklyHours'
import { resolveEitjeAggregationUserCandidates } from '../server/utils/memberEitjeContext'
import { MEMBER_EITJE_SALDO_COLLECTION } from '../server/utils/memberEitjeSaldoSnapshots'
import { PLUSMIN_YTD_BASELINE_DATE } from '../server/utils/memberPlusminBalance'

const JAN = PLUSMIN_YTD_BASELINE_DATE
const JUN = '2026-06-01'
const FORWARD_THROUGH = addCalendarDaysYmd(JUN, -1) // 2026-05-31 — Jun CSV `start` is opening Jun 1

function round2 (n: number): number {
  return Math.round(n * 100) / 100
}

function eachYmdInclusive (start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  while (cur <= end) {
    out.push(cur)
    cur = addCalendarDaysYmd(cur, 1)
  }
  return out
}

function forwardCumulative (
  opening: number,
  from: string,
  through: string,
  weeklyContract: number,
  workedByDay: Map<string, number>,
): { balance: number; worked: number; contract: number } {
  if (from > through) return { balance: opening, worked: 0, contract: 0 }
  let balance = opening
  let worked = 0
  let contract = 0
  const days = eachYmdInclusive(from, through)
  const weekKeys = [...new Set(days.map(isoWeekKey))].sort()
  for (const wk of weekKeys) {
    const wkDays = days.filter((d) => isoWeekKey(d) === wk)
    let w = 0
    for (const d of wkDays) w += workedByDay.get(d) ?? 0
    const c = weeklyContract * (wkDays.length / 7)
    worked += w
    contract += c
    balance += w - c
  }
  return { balance, worked, contract }
}

async function main () {
  const db = await getDb()

  const janSnaps = await db.collection(MEMBER_EITJE_SALDO_COLLECTION)
    .find({ snapshot_date: JAN })
    .toArray()
  const junByMember = new Map(
    (await db.collection(MEMBER_EITJE_SALDO_COLLECTION).find({ snapshot_date: JUN }).toArray())
      .map((s) => [String(s.member_id), s]),
  )

  type Row = {
    name: string
    janEind: number
    junCsvStart: number
    junCsvEind: number
    calcMay31: number
    deltaVsJunStart: number
    deltaVsJunEind: number
    worked: number
    contract: number
    csvJanMayOpbouw: number
    csvJanMayCorrecties: number
  }

  const rows: Row[] = []

  for (const jan of janSnaps) {
    const memberId = String(jan.member_id ?? '')
    const jun = junByMember.get(memberId)
    if (!jun || !memberId) continue

    const member = await db.collection('members').findOne(
      { _id: new ObjectId(memberId) },
      { projection: { name: 1, support_id: 1, contract_type: 1 } },
    )
    if (!member) continue

    const weekly = weeklyHoursFromContractType(String(member.contract_type ?? ''))
    if (weekly == null) continue

    const name = String(member.name ?? jan.employee_name)
    const cands = await resolveEitjeAggregationUserCandidates(
      db,
      member.support_id as string | undefined,
      name,
      { allowFuzzyNameMatch: true },
    )
    const or: Record<string, unknown>[] = []
    if (cands.length) or.push({ userId: { $in: cands } })
    or.push({ user_name: name })
    const agg = await db.collection('eitje_time_registration_aggregation')
      .find({ period_type: 'day', period: { $gte: JAN, $lte: FORWARD_THROUGH }, $or: or })
      .project({ period: 1, total_hours: 1 })
      .toArray()

    const workedByDay = new Map<string, number>()
    for (const r of agg) {
      const p = String(r.period)
      workedByDay.set(p, (workedByDay.get(p) ?? 0) + Number(r.total_hours ?? 0))
    }

    const fwd = forwardCumulative(jan.plusmin.eind, JAN, FORWARD_THROUGH, weekly, workedByDay)

    // Sum monthly CSV opbouw + correcties Feb–May (Jan file = opening only)
    const midSnaps = await db.collection(MEMBER_EITJE_SALDO_COLLECTION)
      .find({
        member_id: memberId,
        snapshot_date: { $gt: JAN, $lt: JUN },
      })
      .sort({ snapshot_date: 1 })
      .toArray()
    let csvOpbouw = 0
    let csvCorrecties = 0
    for (const s of midSnaps) {
      csvOpbouw += Number(s.plusmin?.opbouw ?? 0)
      csvCorrecties += Number(s.plusmin?.correcties ?? 0)
    }
    // Jan month opbouw (on Jan 1 export)
    csvOpbouw += Number(jan.plusmin?.opbouw ?? 0)
    csvCorrecties += Number(jan.plusmin?.correcties ?? 0)
    // Jun 1 export opbouw for single day through export
    csvOpbouw += Number(jun.plusmin?.opbouw ?? 0)
    csvCorrecties += Number(jun.plusmin?.correcties ?? 0)

    const calcMay31 = round2(fwd.balance)
    const junStart = round2(jun.plusmin.start)
    const junEind = round2(jun.plusmin.eind)

    rows.push({
      name,
      janEind: round2(jan.plusmin.eind),
      junCsvStart: junStart,
      junCsvEind: junEind,
      calcMay31,
      deltaVsJunStart: round2(calcMay31 - junStart),
      deltaVsJunEind: round2(calcMay31 - junEind),
      worked: round2(fwd.worked),
      contract: round2(fwd.contract),
      csvJanMayOpbouw: round2(csvOpbouw),
      csvJanMayCorrecties: round2(csvCorrecties),
    })
  }

  rows.sort((a, b) => Math.abs(b.deltaVsJunStart) - Math.abs(a.deltaVsJunStart))

  const within2h = rows.filter((r) => Math.abs(r.deltaVsJunStart) <= 2).length
  const within5h = rows.filter((r) => Math.abs(r.deltaVsJunStart) <= 5).length

  console.log(`\nValidation: Jan 1 eind + forward (${JAN} → ${FORWARD_THROUGH}) vs Jun 1 CSV`)
  console.log(`Members with Jan + Jun snapshot: ${rows.length}`)
  console.log(`Within ±2h of Jun CSV start: ${within2h}/${rows.length}`)
  console.log(`Within ±5h of Jun CSV start: ${within5h}/${rows.length}\n`)

  console.log('name | jan_eind | calc_may31 | jun_start | Δ | worked | contract | csv_opbouw | csv_corr')
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(22)} | ${String(r.janEind).padStart(7)} | ${String(r.calcMay31).padStart(10)} | ${String(r.junCsvStart).padStart(9)} | ${String(r.deltaVsJunStart).padStart(6)} | ${String(r.worked).padStart(6)} | ${String(r.contract).padStart(8)} | ${String(r.csvJanMayOpbouw).padStart(10)} | ${String(r.csvJanMayCorrecties).padStart(7)}`,
    )
  }

  const casper = rows.find((r) => r.name.includes('Casper'))
  if (casper) {
    console.log('\nCasper detail:')
    console.log('  jan eind', casper.janEind, '+ worked', casper.worked, '- contract', casper.contract, '=', casper.calcMay31)
    console.log('  jun CSV start (opening Jun 1)', casper.junCsvStart)
    console.log('  jun CSV eind', casper.junCsvEind)
    console.log('  CSV implied delta jan→jun start', round2(casper.junCsvStart - casper.janEind))
    console.log('  API implied delta', round2(casper.worked - casper.contract))
    console.log('  CSV opbouw sum Jan–Jun opbouw fields', casper.csvJanMayOpbouw)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
