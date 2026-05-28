/**
 * Static / codebase checks for ADR-004 and agent-rules debt (monoliths, live Bork on GET).
 */

import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'

const ROOT = resolve(process.cwd())

const ADR004_WATCH_FILES: Array<{ rel: string; forbidden: string[] }> = [
  {
    rel: 'server/utils/dailyOpsRevenue/fetchCoOccurrence.ts',
    forbidden: ["collection('bork_raw_data')"],
  },
  {
    rel: 'server/utils/dailyOpsRevenue/fetchOrderPaymentRhythm.ts',
    forbidden: ["collection('bork_raw_data')"],
  },
  {
    rel: 'server/utils/dailyOpsRevenue/fetchHourlyMatrix.ts',
    forbidden: ['fillHourlyMatrixFromBork'],
  },
  {
    rel: 'server/utils/dailyOpsRevenue/fetchCategoriesAndProducts.ts',
    forbidden: ['fetchCategoriesFromBork', 'fetchProductsFromBork', 'bork_sales_by_product'],
  },
]

const MONOLITH_WATCH: Array<{ rel: string; maxLines: number }> = [
  { rel: 'server/utils/dailyOpsDashboardMetrics.ts', maxLines: 600 },
  { rel: 'server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts', maxLines: 200 },
  { rel: 'components/daily-ops/DailyOpsHomeDashboard.vue', maxLines: 400 },
  { rel: 'components/daily-ops/DailyOpsProductivityLaborSection.vue', maxLines: 650 },
  { rel: 'server/utils/dailyOpsVenueStrip.ts', maxLines: 80 },
]

function readRepoFile(rel: string): string | null {
  try {
    return readFileSync(resolve(ROOT, rel), 'utf-8')
  } catch {
    return null
  }
}

function lineCount(rel: string): number {
  try {
    const content = readFileSync(resolve(ROOT, rel), 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

export function detectArchitectureNotifications(): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const { rel, forbidden } of ADR004_WATCH_FILES) {
    const content = readRepoFile(rel)
    if (!content) continue
    for (const needle of forbidden) {
      if (!content.includes(needle)) continue
      items.push(
        buildNotificationItem({
          kind: 'adr004_live_bork_on_revenue_get',
          businessDate: 'system',
          locationId: `platform:${rel.replace(/\//g, '_')}`,
          locationName: 'Platform',
          message: `${rel} still reads live Bork/raw on GET (\`${needle}\`). Violates ADR-004 — move to snapshot section + snapshot-only reader.`,
          fixHint: `Refactor ${rel} to read daily_ops_snapshot_section_* only; build data in dailyOpsSnapshotService.`,
          meta: { file: rel, pattern: needle },
        }),
      )
    }
  }

  const fetchRange = readRepoFile('server/utils/dailyOpsRevenue/fetchRevenueRange.ts')
  if (fetchRange?.includes('fetchBorkRangeTotals')) {
    items.push(
      buildNotificationItem({
        kind: 'adr004_live_bork_on_revenue_get',
        businessDate: 'system',
        locationId: 'platform',
        locationName: 'Platform',
        message: `fetchRevenueRange.ts still imports fetchBorkRangeTotals — revenue KPI path must be snapshot-only.`,
        fixHint: 'Remove Bork fallback from fetchRevenueRange; use snapshot borkTotals written at build time.',
        meta: { file: 'server/utils/dailyOpsRevenue/fetchRevenueRange.ts' },
      }),
    )
  }

  for (const { rel, maxLines } of MONOLITH_WATCH) {
    const lines = lineCount(rel)
    if (lines <= maxLines) continue
    let sizeKb = 0
    try {
      sizeKb = Math.round(statSync(resolve(ROOT, rel)).size / 1024)
    } catch {
      // ignore
    }
    items.push(
      buildNotificationItem({
        kind: 'monolithic_module',
        businessDate: 'system',
        locationId: 'platform',
        locationName: 'Platform',
        message: `${rel} is ~${lines} lines (>${maxLines} budget, ${sizeKb}KB) — hard to maintain; split per agent-rules modularity.`,
        fixHint: `Extract focused modules from ${rel}; keep snapshot read/write paths separate.`,
        severity: lines > maxLines * 1.5 ? 'warning' : 'info',
        meta: { lines, maxLines, sizeKb },
      }),
    )
  }

  return items
}
