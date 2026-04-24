/**
 * @registry-id: borkSalesDailyAggregation
 * @created: 2026-04-24T00:00:00.000Z
 * @last-modified: 2026-04-24T00:00:00.000Z
 * @description: Daily revenue summary per location (final closing report received 06:00+ UTC+1)
 * @last-fix: [2026-04-24] Initial — aggregate bork_sales by date+location for daily reports
 *
 * @exports-to:
 * ✓ server/api/inbox/process/[emailId].post.ts (on attachment complete)
 * ✓ server/api/sales-daily.get.ts (future UI endpoint)
 */

import { ObjectId, type Db } from 'mongodb'
import { getDb } from '../utils/db'

export interface BorkSalesDailyDoc {
  _id?: ObjectId
  date: Date
  location_name: string | null
  total_revenue: number
  item_count: number
  email_received_at: Date
  first_email_id?: ObjectId
  last_email_id?: ObjectId
  source_emails: ObjectId[]
  created_at: Date
  updated_at: Date
}

export async function aggregateDailySalesForEmail(emailId: ObjectId, db?: Db): Promise<void> {
  const database = db ?? (await getDb())

  const salesRows = await database
    .collection('bork_sales')
    .find({ source: 'inbox', sourceEmailId: emailId })
    .toArray()

  if (salesRows.length === 0) return

  // Group by date + location_name
  const groupKey: Record<string, Array<Record<string, unknown>>> = {}
  for (const row of salesRows) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date)
    const locStr = String(row.location_name || 'unknown')
    const key = `${dateStr}|${locStr}`
    if (!groupKey[key]) groupKey[key] = []
    groupKey[key].push(row)
  }

  const dailyDocs: BorkSalesDailyDoc[] = []
  const now = new Date()

  for (const [key, rows] of Object.entries(groupKey)) {
    const [dateStr, locationName] = key.split('|')
    const [year, month, day] = dateStr.split('-').map((x) => parseInt(x, 10))
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))

    const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0)
    const itemCount = rows.length

    dailyDocs.push({
      date,
      location_name: locationName === 'unknown' ? null : locationName,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      item_count: itemCount,
      email_received_at: now,
      source_emails: [emailId],
      created_at: now,
      updated_at: now,
    })
  }

  // Upsert daily docs
  const dailyCollection = database.collection('bork_sales_daily')
  for (const doc of dailyDocs) {
    await dailyCollection.updateOne(
      { date: doc.date, location_name: doc.location_name },
      {
        $set: {
          total_revenue: doc.total_revenue,
          item_count: doc.item_count,
          email_received_at: doc.email_received_at,
          updated_at: now,
        },
        $addToSet: { source_emails: emailId },
        $setOnInsert: {
          created_at: now,
        },
      },
      { upsert: true }
    )
  }
}
