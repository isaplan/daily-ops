/**
 * @registry-id: borkDayBreakdownApi
 * @created: 2026-04-13T00:00:00.000Z
 * @last-modified: 2026-05-07T20:00:00.000Z
 * @description: Get day breakdown data for revenue verification across all dimensions
 * @last-fix: [2026-05-07] Basis vs API location matching via unified_location + bork_unified_location_mapping (+ heuristic fallback)
 *
 * @exports-to:
 * ✓ pages/daily-ops/sales/day-breakdown.vue => Fetches breakdown for selected date
 */

import type { BasisReportData } from '../../../utils/inbox/basis-report-mapper'
import { getDb } from '../../../utils/db'
import { listBorkAggReadSuffixCandidates } from '../../../utils/borkAggVersionSuffix'
import {
  loadUnifiedLocationGroupResolver,
  type UnifiedLocationGroupResolver,
} from '../../../utils/unifiedLocationGroupResolver'

type HourDoc = Record<string, unknown>

const BASIS_VS_API_TOLERANCE_EUR = 0.02

/** Amsterdam register “today”: before 08:00 counts as previous calendar day’s register window. */
function registerBusinessDateForInstant(d: Date): string {
  const AMSTERDAM_TZ = 'Europe/Amsterdam'
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMSTERDAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  const cal = `${g('year')}-${g('month')}-${g('day')}`
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: AMSTERDAM_TZ,
      hour: '2-digit',
      hour12: false,
    })
      .formatToParts(d)
      .find((x) => x.type === 'hour')?.value ?? '0',
    10,
  )
  if (hour < 8) return addCalendarDaysISO(cal, -1)
  return cal
}

/** Completed register days only — same rule as “yesterday” ops pick (strictly before open register day). */
function isCompletedRegisterBusinessDate(dateStr: string, now = new Date()): boolean {
  return dateStr < registerBusinessDateForInstant(now)
}

function normalizeLocationLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function sumHourlyRevenueByLocation(rows: HourDoc[], locationFilter: 'all' | string): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const loc = String(r.locationName ?? '').trim()
    if (!loc) continue
    if (locationFilter !== 'all' && loc !== locationFilter) continue
    const rev = Number(r.total_revenue ?? 0)
    m.set(loc, (m.get(loc) ?? 0) + rev)
  }
  return m
}

function betterBasisReport(a: BasisReportData, b: BasisReportData): BasisReportData {
  const ra = a.final_revenue_incl_vat ?? 0
  const rb = b.final_revenue_incl_vat ?? 0
  if (ra > 0.02 && rb <= 0.02) return a
  if (rb > 0.02 && ra <= 0.02) return b
  if (Math.abs(ra - rb) > 0.02) return ra >= rb ? a : b
  const ta = a.received_at ? new Date(a.received_at).getTime() : 0
  const tb = b.received_at ? new Date(b.received_at).getTime() : 0
  return ta >= tb ? a : b
}

/** Stable group for one venue: unified ObjectId when known, else resolver fallback / legacy label. */
function basisReportGroupKey(r: BasisReportData, resolver: UnifiedLocationGroupResolver): string {
  const idKey = resolver.groupKeyFromBasisLocationId(r.location_id)
  if (idKey) return idKey
  return (
    resolver.resolveGroupKey(r.location) ??
    resolver.resolveGroupKey(r.location_raw ?? '') ??
    `legacy:${normalizeLocationLabel(r.location)}`
  )
}

/** One Basis row per venue — keys come from unified_location (+ mapping), not hardcoded nicknames. */
function pickBasisReportsPerLocation(
  reports: BasisReportData[],
  resolver: UnifiedLocationGroupResolver,
): Map<string, BasisReportData> {
  const sorted = [...reports].sort((a, b) => {
    const bh = (b.business_hour ?? -1) - (a.business_hour ?? -1)
    if (bh !== 0) return bh
    const ch = (b.cron_hour ?? -1) - (a.cron_hour ?? -1)
    if (ch !== 0) return ch
    const ra = a.received_at ? new Date(a.received_at).getTime() : 0
    const rb = b.received_at ? new Date(b.received_at).getTime() : 0
    return rb - ra
  })
  const byGroup = new Map<string, BasisReportData>()
  for (const r of sorted) {
    const key = basisReportGroupKey(r, resolver)
    const existing = byGroup.get(key)
    byGroup.set(key, existing ? betterBasisReport(r, existing) : r)
  }
  return byGroup
}

/** First API `locationName` per unified group (same key as basisReportGroupKey). */
function mapGroupKeyToApiLocation(
  apiLocations: string[],
  resolver: UnifiedLocationGroupResolver,
): Map<string, string> {
  const m = new Map<string, string>()
  for (const loc of apiLocations) {
    const g = resolver.resolveGroupKey(loc)
    if (g && !m.has(g)) m.set(g, loc)
  }
  return m
}

function matchApiLocationForBasisReport(
  report: BasisReportData,
  apiByGroup: Map<string, string>,
  resolver: UnifiedLocationGroupResolver,
): string | null {
  const g = basisReportGroupKey(report, resolver)
  return apiByGroup.get(g) ?? null
}

function addCalendarDaysISO(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** Wall-clock `date` + `hour` for synthetic rows (register opens 08:00 on `businessDate`). */
function ticketDateHourForBusinessSlot(businessDate: string, businessHour: number): { date: string; hour: number } {
  const hour = (businessHour + 8) % 24
  if (businessHour <= 15) return { date: businessDate, hour }
  return { date: addCalendarDaysISO(businessDate, 1), hour }
}

/** Ensure 24 rows per location (BH0–BH23) with zeros where Mongo has no bucket. */
function padHourlyFullRegisterDay(rows: HourDoc[], businessDate: string, location: string): HourDoc[] {
  const locations: string[] =
    location === 'all'
      ? [...new Set(rows.map((r) => String(r.locationName ?? '')).filter(Boolean))].sort()
      : [location]

  if (locations.length === 0) return rows

  const key = (loc: string, bh: number) => `${loc}\t${bh}`
  const map = new Map<string, HourDoc>()
  for (const r of rows) {
    const loc = String(r.locationName ?? '')
    const bh = r.business_hour
    if (!loc || typeof bh !== 'number') continue
    map.set(key(loc, bh), r)
  }

  const out: HourDoc[] = []
  for (const loc of locations) {
    for (let bh = 0; bh < 24; bh++) {
      const k = key(loc, bh)
      if (map.has(k)) {
        out.push(map.get(k)!)
        continue
      }
      const { date: tDate, hour: tHour } = ticketDateHourForBusinessSlot(businessDate, bh)
      out.push({
        _id: `synthetic-hour-${businessDate}-${loc}-${bh}`,
        business_date: businessDate,
        business_hour: bh,
        locationName: loc,
        date: tDate,
        hour: tHour,
        total_revenue: 0,
        total_quantity: 0,
        record_count: 0,
        products: [],
      })
    }
  }
  return out
}

/** Match rebuild register day (`business_date`); legacy rows may only have ticket `date`. */
function matchBusinessDayFilter(dateStr: string, locationQuery: Record<string, unknown>) {
  const dayOrLegacy = {
    $or: [{ business_date: dateStr }, { business_date: { $exists: false }, date: dateStr }],
  }
  if (Object.keys(locationQuery).length === 0) return dayOrLegacy
  return { $and: [dayOrLegacy, locationQuery] }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateStr = query.date as string
  const location = (query.location as string) || 'all'

  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: 'date parameter required (YYYY-MM-DD)' })
  }

  const db = await getDb()
  const suffixCandidates = listBorkAggReadSuffixCandidates()

  try {
    const locationQuery = location === 'all' ? {} : { locationName: location }
    const dayMatch = matchBusinessDayFilter(dateStr, locationQuery)

    let suffix = suffixCandidates[0] ?? ''
    let pickedViaFallback = false
    for (let i = 0; i < suffixCandidates.length; i++) {
      const sfx = suffixCandidates[i] ?? ''
      const probe = await db.collection(`bork_sales_by_hour${sfx}`).findOne(dayMatch)
      if (probe) {
        suffix = sfx
        pickedViaFallback = i > 0
        break
      }
    }

    const hourlyColl = `bork_sales_by_hour${suffix}`
    const workerColl = `bork_sales_by_worker${suffix}`
    const tableColl = `bork_sales_by_table${suffix}`
    const guestColl = `bork_sales_by_guest_account${suffix}`
    const productColl = `bork_sales_by_product${suffix}`

    // Fetch hourly breakdown (at most one row per location × business_hour for this register day)
    const hourlyRaw = await db
      .collection(hourlyColl)
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1 })
      .toArray()

    const hourly = padHourlyFullRegisterDay(hourlyRaw as HourDoc[], dateStr, location)

    // Fetch worker breakdown
    const worker = await db
      .collection(workerColl)
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // Fetch table breakdown (orders with TableNr only)
    const table = await db
      .collection(tableColl)
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // No table number: bar / guest / on-factuur — included in hourly but not in bork_sales_by_table
    const guest = await db
      .collection(guestColl)
      .find(dayMatch)
      .sort({ business_hour: 1, locationName: 1, total_revenue: -1 })
      .toArray()

    // V2 rollups: product × unit price lines per business day (same pipeline as sales-aggregated products)
    const product = await db
      .collection(productColl)
      .find(dayMatch)
      .sort({ total_revenue: -1 })
      .toArray()

    const apiByLoc = sumHourlyRevenueByLocation(hourlyRaw as HourDoc[], location === 'all' ? 'all' : location)

    const dataHealth = {
      aggregateSuffixUsed: suffix,
      aggregateSuffixCandidatesTried: suffixCandidates,
      pickedViaFallback,
      hourlyRawCount: hourlyRaw.length,
      hourlyCollection: hourlyColl,
      emptyAggregatesMessage:
        hourlyRaw.length === 0
          ? `No documents matched hourly aggregates for this business_date after trying suffixes ${suffixCandidates.map((s) => `"${s || '(none)'}"`).join(', ')} (last read: ${hourlyColl}). Align BORK_AGG_VERSION_SUFFIX with your Mongo collection names or run the V2 rebuild for this date range.`
          : undefined,
      fallbackNotice:
        pickedViaFallback && hourlyRaw.length > 0
          ? `Data was loaded from ${hourlyColl}. Consider setting BORK_AGG_VERSION_SUFFIX so the primary suffix matches your DB.`
          : undefined,
    }

    let basisReference:
      | {
          eligible: true
          collectionSuffix: string | null
          basisSource: string
          rows: Array<{
            basisLocationLabel: string
            matchedApiLocation: string | null
            basisInclVat: number | null
            apiInclVat: number | null
            diff: number
            match: boolean
          }>
          basisGrandTotal: number
          apiGrandTotal: number
          overallMatch: boolean
          note?: string
        }
      | { eligible: false; reason: string }

    if (!isCompletedRegisterBusinessDate(dateStr)) {
      basisReference = {
        eligible: false,
        reason:
          'Basis comparison runs only for completed register days (business_date strictly before today’s open register day).',
      }
    } else {
      const basisDocs = (await db
        .collection('inbox-bork-basis-report')
        .find({ date: dateStr })
        .toArray()) as BasisReportData[]

      const resolver = await loadUnifiedLocationGroupResolver(db)
      const perLoc = pickBasisReportsPerLocation(basisDocs, resolver)
      const apiLocKeys = [...apiByLoc.keys()].sort((a, b) => a.localeCompare(b, 'nl'))
      const apiByGroup = mapGroupKeyToApiLocation(apiLocKeys, resolver)

      const rows: Array<{
        basisLocationLabel: string
        matchedApiLocation: string | null
        basisInclVat: number | null
        apiInclVat: number | null
        diff: number
        match: boolean
      }> = []

      const usedApi = new Set<string>()
      let basisGrandTotal = 0
      let apiGrandTotal = 0

      for (const report of perLoc.values()) {
        if (location !== 'all') {
          const want = resolver.resolveGroupKey(location)
          if (!want || basisReportGroupKey(report, resolver) !== want) continue
        }

        const basisRev = report.final_revenue_incl_vat
        const apiLoc = matchApiLocationForBasisReport(report, apiByGroup, resolver)
        const apiRev = apiLoc != null ? apiByLoc.get(apiLoc) ?? null : null
        if (apiLoc) usedApi.add(apiLoc)

        const apiNum = apiRev ?? 0
        const diff = Math.abs(basisRev - apiNum)
        const match = diff < BASIS_VS_API_TOLERANCE_EUR
        basisGrandTotal += basisRev
        apiGrandTotal += apiNum

        rows.push({
          basisLocationLabel: report.location_raw || report.location,
          matchedApiLocation: apiLoc,
          basisInclVat: basisRev,
          apiInclVat: apiRev,
          diff,
          match,
        })
      }

      for (const [apiLoc, rev] of apiByLoc.entries()) {
        if (usedApi.has(apiLoc)) continue
        rows.push({
          basisLocationLabel: '—',
          matchedApiLocation: apiLoc,
          basisInclVat: null,
          apiInclVat: rev,
          diff: rev,
          match: false,
        })
        apiGrandTotal += rev
      }

      rows.sort((a, b) =>
        (a.matchedApiLocation ?? a.basisLocationLabel).localeCompare(b.matchedApiLocation ?? b.basisLocationLabel, 'nl'),
      )

      let note: string | undefined
      if (perLoc.size === 0) {
        note = 'No rows in inbox-bork-basis-report for this date — ingest Basis Report emails first.'
      }
      if (hourlyRaw.length === 0 && perLoc.size > 0) {
        const extra =
          'Hourly API aggregates are empty for this date (Σ API = €0). Fix aggregate collections / rebuild V2 for this business_date before trusting Basis vs API.'
        note = note ? `${note} ${extra}` : extra
      }

      const overallMatch =
        rows.length > 0 &&
        rows.every((r) => r.match) &&
        Math.abs(basisGrandTotal - apiGrandTotal) < BASIS_VS_API_TOLERANCE_EUR

      basisReference = {
        eligible: true,
        collectionSuffix: suffix || null,
        basisSource: 'inbox-bork-basis-report.final_revenue_incl_vat (Netto Sales grand total, incl. VAT)',
        rows,
        basisGrandTotal,
        apiGrandTotal,
        overallMatch,
        ...(note ? { note } : {}),
      }
    }

    return {
      businessDate: dateStr,
      dateRange: {
        startDate: dateStr,
        endDate: dateStr,
        note: 'Register day = business_date: 08:00 day D through 07:59 morning D+1 (BH0–BH23). Rebuild aggregates after changing the boundary.',
      },
      collectionSuffix: suffix || null,
      aggregateCollections: {
        hourly: hourlyColl,
        worker: workerColl,
        table: tableColl,
        guest: guestColl,
        product: productColl,
      },
      dataHealth,
      location,
      hourly,
      worker,
      table,
      guest,
      product,
      basisReference,
    }
  } catch (e) {
    console.error('[borkDayBreakdownApi]', e)
    throw createError({ statusCode: 500, statusMessage: String(e) })
  }
})
