/**
 * Data integrity checks: duplicates, normalization, aggregation-vs-raw sums.
 * Used by GET /api/data-integrity/run and optionally by cron/workers.
 *
 * @registry-id: dataIntegrityService
 * @description: Validation workers to prevent data drift (duplicates, missing fields, sum mismatches)
 */

import { getDb } from '../utils/db'
import { EITJE_HOURS_ADD_FIELDS, getUtcDayRange } from '../utils/eitjeHours'
import { ObjectId } from 'mongodb'

export type IntegrityCheckKind = 'duplicates_raw' | 'duplicates_aggregation' | 'normalization' | 'sums'

export interface IntegrityRunOptions {
  startDate?: string
  endDate?: string
  endpoint?: string
  checks?: IntegrityCheckKind[] // default: all
  /** Max duplicate groups to return (default 50) */
  duplicateLimit?: number
  /** Tolerance in hours for sum mismatch (default 0.02) */
  sumsTolerance?: number
}

export interface DuplicateGroupRaw {
  date: string
  locationId: string | null
  userId: string | number | null
  teamId: string | number | null
  supportId: string | number | null
  count: number
  docIds: string[]
}

export interface DuplicateGroupAggregation {
  period: string
  locationId: string | null
  userId: string | null
  teamId: string | null
  count: number
}

export interface NormalizationIssue {
  collection: string
  docId: string
  reason: string
  /** Optional field that is missing or invalid */
  field?: string
}

export interface SumMismatch {
  date: string
  location_name: string
  location_id: string
  row_total: number
  raw_sum: number
  raw_count: number
  row_record_count: number
  diff: number
}

export interface IntegrityReport {
  ok: boolean
  ranAt: string
  options: { startDate?: string; endDate?: string; checks: IntegrityCheckKind[] }
  duplicates_raw?: {
    ok: boolean
    totalDuplicateGroups: number
    totalExtraDocs: number
    groups: DuplicateGroupRaw[]
  }
  duplicates_aggregation?: {
    ok: boolean
    totalDuplicateGroups: number
    groups: DuplicateGroupAggregation[]
  }
  normalization?: {
    ok: boolean
    raw: { total: number; withIssues: number; issues: NormalizationIssue[] }
    aggregation: { total: number; withIssues: number; issues: NormalizationIssue[] }
  }
  sums?: {
    ok: boolean
    total_rows: number
    ok_count: number
    mismatch_count: number
    mismatches: SumMismatch[]
    possible_causes: string
  }
}

const DEFAULT_CHECKS: IntegrityCheckKind[] = ['duplicates_raw', 'duplicates_aggregation', 'normalization', 'sums']

function getDefaultDateRange (): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

/** Check for duplicate raw records (same date+location+user+team or same support_id). */
export async function checkRawDuplicates (options: {
  startDate: string
  endDate: string
  endpoint?: string
  limit?: number
}): Promise<{ ok: boolean; totalDuplicateGroups: number; totalExtraDocs: number; groups: DuplicateGroupRaw[] }> {
  const db = await getDb()
  const endpoint = options.endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'
  const limit = options.limit ?? 50

  const match: Record<string, unknown> = {
    endpoint,
    date: {
      $gte: new Date(options.startDate + 'T00:00:00.000Z'),
      $lte: new Date(options.endDate + 'T23:59:59.999Z'),
    },
  }

  const pipeline: unknown[] = [
    { $match: match },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          locationId: '$locationId',
          userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] },
          teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
          supportId: { $ifNull: ['$extracted.supportId', '$rawApiResponse.support_id'] },
        },
        count: { $sum: 1 },
        docIds: { $push: { $toString: '$_id' } },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: limit },
  ]

  const groups = await db.collection('eitje_raw_data').aggregate(pipeline).toArray() as Array<{
    _id: { date: string; locationId: unknown; userId: unknown; teamId: unknown; supportId: unknown }
    count: number
    docIds: string[]
  }>

  let totalExtraDocs = 0
  const out: DuplicateGroupRaw[] = groups.map((g) => {
    totalExtraDocs += g.count - 1
    return {
      date: g._id.date,
      locationId: g._id.locationId != null ? String(g._id.locationId) : null,
      userId: g._id.userId ?? null,
      teamId: g._id.teamId ?? null,
      supportId: g._id.supportId ?? null,
      count: g.count,
      docIds: g.docIds.slice(0, 10),
    }
  })

  const totalDuplicateGroups = groups.length
  return {
    ok: totalDuplicateGroups === 0,
    totalDuplicateGroups,
    totalExtraDocs,
    groups: out,
  }
}

/** Check for duplicate aggregation docs (same period+locationId+userId+teamId). */
export async function checkAggregationDuplicates (options: {
  startDate: string
  endDate: string
  endpoint?: string
  limit?: number
}): Promise<{ ok: boolean; totalDuplicateGroups: number; groups: DuplicateGroupAggregation[] }> {
  const db = await getDb()
  const collectionName = options.endpoint === 'planning_shifts'
    ? 'eitje_planning_registration_aggregation'
    : 'eitje_time_registration_aggregation'
  const limit = options.limit ?? 50

  const pipeline: unknown[] = [
    {
      $match: {
        period_type: 'day',
        period: { $gte: options.startDate, $lte: options.endDate },
      },
    },
    {
      $group: {
        _id: {
          period: '$period',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: limit },
  ]

  const groups = await db.collection(collectionName).aggregate(pipeline).toArray() as Array<{
    _id: { period: string; locationId: unknown; userId: unknown; teamId: unknown }
    count: number
  }>

  const out: DuplicateGroupAggregation[] = groups.map((g) => ({
    period: g._id.period,
    locationId: g._id.locationId != null ? String(g._id.locationId) : null,
    userId: g._id.userId != null ? String(g._id.userId) : null,
    teamId: g._id.teamId != null ? String(g._id.teamId) : null,
    count: g.count,
  }))

  return {
    ok: groups.length === 0,
    totalDuplicateGroups: groups.length,
    groups: out,
  }
}

/** Check raw and aggregation docs have required/normalized fields. */
export async function checkNormalization (options: { endpoint?: string }): Promise<{
  raw: { total: number; withIssues: number; issues: NormalizationIssue[] }
  aggregation: { total: number; withIssues: number; issues: NormalizationIssue[] }
}> {
  const db = await getDb()
  const endpoint = options.endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'
  const rawMatch = { endpoint }
  const aggMatch = { period_type: 'day' }

  const rawTotal = await db.collection('eitje_raw_data').countDocuments(rawMatch)
  const aggTotal = await db.collection('eitje_time_registration_aggregation').countDocuments(aggMatch)

  const rawIssues: NormalizationIssue[] = []
  const aggIssues: NormalizationIssue[] = []

  const rawCursor = db.collection('eitje_raw_data').find(rawMatch).limit(5000)
  for await (const doc of rawCursor) {
    const id = (doc as { _id?: unknown })._id != null ? String((doc as { _id: unknown })._id) : ''
    if (doc.date == null) rawIssues.push({ collection: 'eitje_raw_data', docId: id, reason: 'missing date', field: 'date' })
    const hasLocation = doc.locationId != null || doc.environmentId != null
    if (!hasLocation) rawIssues.push({ collection: 'eitje_raw_data', docId: id, reason: 'missing locationId and environmentId', field: 'locationId' })
    if (rawIssues.length >= 100) break
  }

  const aggCursor = db.collection('eitje_time_registration_aggregation').find(aggMatch).limit(5000)
  for await (const doc of aggCursor) {
    const id = (doc as { _id?: unknown })._id != null ? String((doc as { _id: unknown })._id) : ''
    if (doc.period == null) aggIssues.push({ collection: 'eitje_time_registration_aggregation', docId: id, reason: 'missing period', field: 'period' })
    if (doc.total_hours == null && doc.total_hours !== 0) aggIssues.push({ collection: 'eitje_time_registration_aggregation', docId: id, reason: 'missing total_hours', field: 'total_hours' })
    if (doc.record_count == null && doc.record_count !== 0) aggIssues.push({ collection: 'eitje_time_registration_aggregation', docId: id, reason: 'missing record_count', field: 'record_count' })
    if (aggIssues.length >= 100) break
  }

  return {
    raw: { total: rawTotal, withIssues: rawIssues.length, issues: rawIssues.slice(0, 50) },
    aggregation: { total: aggTotal, withIssues: aggIssues.length, issues: aggIssues.slice(0, 50) },
  }
}

/** Check aggregation row totals match sum of raw records per (date, location). */
export async function checkAggregationVsRawSums (options: {
  startDate: string
  endDate: string
  endpoint?: string
  tolerance?: number
}): Promise<{
  ok: boolean
  total_rows: number
  ok_count: number
  mismatch_count: number
  mismatches: SumMismatch[]
  possible_causes: string
}> {
  const db = await getDb()
  const endpoint = options.endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'
  const tolerance = options.tolerance ?? 0.02
  const collectionName = endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation'

  const aggPipeline: unknown[] = [
    { $match: { period_type: 'day', period: { $gte: options.startDate, $lte: options.endDate } } },
    {
      $group: {
        _id: { period: '$period', locationId: '$locationId' },
        location_name: { $first: '$location_name' },
        total_hours: { $sum: '$total_hours' },
        record_count: { $sum: '$record_count' },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id.period',
        location_id: '$_id.locationId',
        location_name: { $ifNull: ['$location_name', 'Unknown'] },
        total_hours: 1,
        record_count: 1,
      },
    },
  ]
  const rows = await db.collection(collectionName).aggregate(aggPipeline).toArray() as Array<{
    date: string
    location_id: unknown
    location_name: string
    total_hours: number
    record_count: number
  }>

  const mismatches: SumMismatch[] = []
  let okCount = 0

  for (const row of rows) {
    const dateStr = typeof row.date === 'string' ? row.date.slice(0, 10) : new Date(row.date).toISOString().slice(0, 10)
    const locationIdParam = row.location_id != null ? String(row.location_id) : undefined

    let match: Record<string, unknown>
    if (locationIdParam) {
      let locationIdObj: ObjectId | null = null
      try {
        locationIdObj = new ObjectId(locationIdParam)
      } catch {
        // ignore
      }
      const locIdStr = String(locationIdParam)
      const locationDoc = await db.collection('unified_location').findOne({
        $or: [
          ...(locationIdObj ? [{ primaryId: locationIdObj }] : []),
          { allIdValues: locationIdObj },
          { allIdValues: locIdStr },
          { eitjeIds: locationIdParam },
        ].filter(Boolean),
      }) as { eitjeIds?: number[] } | null
      const eitjeIds = locationDoc?.eitjeIds ?? []
      const { dayStart, dayEnd } = getUtcDayRange(dateStr)
      const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }
      const locationClauses: Record<string, unknown>[] = []
      if (locationIdObj) locationClauses.push({ locationId: locationIdObj })
      locationClauses.push({ locationId: locIdStr })
      if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } })
      match = {
        endpoint,
        $and: [dateCondition, { $or: locationClauses }],
      }
    } else {
      const { dayStart, dayEnd } = getUtcDayRange(dateStr)
      match = {
        endpoint,
        $and: [{ $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }],
      }
    }

    const rawSumPipeline: unknown[] = [
      { $match: match },
      { $addFields: EITJE_HOURS_ADD_FIELDS },
      { $group: { _id: null, raw_sum: { $sum: '$hours' }, raw_count: { $sum: 1 } } },
    ]
    const rawResult = await db.collection('eitje_raw_data').aggregate(rawSumPipeline).toArray() as Array<{ raw_sum: number; raw_count: number }>
    const raw_sum = rawResult[0]?.raw_sum ?? 0
    const raw_count = rawResult[0]?.raw_count ?? 0
    const row_total = Number(row.total_hours ?? 0)
    const diff = Math.abs(raw_sum - row_total)
    if (diff > tolerance) {
      mismatches.push({
        date: dateStr,
        location_name: row.location_name ?? 'Unknown',
        location_id: locationIdParam ?? '',
        row_total,
        raw_sum: Math.round(raw_sum * 100) / 100,
        raw_count,
        row_record_count: row.record_count ?? 0,
        diff: Math.round(diff * 100) / 100,
      })
    } else {
      okCount++
    }
  }

  const possible_causes = 'When row total ≠ sum of raw: (1) Date/timezone (2) Location mapping environmentId vs locationId (3) Duplicates in raw (4) Hours formula/rounding.'

  return {
    ok: mismatches.length === 0,
    total_rows: rows.length,
    ok_count: okCount,
    mismatch_count: mismatches.length,
    mismatches,
    possible_causes,
  }
}

/** Run selected integrity checks and return a single report. */
export async function runIntegrityChecks (options: IntegrityRunOptions): Promise<IntegrityReport> {
  const checks = options.checks?.length ? options.checks : DEFAULT_CHECKS
  const { startDate, endDate } = options.startDate && options.endDate
    ? { startDate: options.startDate, endDate: options.endDate }
    : getDefaultDateRange()
  const endpoint = options.endpoint ?? 'time_registration_shifts'

  const report: IntegrityReport = {
    ok: true,
    ranAt: new Date().toISOString(),
    options: { startDate, endDate, checks },
  }

  if (checks.includes('duplicates_raw')) {
    const result = await checkRawDuplicates({
      startDate,
      endDate,
      endpoint,
      limit: options.duplicateLimit ?? 50,
    })
    report.duplicates_raw = {
      ok: result.ok,
      totalDuplicateGroups: result.totalDuplicateGroups,
      totalExtraDocs: result.totalExtraDocs,
      groups: result.groups,
    }
    if (!result.ok) report.ok = false
  }

  if (checks.includes('duplicates_aggregation')) {
    const result = await checkAggregationDuplicates({
      startDate,
      endDate,
      endpoint,
      limit: options.duplicateLimit ?? 50,
    })
    report.duplicates_aggregation = {
      ok: result.ok,
      totalDuplicateGroups: result.totalDuplicateGroups,
      groups: result.groups,
    }
    if (!result.ok) report.ok = false
  }

  if (checks.includes('normalization')) {
    const result = await checkNormalization({ endpoint })
    const rawOk = result.raw.withIssues === 0
    const aggOk = result.aggregation.withIssues === 0
    report.normalization = {
      ok: rawOk && aggOk,
      raw: result.raw,
      aggregation: result.aggregation,
    }
    if (!report.normalization.ok) report.ok = false
  }

  if (checks.includes('sums')) {
    const result = await checkAggregationVsRawSums({
      startDate,
      endDate,
      endpoint,
      tolerance: options.sumsTolerance ?? 0.02,
    })
    report.sums = {
      ok: result.ok,
      total_rows: result.total_rows,
      ok_count: result.ok_count,
      mismatch_count: result.mismatch_count,
      mismatches: result.mismatches,
      possible_causes: result.possible_causes,
    }
    if (!result.ok) report.ok = false
  }

  return report
}

/** Delete duplicate raw docs by shift identity (date+user+team+supportId). Normalize so string/Date and number/string ids group together. Process per group to avoid huge array. */
export async function fixRawDuplicates (options: { startDate: string; endDate: string; endpoint?: string }): Promise<number> {
  const db = await getDb()
  const coll = db.collection('eitje_raw_data')
  const endpoint = options.endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'
  const dayStart = new Date(options.startDate + 'T00:00:00.000Z')
  const dayEnd = new Date(options.endDate + 'T23:59:59.999Z')
  const pipeline: unknown[] = [
    {
      $match: {
        endpoint,
        $or: [
          { date: { $gte: dayStart, $lte: dayEnd } },
          { date: { $gte: options.startDate, $lte: options.endDate } },
        ],
      },
    },
    {
      $addFields: {
        _userId: { $toString: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] } },
        _teamId: { $toString: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] } },
        _supportId: { $toString: { $ifNull: ['$extracted.supportId', { $ifNull: ['$rawApiResponse.support_id', { $ifNull: ['$rawApiResponse.id', '$_id'] }] }] } },
        _dateStr: {
          $cond: [
            { $eq: [{ $type: '$date' }, 'string'] },
            { $substr: ['$date', 0, 10] },
            { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$date' } } },
          ],
        },
      },
    },
    {
      $group: {
        _id: { date: '$_dateStr', userId: '$_userId', teamId: '$_teamId', supportId: '$_supportId' },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $project: { ids: 1, count: 1 } },
  ]
  const groups = await coll.aggregate(pipeline).toArray() as Array<{ ids: unknown[]; count: number }>
  const allToDelete: unknown[] = []
  for (const g of groups) {
    allToDelete.push(...g.ids.slice(1))
  }
  if (allToDelete.length === 0) return 0
  const BATCH = 500
  let totalDeleted = 0
  for (let i = 0; i < allToDelete.length; i += BATCH) {
    const batch = allToDelete.slice(i, i + BATCH)
    const del = await coll.deleteMany({ _id: { $in: batch } })
    totalDeleted += del.deletedCount
  }
  return totalDeleted
}

/** Delete duplicate aggregation docs (keep one per period+locationId+userId+teamId). Returns deleted count. */
export async function fixAggregationDuplicates (options: { startDate: string; endDate: string; endpoint?: string }): Promise<number> {
  const db = await getDb()
  const coll = db.collection(options.endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation')
  const pipeline: unknown[] = [
    { $match: { period_type: 'day', period: { $gte: options.startDate, $lte: options.endDate } } },
    { $group: { _id: { period: '$period', locationId: '$locationId', userId: '$userId', teamId: '$teamId' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $project: { remove: { $slice: ['$ids', 1, { $subtract: [{ $size: '$ids' }, 1] }] } } },
    { $unwind: '$remove' },
    { $group: { _id: null, toDelete: { $push: '$remove' } } },
  ]
  const result = await coll.aggregate(pipeline).toArray() as Array<{ toDelete?: unknown[] }>
  const toDelete = result[0]?.toDelete ?? []
  if (toDelete.length === 0) return 0
  const del = await coll.deleteMany({ _id: { $in: toDelete } })
  return del.deletedCount
}

/** Re-aggregate from raw for mismatched (date, location): delete agg docs, rebuild from raw, insert. Raw = source of truth. Returns count of rows fixed. */
export async function fixSumMismatches (options: { startDate: string; endDate: string; endpoint?: string; tolerance?: number }): Promise<number> {
  const db = await getDb()
  const endpoint = options.endpoint === 'planning_shifts' ? 'planning_shifts' : 'time_registration_shifts'
  const tolerance = options.tolerance ?? 0.02
  const coll = db.collection(endpoint === 'planning_shifts' ? 'eitje_planning_registration_aggregation' : 'eitje_time_registration_aggregation')
  const { mismatches } = await checkAggregationVsRawSums({ ...options, tolerance })
  if (mismatches.length === 0) return 0
  let fixed = 0
  for (const m of mismatches) {
    const dateStr = m.date
    const locationIdParam = m.location_id
    if (!locationIdParam) continue
    let locationIdObj: ObjectId | null = null
    try {
      locationIdObj = new ObjectId(locationIdParam)
    } catch {
      continue
    }
    const locIdStr = String(locationIdParam)
    const locationDoc = await db.collection('unified_location').findOne({
      $or: [
        { primaryId: locationIdObj },
        { allIdValues: locationIdObj },
        { allIdValues: locIdStr },
        { eitjeIds: locationIdParam },
      ],
    }) as { eitjeIds?: number[] } | null
    const eitjeIds = locationDoc?.eitjeIds ?? []
    const { dayStart, dayEnd } = getUtcDayRange(dateStr)
    const dateCondition = { $or: [{ date: { $gte: dayStart, $lte: dayEnd } }, { date: dateStr }] }
    const locationClauses: Record<string, unknown>[] = [
      { locationId: locationIdObj },
      { locationId: locIdStr },
    ]
    if (eitjeIds.length) locationClauses.push({ environmentId: { $in: eitjeIds } })
    const rawMatch = {
      endpoint,
      $and: [dateCondition, { $or: locationClauses }],
    }
    const rawPipeline: unknown[] = [
      { $match: rawMatch },
      {
        $addFields: {
          ...EITJE_HOURS_ADD_FIELDS,
          period: dateStr,
          userId: { $ifNull: ['$extracted.userId', '$rawApiResponse.user_id'] },
          teamId: { $ifNull: ['$extracted.teamId', '$rawApiResponse.team_id'] },
          cost: {
            $ifNull: [
              { $divide: [{ $toDouble: '$extracted.amountInCents' }, 100] },
              { $ifNull: [{ $divide: [{ $toDouble: '$rawApiResponse.amt_in_cents' }, 100] }, 0] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'unified_user',
          let: { uid: '$userId' },
          pipeline: [
            { $match: { $expr: { $or: [{ $in: ['$$uid', { $ifNull: ['$eitjeIds', []] }] }, { $in: ['$$uid', { $ifNull: ['$allIdValues', []] }] }, { $eq: ['$primaryId', '$$uid'] }] } } },
            { $limit: 1 },
            { $project: { primaryName: 1 } },
          ],
          as: 'u',
        },
      },
      {
        $lookup: {
          from: 'unified_team',
          let: { tid: '$teamId' },
          pipeline: [
            { $match: { $expr: { $or: [{ $in: ['$$tid', { $ifNull: ['$eitjeIds', []] }] }, { $in: ['$$tid', { $ifNull: ['$allIdValues', []] }] }, { $eq: ['$primaryId', '$$tid'] }] } } },
            { $limit: 1 },
            { $project: { primaryName: 1 } },
          ],
          as: 't',
        },
      },
      {
        $group: {
          _id: { period: '$period', locationId: { $literal: locationIdObj }, userId: '$userId', teamId: '$teamId' },
          location_name: { $first: m.location_name },
          user_name: { $first: { $ifNull: [{ $arrayElemAt: ['$u.primaryName', 0] }, 'Unknown'] } },
          team_name: { $first: { $ifNull: [{ $arrayElemAt: ['$t.primaryName', 0] }, 'Unknown'] } },
          total_hours: { $sum: '$hours' },
          total_cost: { $sum: '$cost' },
          record_count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          period_type: 'day',
          locationId: '$_id.locationId',
          location_name: 1,
          userId: '$_id.userId',
          user_name: 1,
          teamId: '$_id.teamId',
          team_name: 1,
          total_hours: 1,
          total_cost: 1,
          record_count: 1,
        },
      },
    ]
    const newDocs = await db.collection('eitje_raw_data').aggregate(rawPipeline).toArray() as Array<Record<string, unknown>>
    await coll.deleteMany({ period_type: 'day', period: dateStr, locationId: locationIdObj })
    if (newDocs.length > 0) {
      await coll.insertMany(newDocs)
      fixed++
    }
  }
  return fixed
}

/** Run validation and cleanup. Fixes: raw duplicates, aggregation duplicates, sum mismatches (re-aggregate from raw). rawOnly=true runs only raw dedupe (fast). Returns counts only. */
export async function runAndFix (options?: { startDate?: string; endDate?: string; rawOnly?: boolean }): Promise<{ rawDeduped: number; aggDeduped: number; reAggregated: number }> {
  const { startDate, endDate } = options?.startDate && options?.endDate
    ? options
    : getDefaultDateRange()
  const rawDeduped = await fixRawDuplicates({ startDate, endDate })
  if (options?.rawOnly) {
    return { rawDeduped, aggDeduped: 0, reAggregated: 0 }
  }
  const aggDeduped = await fixAggregationDuplicates({ startDate, endDate })
  const reAggregated = await fixSumMismatches({ startDate, endDate })
  return { rawDeduped, aggDeduped, reAggregated }
}
