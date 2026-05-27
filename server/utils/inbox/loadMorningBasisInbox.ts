/**
 * @description: Load morning-final Basis inbox rows (cron 7|8) for headline SSOT at read time.
 */

import type { Db } from 'mongodb'
import { isMorningFinalBasisCron, morningInboxMapKey, type BasisReportData } from './basis-report-mapper'

/** Dashboard register day for a stored Basis row (`date` on sheet = Dinsdag label). */
function registerDayKeyForRow(row: { date?: unknown; business_date?: unknown; location_id?: unknown }): string | null {
  const loc = String(row.location_id ?? '')
  if (!loc) return null
  const date = String(row.date ?? '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return morningInboxMapKey(date, loc)
  const bd = String(row.business_date ?? '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) return morningInboxMapKey(bd, loc)
  return null
}

export async function loadMorningBasisInboxByLocDate(
  db: Db,
  startDate: string,
  endDate: string,
): Promise<Map<string, BasisReportData[]>> {
  const rows = await db
    .collection('inbox-bork-basis-report')
    .find({
      cron_hour: { $in: [7, 8] },
      $or: [
        { business_date: { $gte: startDate, $lte: endDate } },
        { date: { $gte: startDate, $lte: endDate } },
      ],
    })
    .toArray()

  const map = new Map<string, BasisReportData[]>()
  for (const row of rows) {
    if (!isMorningFinalBasisCron(Number(row.cron_hour))) continue
    const key = registerDayKeyForRow(row)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(row as unknown as BasisReportData)
    map.set(key, list)
  }
  return map
}
