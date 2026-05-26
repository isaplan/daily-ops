/**
 * @registry-id: dailyOpsAttendanceKpis
 * @created: 2026-05-26T00:43:00.000Z
 * @last-modified: 2026-05-26T01:54:00.000Z
 * @description: Lazy Daily Ops attendance KPIs from local Eitje synced data/aggregations.
 * @last-fix: [2026-05-26] Add planned to actual worked hours for KPI tile and drawer data.
 *
 * @exports-to:
 * ✓ server/api/daily-ops/metrics/attendance-kpis.get.ts
 */

import type { Db } from 'mongodb'
import type {
  DailyOpsAttendanceKpiBlockDto,
  DailyOpsAttendanceKpisDto,
  DailyOpsAttendanceStaffRowDto,
  DailyOpsAttendanceVenueDto,
} from '../../types/daily-ops-dashboard'
import type { DailyOpsMetricsContext } from './dailyOpsDashboardMetrics'
import { VENUE_STRIP_LOCATIONS } from './dailyOpsVenueStrip'
import { EITJE_HOURS_ADD_FIELDS } from './eitjeHours'
import { addCalendarDaysYmd } from '~/utils/dailyOpsBusinessDate'

type AttendanceRow = DailyOpsAttendanceStaffRowDto & {
  locationId: string
  locationName: string
}

const AMSTERDAM_TZ = 'Europe/Amsterdam'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function dayStartUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
}

function dayEndUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
}

function formatAmsterdamTime(value: unknown): string | undefined {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null
  if (!d || Number.isNaN(d.getTime())) return undefined
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatAmsterdamDate(value: unknown): string | undefined {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null
  if (!d || Number.isNaN(d.getTime())) return undefined
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: AMSTERDAM_TZ,
    day: '2-digit',
    month: 'short',
  }).format(d)
}

function emptyVenue(locationId: string, locationName: string): DailyOpsAttendanceVenueDto {
  return { locationId, locationName, workers: 0, hours: 0, loaded: 0, rows: [] }
}

function buildBlock(rows: AttendanceRow[]): DailyOpsAttendanceKpiBlockDto {
  const venues = new Map(
    VENUE_STRIP_LOCATIONS.map((v) => [v.locationId, emptyVenue(v.locationId, v.locationName)]),
  )
  const allWorkers = new Set<string>()

  for (const row of rows) {
    const venue = venues.get(row.locationId) ?? emptyVenue(row.locationId, row.locationName)
    venues.set(row.locationId, venue)
    venue.rows.push(row)
    venue.hours += row.hours
    venue.loaded += row.loaded
    if (row.userId) allWorkers.add(row.userId)
  }

  for (const venue of venues.values()) {
    const workers = new Set(venue.rows.map((r) => r.userId).filter(Boolean))
    venue.workers = workers.size
    venue.hours = round2(venue.hours)
    venue.loaded = round2(venue.loaded)
    venue.rows.sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName))
  }

  const venueList = Array.from(venues.values())
  return {
    workers: allWorkers.size,
    hours: round2(venueList.reduce((sum, v) => sum + v.hours, 0)),
    loaded: round2(venueList.reduce((sum, v) => sum + v.loaded, 0)),
    venues: venueList,
  }
}

async function fetchPlannedRows(db: Db, businessDate: string): Promise<AttendanceRow[]> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const docs = await db.collection('eitje_raw_data').aggregate([
    {
      $match: {
        endpoint: 'planning_shifts',
        date: { $gte: dayStartUtc(businessDate), $lte: dayEndUtc(businessDate) },
      },
    },
    {
      $addFields: {
        startAt: { $toDate: '$rawApiResponse.start' },
        endAt: { $toDate: '$rawApiResponse.end' },
        breakMinutes: { $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] },
        userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user.id'] },
        teamName: { $ifNull: ['$rawApiResponse.team.name', 'Unknown'] },
        userName: { $ifNull: ['$rawApiResponse.user.name', 'Unknown'] },
        environmentId: {
          $ifNull: [
            '$environmentId',
            '$extracted.environmentId',
            '$rawApiResponse.environment_id',
            '$rawApiResponse.environment.id',
          ],
        },
      },
    },
    {
      $addFields: {
        hours: {
          $max: [
            0,
            {
              $subtract: [
                { $divide: [{ $subtract: ['$endAt', '$startAt'] }, 3600000] },
                { $divide: ['$breakMinutes', 60] },
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: 'unified_location',
        let: { eid: '$environmentId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$$eid', null] },
                  { $in: ['$$eid', { $ifNull: ['$eitjeIds', []] }] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { primaryId: 1, primaryName: 1 } },
        ],
        as: 'loc',
      },
    },
    {
      $addFields: {
        locationId: { $toString: { $arrayElemAt: ['$loc.primaryId', 0] } },
        locationName: { $ifNull: [{ $arrayElemAt: ['$loc.primaryName', 0] }, '$rawApiResponse.environment.name'] },
      },
    },
    { $match: { locationId: { $in: locationIds } } },
    {
      $lookup: {
        from: 'eitje_raw_data',
        let: {
          actualShiftId: '$rawApiResponse.time_registration_shift_id',
        },
        pipeline: [
          {
            $match: {
              endpoint: 'time_registration_shifts',
              $expr: {
                $and: [
                  { $ne: ['$$actualShiftId', null] },
                  {
                    $or: [
                      { $eq: ['$rawApiResponse.id', '$$actualShiftId'] },
                      { $eq: ['$rawApiResponse.support_id', '$$actualShiftId'] },
                      { $eq: ['$extracted.supportId', '$$actualShiftId'] },
                    ],
                  },
                ],
              },
            },
          },
          { $addFields: EITJE_HOURS_ADD_FIELDS },
          {
            $group: {
              _id: null,
              actualHours: { $sum: '$hours' },
            },
          },
        ],
        as: 'actual',
      },
    },
    {
      $project: {
        locationId: 1,
        locationName: 1,
        userId: { $toString: '$userId' },
        userName: 1,
        teamName: 1,
        hours: 1,
        actualHours: { $ifNull: [{ $arrayElemAt: ['$actual.actualHours', 0] }, 0] },
        startAt: 1,
        endAt: 1,
      },
    },
  ]).toArray()

  return docs.map((d) => ({
    locationId: String(d.locationId ?? ''),
    locationName: String(d.locationName ?? ''),
    userId: String(d.userId ?? ''),
    userName: String(d.userName ?? 'Unknown'),
    teamName: String(d.teamName ?? 'Unknown'),
    hours: round2(Number(d.hours ?? 0)),
    actualHours: round2(Number(d.actualHours ?? 0)),
    loaded: 0,
    startLabel: formatAmsterdamTime(d.startAt),
    endLabel: formatAmsterdamTime(d.endAt),
  }))
}

async function fetchSickRows(db: Db, businessDate: string): Promise<AttendanceRow[]> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const docs = await db.collection('eitje_time_registration_aggregation')
    .find({
      period_type: 'day',
      period: businessDate,
      locationId: { $in: locationIds },
      team_name: /^ziek$/i,
    })
    .toArray()

  return docs.map((d) => ({
    locationId: String(d.locationId ?? ''),
    locationName: String(d.location_name ?? ''),
    userId: String(d.userId ?? ''),
    userName: String(d.user_name ?? 'Unknown'),
    teamName: String(d.team_name ?? 'Ziek'),
    hours: round2(Number(d.total_hours ?? 0)),
    loaded: round2(Number(d.total_cost_loaded ?? 0)),
  }))
}

function overlapHours(start: unknown, end: unknown, windowStart: Date, windowEnd: Date): number {
  const s = start instanceof Date ? start : start ? new Date(String(start)) : null
  const e = end instanceof Date ? end : end ? new Date(String(end)) : null
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0
  const from = Math.max(s.getTime(), windowStart.getTime())
  const to = Math.min(e.getTime(), windowEnd.getTime())
  return round2(Math.max(0, (to - from) / 3600000))
}

async function fetchLeaveRows(db: Db, businessDate: string): Promise<AttendanceRow[]> {
  const locationIds = VENUE_STRIP_LOCATIONS.map((v) => v.locationId)
  const windowStart = dayStartUtc(businessDate)
  const windowEnd = dayStartUtc(addCalendarDaysYmd(businessDate, 1))
  const docs = await db.collection('eitje_leave_requests_aggregation')
    .find({
      locationId: { $in: locationIds },
      earliest_start: { $lt: windowEnd },
      latest_end: { $gt: windowStart },
    })
    .toArray()

  return docs
    .map((d) => {
      const hours = overlapHours(d.earliest_start, d.latest_end, windowStart, windowEnd)
      return {
        locationId: String(d.locationId ?? ''),
        locationName: String(d.location_name ?? ''),
        userId: String(d.userId ?? ''),
        userName: String(d.user_name ?? 'Unknown'),
        teamName: String(d.reason ?? d.process_reason ?? 'Verlof'),
        hours,
        loaded: 0,
        fromLabel: formatAmsterdamDate(d.earliest_start),
        toLabel: formatAmsterdamDate(d.latest_end),
        reason: String(d.reason ?? ''),
        status: String(d.status ?? ''),
      }
    })
    .filter((row) => row.hours > 0)
}

export async function fetchDailyOpsAttendanceKpis(
  db: Db,
  ctx: DailyOpsMetricsContext,
): Promise<DailyOpsAttendanceKpisDto> {
  const [plannedRows, leaveRows, sickRows] = await Promise.all([
    fetchPlannedRows(db, ctx.startDate),
    fetchLeaveRows(db, ctx.startDate),
    fetchSickRows(db, ctx.startDate),
  ])

  return {
    range: {
      period: ctx.period,
      startDate: ctx.startDate,
      endDate: ctx.endDate,
    },
    planned: buildBlock(plannedRows),
    leave: buildBlock(leaveRows),
    sick: buildBlock(sickRows),
  }
}
