import { getDb } from '../server/utils/db'
import { addCalendarDaysYmd, amsterdamOpenRegisterBusinessDateYmd, calendarYmdInAmsterdam } from '../utils/dailyOpsBusinessDate'

async function main() {
  const db = await getDb()
  const now = new Date()
  const open = amsterdamOpenRegisterBusinessDateYmd(now)
  const yesterday = addCalendarDaysYmd(open, -1)
  const todayCal = calendarYmdInAmsterdam(now)

  console.log('Now (UTC):', now.toISOString())
  console.log('Open register business_date:', open)
  console.log('Dashboard "yesterday" business_date:', yesterday)
  console.log('Today calendar (Amsterdam):', todayCal)
  console.log('')

  const coll = db.collection('inbox-bork-basis-report')

  const byBusinessDate = await coll
    .find({ business_date: yesterday, cron_hour: { $in: [7, 8] } })
    .sort({ location: 1, cron_hour: 1 })
    .toArray()

  const byDateField = await coll
    .find({ date: yesterday, cron_hour: { $in: [7, 8] } })
    .sort({ location: 1, cron_hour: 1 })
    .toArray()

  const receivedToday = await coll
    .find({
      cron_hour: { $in: [7, 8] },
      received_at: {
        $gte: new Date(`${todayCal}T00:00:00.000Z`),
      },
    })
    .sort({ received_at: -1 })
    .toArray()

  const print = (label: string, rows: typeof byBusinessDate) => {
    console.log(`--- ${label} (${rows.length} rows) ---`)
    if (rows.length === 0) {
      console.log('  (none)')
      return
    }
    for (const r of rows) {
      const recv = r.received_at instanceof Date ? r.received_at.toISOString() : String(r.received_at ?? '')
      console.log(
        `  ${String(r.location).padEnd(22)} cron=${r.cron_hour} bd=${r.business_date} date=${r.date} ex=${r.final_revenue_ex_vat} inc=${r.final_revenue_incl_vat} received=${recv}`,
      )
      console.log(`    subject: ${(r.metadata as { email_subject?: string })?.email_subject ?? '—'}`)
    }
  }

  print(`Morning cron 7|8 where business_date = ${yesterday}`, byBusinessDate)
  print(`Morning cron 7|8 where date = ${yesterday}`, byDateField)
  print(`Morning cron 7|8 received since ${todayCal} 00:00Z`, receivedToday)

  const cronRuns = await db
    .collection('integration_cron_runs')
    .find({
      source: { $in: ['inbox', 'gmail'] },
      startedAt: { $gte: new Date(Date.now() - 48 * 3600 * 1000) },
    })
    .sort({ startedAt: -1 })
    .limit(10)
    .toArray()
    .catch(() => [])

  if (cronRuns.length > 0) {
    console.log('\n--- Recent inbox/gmail cron runs ---')
    for (const r of cronRuns) {
      console.log(`  ${r.startedAt} ${r.source} ${r.jobType ?? r.status} ok=${r.ok}`)
    }
  } else {
    console.log('\n(no integration_cron_runs for inbox/gmail in last 48h — collection may differ)')
  }

  const gmailTasks = await db
    .collection('nitro_tasks')
    .find({})
    .limit(1)
    .toArray()
    .catch(() => [])
  void gmailTasks
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
