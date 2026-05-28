/**
 * @registry-id: dailyOpsDashboardBundleTodayDetail
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Today revenue hourly detail + inbox cron snapshots for dashboard
 * @adr-ref: ADR-004
 */

import type {
  DailyOpsSnapshotRevenueByOrderTimeSection,
  DailyOpsSnapshotRevenueSection,
} from '~/types/daily-ops-snapshot'
import type { DailyOpsHourlyRevenueRowDto, DailyOpsRevenueBreakdownDto } from '~/types/daily-ops-dashboard'
import type { BorkHourAggregatesBundle, DailyOpsMetricsContext } from '../../dailyOpsDashboardMetrics'
import { VENUE_STRIP_LOCATIONS } from '../../dailyOpsVenueStrip'
import type { LaborByBusinessDateHourBucket } from './laborHourMaps'
import { laborBucketForLocationHour } from './laborHourMaps'
import { round2 } from './shared'

function buildHourlyRevenueRows(
  dateStr: string,
  revenueByHour: Map<number, number>,
  revenueByLocationHour: Map<string, number>,
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): DailyOpsHourlyRevenueRowDto[] {
  const laborHoursByHour = new Map<number, number>()
  for (const [key, row] of laborByLocHour) {
    const parts = key.split('|')
    const date = parts.length >= 3 ? parts[1] : parts[0]
    const hour = Number(parts.length >= 3 ? parts[2] : parts[1])
    if (date !== dateStr || !Number.isFinite(hour) || row.hours <= 0) continue
    laborHoursByHour.set(hour, round2((laborHoursByHour.get(hour) ?? 0) + row.hours))
  }

  return [...revenueByHour.entries()]
    .map(([calendarHour, revenue]) => {
      const laborHours = round2(laborHoursByHour.get(calendarHour) ?? 0)
      return {
        calendarHour,
        revenue: round2(revenue),
        laborHours,
        revenuePerLaborHour: laborHours > 0 ? round2(revenue / laborHours) : null,
        locations: VENUE_STRIP_LOCATIONS.map((location) => {
          const locationRevenue = round2(revenueByLocationHour.get(`${location.locationId}|${calendarHour}`) ?? 0)
          const locationLabor = laborBucketForLocationHour(
            laborByLocHour,
            location.locationId,
            dateStr,
            calendarHour,
          )
          const locLaborHours = round2(locationLabor.hours)
          return {
            locationId: location.locationId,
            locationName: location.locationName,
            revenue: locationRevenue,
            laborHours: locLaborHours,
            revenuePerLaborHour: locLaborHours > 0 ? round2(locationRevenue / locLaborHours) : null,
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
  laborByLocHour: Map<string, LaborByBusinessDateHourBucket>,
): DailyOpsRevenueBreakdownDto['todayRevenueDetail'] {
  const apiHourly = new Map<number, number>()
  const apiHourlyByLocation = new Map<string, number>()
  const orderHourly = new Map<number, number>()
  const orderHourlyByLocation = new Map<string, number>()
  const dateStr = ctx.startDate

  for (const row of hourBundle.byDayHour) {
    if (row._id.d !== dateStr) continue
    const h = Number(row._id.h)
    if (row.revenue <= 0) continue
    apiHourly.set(h, (apiHourly.get(h) ?? 0) + row.revenue)
    if (row._id.loc) {
      const locHourKey = `${row._id.loc}|${h}`
      apiHourlyByLocation.set(locHourKey, (apiHourlyByLocation.get(locHourKey) ?? 0) + row.revenue)
    }
  }
  if (apiHourly.size === 0) {
    for (const row of hourBundle.byHourOnly) {
      if (row.amount <= 0) continue
      apiHourly.set(Number(row._id), (apiHourly.get(Number(row._id)) ?? 0) + row.amount)
    }
  }
  for (const doc of orderTime) {
    if (doc.businessDate !== dateStr) continue
    for (const slot of doc.hourly ?? []) {
      const h = Number(slot.calendar_hour)
      const rev = Number(slot.revenue?.ex_vat ?? 0)
      if (!Number.isFinite(h) || rev <= 0) continue
      orderHourly.set(h, (orderHourly.get(h) ?? 0) + rev)
      orderHourlyByLocation.set(`${doc.locationId}|${h}`, (orderHourlyByLocation.get(`${doc.locationId}|${h}`) ?? 0) + rev)
    }
  }
  if (orderHourly.size === 0) {
    for (const doc of revenue) {
      if (doc.businessDate !== dateStr) continue
      for (const slot of doc.orderHourly ?? []) {
        const h = Number(slot.calendar_hour)
        const rev = Number(slot.revenue?.ex_vat ?? 0)
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
        finalRevenueExVat: round2(Number(intr.revenue_ex_vat ?? 0)),
        locationLabel: doc.locationName ?? doc.locationId,
      })
    }
  }

  if (apiHourly.size === 0 && orderHourly.size === 0 && inboxSnaps.length === 0) return undefined

  return {
    apiHourlyByCalendarHour: buildHourlyRevenueRows(dateStr, apiHourly, apiHourlyByLocation, laborByLocHour),
    orderHourlyByCalendarHour: buildHourlyRevenueRows(dateStr, orderHourly, orderHourlyByLocation, laborByLocHour),
    inboxBasisCronSnapshots: inboxSnaps,
  }
}
