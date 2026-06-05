/**
 * @registry-id: dailyOpsDashboardBundleTodayDetail
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-06-05T02:45:00.000Z
 * @description: Today revenue hourly detail + inbox cron snapshots for dashboard
 * @last-fix: [2026-06-05] Omit flat labor-synthesized productivity; shared sparse-hour redistribution
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotRevenueByOrderTimeSection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { DailyOpsHourlyRevenueRowDto, DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from '../../dailyOpsMetrics/context'
import type { BorkHourAggregatesBundle } from '../../dailyOpsMetrics/types'
import { VENUE_STRIP_LOCATIONS } from '../../venueStrip/constants'
import type { SnapshotLaborByBusinessDateHourBucket } from './laborHourMaps'
import { laborBucketForLocationHour } from './laborHourMaps'
import { locDayKey, revenueScale } from '../drilldown/drilldownShared'
import {
  redistributeRevenueByLaborHours,
  shouldRedistributeSparseHourlyRevenue,
} from '../hourlyRevenueLaborShape'
import { snapshotRound2 } from './shared'

function buildHourlyRevenueRows(
  dateStr: string,
  revenueByHour: Map<number, number>,
  revenueByLocationHour: Map<string, number>,
  laborByLocHour: Map<string, SnapshotLaborByBusinessDateHourBucket>,
): DailyOpsHourlyRevenueRowDto[] {
  const laborHoursByHour = new Map<number, number>()
  for (const [key, row] of laborByLocHour) {
    const parts = key.split('|')
    const date = parts.length >= 3 ? parts[1] : parts[0]
    const hour = Number(parts.length >= 3 ? parts[2] : parts[1])
    if (date !== dateStr || !Number.isFinite(hour) || row.hours <= 0) continue
    laborHoursByHour.set(hour, snapshotRound2((laborHoursByHour.get(hour) ?? 0) + row.hours))
  }

  return [...revenueByHour.entries()]
    .map(([calendarHour, revenue]) => {
      const laborHours = snapshotRound2(laborHoursByHour.get(calendarHour) ?? 0)
      return {
        calendarHour,
        revenue: snapshotRound2(revenue),
        laborHours,
        revenuePerLaborHour: laborHours > 0 ? snapshotRound2(revenue / laborHours) : null,
        locations: VENUE_STRIP_LOCATIONS.map((location) => {
          const locationRevenue = snapshotRound2(
            revenueByLocationHour.get(`${location.locationId}|${calendarHour}`) ?? 0,
          )
          const locationLabor = laborBucketForLocationHour(
            laborByLocHour,
            location.locationId,
            dateStr,
            calendarHour,
          )
          const locLaborHours = snapshotRound2(locationLabor.hours)
          return {
            locationId: location.locationId,
            locationName: location.locationName,
            revenue: locationRevenue,
            laborHours: locLaborHours,
            revenuePerLaborHour: locLaborHours > 0 ? snapshotRound2(locationRevenue / locLaborHours) : null,
          }
        }),
      }
    })
    .sort((a, b) => a.calendarHour - b.calendarHour)
}

export function buildTodayExtrasFromHourBundle(
  ctx: DailyOpsMetricsContext,
  hourBundle: BorkHourAggregatesBundle,
  revenue: DailyOpsSnapshotRevenueSection[],
  orderTime: DailyOpsSnapshotRevenueByOrderTimeSection[],
  laborByLocHour: Map<string, SnapshotLaborByBusinessDateHourBucket>,
  headlineRevenueByLocDay: Map<string, number>,
): DailyOpsRevenueBreakdownDto['todayRevenueDetail'] {
  const apiHourly = new Map<number, number>()
  const apiHourlyByLocation = new Map<string, number>()
  const orderHourly = new Map<number, number>()
  const orderHourlyByLocation = new Map<string, number>()
  const dateStr = ctx.startDate

  const rawByLocDay = new Map<string, number>()
  for (const row of hourBundle.byDayHour) {
    if (row._id.d !== dateStr || !row._id.loc) continue
    const key = locDayKey(dateStr, row._id.loc)
    rawByLocDay.set(key, (rawByLocDay.get(key) ?? 0) + row.revenue)
  }

  for (const row of hourBundle.byDayHour) {
    if (row._id.d !== dateStr) continue
    const h = Number(row._id.h)
    const loc = row._id.loc
    if (!loc) continue
    const scale = revenueScale(dateStr, loc, rawByLocDay, headlineRevenueByLocDay)
    const rev = snapshotRound2(row.revenue * scale)
    if (rev <= 0) continue
    apiHourly.set(h, (apiHourly.get(h) ?? 0) + rev)
    const locHourKey = `${loc}|${h}`
    apiHourlyByLocation.set(locHourKey, (apiHourlyByLocation.get(locHourKey) ?? 0) + rev)
  }

  if (shouldRedistributeSparseHourlyRevenue(dateStr, apiHourly, headlineRevenueByLocDay)) {
    const redistributed = redistributeRevenueByLaborHours(dateStr, headlineRevenueByLocDay, laborByLocHour)
    apiHourly.clear()
    apiHourlyByLocation.clear()
    for (const [hour, revenue] of redistributed.byHour) apiHourly.set(hour, revenue)
    for (const [key, revenue] of redistributed.byLocationHour) apiHourlyByLocation.set(key, revenue)
  }

  for (const doc of orderTime) {
    if (doc.businessDate !== dateStr) continue
    const scale = revenueScale(dateStr, doc.locationId, rawByLocDay, headlineRevenueByLocDay)
    for (const slot of doc.hourly ?? []) {
      const h = Number(slot.calendar_hour)
      const rev = snapshotRound2(Number(slot.revenue?.ex_vat ?? 0) * scale)
      if (!Number.isFinite(h) || rev <= 0) continue
      orderHourly.set(h, (orderHourly.get(h) ?? 0) + rev)
      orderHourlyByLocation.set(`${doc.locationId}|${h}`, (orderHourlyByLocation.get(`${doc.locationId}|${h}`) ?? 0) + rev)
    }
  }
  if (orderHourly.size === 0) {
    for (const doc of revenue) {
      if (doc.businessDate !== dateStr) continue
      const scale = revenueScale(dateStr, doc.locationId, rawByLocDay, headlineRevenueByLocDay)
      for (const slot of doc.orderHourly ?? []) {
        const h = Number(slot.calendar_hour)
        const rev = snapshotRound2(Number(slot.revenue?.ex_vat ?? 0) * scale)
        if (!Number.isFinite(h) || rev <= 0) continue
        orderHourly.set(h, (orderHourly.get(h) ?? 0) + rev)
        orderHourlyByLocation.set(`${doc.locationId}|${h}`, (orderHourlyByLocation.get(`${doc.locationId}|${h}`) ?? 0) + rev)
      }
    }
  }

  const inboxSnaps: NonNullable<DailyOpsRevenueBreakdownDto['todayRevenueDetail']>['inboxBasisCronSnapshots'] = []
  for (const doc of revenue) {
    for (const intr of doc.intraday ?? []) {
      const cronHour = Number(intr.cron_hour)
      if (cronHour !== 15 && cronHour !== 23) continue
      inboxSnaps.push({
        cronHour,
        finalRevenueExVat: snapshotRound2(Number(intr.revenue_ex_vat ?? 0)),
        locationLabel: doc.locationName ?? doc.locationId,
      })
    }
  }

  if (apiHourly.size === 0 && orderHourly.size === 0 && inboxSnaps.length === 0) return undefined

  return {
    apiHourlyByCalendarHour: buildHourlyRevenueRows(
      dateStr,
      apiHourly,
      apiHourlyByLocation,
      laborByLocHour,
    ),
    orderHourlyByCalendarHour: buildHourlyRevenueRows(
      dateStr,
      orderHourly,
      orderHourlyByLocation,
      laborByLocHour,
    ),
    inboxBasisCronSnapshots: inboxSnaps,
  }
}
