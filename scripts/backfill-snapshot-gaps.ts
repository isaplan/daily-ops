/**
 * GAP-ONLY dashboard backfill — snapshot orphans + missing read-cache daily docs.
 * NOT a full history rewrite (use backfill-daily-ops-full-snapshots.ts for that — slow).
 *
 * Default range: 2024-01-01 through yesterday (Amsterdam calendar).
 *
 * Usage:
 *   pnpm snapshots:backfill:gaps -- --dry-run
 *   GAP_BACKFILL_CONFIRM=1 pnpm snapshots:backfill:gaps
 *   GAP_BACKFILL_CONFIRM=1 pnpm snapshots:backfill:gaps -- --cache-only
 *
 * Requires: MONGODB_URI (or DATABASE_URL) in .env / .env.local
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb } from '../server/utils/db'
import { buildDailyOpsSnapshot } from '../server/services/dailyOpsSnapshotService'
import {
  findSnapshotGapVenueDays,
  type SnapshotGapVenueDay,
} from '../server/utils/dailyOpsSnapshot/triggerSnapshotRebuilds'
import {
  findReadCacheGapTargets,
  type ReadCacheGapTarget,
} from '../server/utils/dailyOpsReadCache/readCacheStore'
import { cascadeGenerate } from '../server/utils/dailyOpsSnapshot/cacheCascade'
import { preGenerateBundleForDate } from '../server/utils/dailyOpsSnapshot/preGenerateBundleCache'
import {
  addCalendarDaysYmd,
  calendarYmdInAmsterdam,
} from '../utils/dailyOpsBusinessDate'

const DEFAULT_START = '2024-01-01'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function summarizeSnapshotGaps(gaps: SnapshotGapVenueDay[]) {
  const byReason: Record<string, number> = {}
  for (const g of gaps) {
    for (const r of g.reasons) byReason[r] = (byReason[r] ?? 0) + 1
  }
  return byReason
}

function mergeDateWindows(sortedDates: string[]): Array<{ start: string; end: string }> {
  if (!sortedDates.length) return []
  const windows: Array<{ start: string; end: string }> = []
  let start = sortedDates[0]!
  let end = start
  for (let i = 1; i < sortedDates.length; i++) {
    const d = sortedDates[i]!
    const nextDay = addCalendarDaysYmd(end, 1)
    if (d === nextDay) end = d
    else {
      windows.push({ start, end })
      start = d
      end = d
    }
  }
  windows.push({ start, end })
  return windows
}

async function main(): Promise<void> {
  const dryRun = hasFlag('dry-run')
  const cacheOnly = hasFlag('cache-only')
  const confirmed =
    process.env.GAP_BACKFILL_CONFIRM === '1' || process.env.GAP_BACKFILL_CONFIRM === 'yes'

  if (!dryRun && !confirmed) {
    console.error('[gap-backfill] Set GAP_BACKFILL_CONFIRM=1 or use --dry-run')
    process.exit(1)
  }

  const startDate = arg('start') ?? DEFAULT_START
  const endDate = arg('end') ?? addCalendarDaysYmd(calendarYmdInAmsterdam(new Date()), -1)
  const locationId = arg('location')

  if (startDate > endDate) {
    console.error('[gap-backfill] start must be <= end')
    process.exit(1)
  }

  const db = await getDb()
  console.log(`[gap-backfill] Scanning ${startDate}..${endDate}${locationId ? ` location=${locationId}` : ''}…`)

  const snapshotGaps = cacheOnly
    ? []
    : await findSnapshotGapVenueDays(db, {
        startDate,
        endDate,
        locationIds: locationId ? [locationId] : undefined,
      })

  const cacheGaps = await findReadCacheGapTargets(db, {
    startDate,
    endDate,
    locationIds: locationId ? [locationId, ...(locationId !== 'all' ? [] : [])] : undefined,
  })

  if (snapshotGaps.length === 0 && cacheGaps.length === 0) {
    console.log('[gap-backfill] No snapshot or read-cache gaps found in range.')
    process.exit(0)
  }

  const snapshotDates = [...new Set(snapshotGaps.map((g) => g.businessDate))].sort()
  const cacheDates = [...new Set(cacheGaps.map((g) => g.businessDate))].sort()

  console.log(
    `[gap-backfill] ${dryRun ? 'DRY RUN — ' : ''}snapshot gaps=${snapshotGaps.length} venue-days (${snapshotDates.length} dates) | read-cache gaps=${cacheGaps.length} docs (${cacheDates.length} dates)`,
  )
  if (snapshotGaps.length > 0) {
    console.log('[gap-backfill] Snapshot reasons:', summarizeSnapshotGaps(snapshotGaps))
    console.log('[gap-backfill] Snapshot dates:', snapshotDates.slice(0, 15).join(', '), snapshotDates.length > 15 ? `… +${snapshotDates.length - 15}` : '')
  }
  if (cacheGaps.length > 0) {
    console.log('[gap-backfill] Cache dates:', cacheDates.slice(0, 15).join(', '), cacheDates.length > 15 ? `… +${cacheDates.length - 15}` : '')
  }

  const reportPath = resolve(process.cwd(), 'dev-docs/snapshot-gaps-backfill-report.json')
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        scannedAt: new Date().toISOString(),
        startDate,
        endDate,
        locationId: locationId ?? null,
        snapshotGapVenueDayCount: snapshotGaps.length,
        snapshotGapDates: snapshotDates,
        snapshotGaps,
        readCacheGapCount: cacheGaps.length,
        readCacheGapDates: cacheDates,
        readCacheGaps: cacheGaps,
      },
      null,
      2,
    ),
  )
  console.log(`[gap-backfill] Report: ${reportPath}`)

  if (dryRun) {
    console.log('[gap-backfill] Would rebuild snapshot gaps + pre-generate missing read-cache daily docs.')
    process.exit(0)
  }

  let snapshotBuilt = 0
  let snapshotErrors = 0
  let cacheBuilt = 0
  let cacheErrors = 0

  if (!cacheOnly) {
    for (const gap of snapshotGaps) {
      try {
        const result = await buildDailyOpsSnapshot({
          businessDate: gap.businessDate,
          locationId: gap.locationId,
          forceReopenSealed: true,
        })
        if (result.errors.length > 0) {
          snapshotErrors += result.errors.length
          console.error(
            `[gap-backfill] snapshot FAIL ${gap.businessDate} ${gap.locationName}: ${result.errors[0]!.error}`,
          )
        } else if (result.built.length > 0) {
          snapshotBuilt += result.built.length
          console.log(`[gap-backfill] snapshot ok ${gap.businessDate} ${gap.locationName}`)
        }
      } catch (e) {
        snapshotErrors += 1
        console.error(
          `[gap-backfill] snapshot FAIL ${gap.businessDate} ${gap.locationName}:`,
          e instanceof Error ? e.message : e,
        )
      }
    }
  }

  const remainingCacheGaps = await findReadCacheGapTargets(db, {
    startDate,
    endDate,
    locationIds: locationId ? [locationId] : undefined,
  })

  for (const gap of remainingCacheGaps) {
    try {
      const result = await preGenerateBundleForDate(db, gap.businessDate, gap.locationId)
      if (result.written) {
        cacheBuilt += 1
        console.log(`[gap-backfill] cache ok ${gap.businessDate} ${gap.locationId}`)
      } else if (result.error) {
        cacheErrors += 1
        console.error(`[gap-backfill] cache FAIL ${gap.businessDate} ${gap.locationId}: ${result.error}`)
      }
    } catch (e) {
      cacheErrors += 1
      console.error(
        `[gap-backfill] cache FAIL ${gap.businessDate} ${gap.locationId}:`,
        e instanceof Error ? e.message : e,
      )
    }
  }

  const cascadeDates = [...new Set(remainingCacheGaps.map((g) => g.businessDate))].sort()
  if (cascadeDates.length > 0) {
    const locationIds = locationId
      ? [locationId]
      : [...new Set(remainingCacheGaps.map((g) => g.locationId))]
    for (const { start, end } of mergeDateWindows(cascadeDates)) {
      await cascadeGenerate(db, start, end, locationIds)
    }
  }

  console.log(
    `[gap-backfill] done | snapshot built=${snapshotBuilt} errors=${snapshotErrors} | cache built=${cacheBuilt} errors=${cacheErrors}`,
  )
  console.log('[gap-backfill] Re-run with --dry-run to verify gaps closed.')
  process.exit(snapshotErrors + cacheErrors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('[gap-backfill] fatal:', e)
  process.exit(1)
})
