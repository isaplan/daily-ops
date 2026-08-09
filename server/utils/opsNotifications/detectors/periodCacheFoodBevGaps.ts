/**
 * @registry-id: opsNotificationsPeriodCacheFoodBevGaps
 * @created: 2026-08-09T00:30:00.000Z
 * @last-modified: 2026-08-09T00:30:00.000Z
 * @description: Alert when period-cache food/bev used regex fallback for product ids
 * @last-fix: [2026-08-09] PERIOD_CACHE_ADR L3 — no silent guessing
 * @adr-ref: PERIOD_CACHE_ADR L3
 *
 * @exports-to:
 * ✓ server/utils/opsNotifications/runOpsNotificationScan.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsPeriodNode } from '~/types/daily-ops-period-cache'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import { DAILY_OPS_PERIOD_CACHE_COLLECTION } from '../../dailyOpsPeriodCache/store'
import { buildNotificationItem } from '../notificationItem'
import type { OpsScanWindow } from '../scanContext'

export async function detectPeriodCacheFoodBevGapNotifications (
  db: Db,
  window: OpsScanWindow,
  locName: Map<string, string>,
): Promise<OpsNotificationDto[]> {
  const docs = await db
    .collection<DailyOpsPeriodNode>(DAILY_OPS_PERIOD_CACHE_COLLECTION)
    .find({
      level: 'day',
      periodKey: { $gte: window.startDate, $lte: window.endDate },
      'provenance.regexFallbackProductIds.0': { $exists: true },
    })
    .project({
      periodKey: 1,
      locationId: 1,
      'provenance.regexFallbackProductIds': 1,
    })
    .toArray()

  type Acc = {
    productId: string
    locationId: string
    dates: Set<string>
  }
  const byProductVenue = new Map<string, Acc>()

  for (const doc of docs) {
    const ids = doc.provenance?.regexFallbackProductIds ?? []
    for (const productId of ids) {
      if (!productId) continue
      const key = `${doc.locationId}:::${productId}`
      let row = byProductVenue.get(key)
      if (!row) {
        row = { productId, locationId: doc.locationId, dates: new Set() }
        byProductVenue.set(key, row)
      }
      row.dates.add(doc.periodKey)
    }
  }

  const items: OpsNotificationDto[] = []
  for (const row of byProductVenue.values()) {
    const dates = [...row.dates].sort()
    const sampleDate = dates[dates.length - 1]!
    const name = locName.get(row.locationId) ?? row.locationId
    items.push(
      buildNotificationItem({
        kind: 'period_cache_food_bev_regex_gap',
        businessDate: sampleDate,
        locationId: row.locationId,
        locationName: name,
        message: `Product ${row.productId} classified food/beverage via regex fallback (no catalog/inbox category) on ${dates.length} day(s) in scan window. Latest: ${sampleDate}.`,
        fixHint: `Set product_catalog.category to food|beverage for productId=${row.productId}, then re-run period-cache backfill for affected dates.`,
        meta: {
          productId: row.productId,
          dates,
          dayCount: dates.length,
        },
      }),
    )
  }

  return items
}
