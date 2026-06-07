/**
 * ADR-010 guard: Daily Ops read/UI paths must not use ISO calendar date for “today”.
 * See utils/dailyOpsBusinessDate.ts (SSOT) and ADR-010 in DECISIONS.md.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'

const ROOT = resolve(process.cwd())

/** Integration/pipeline only — calendar date OK for Bork/Eitje API fetch params. */
const ALLOWLIST = new Set([
  'utils/dailyOpsBusinessDate.ts',
  'server/services/borkSyncService.ts',
  'server/services/eitjeSyncService.ts',
  'server/tasks/integrations/bork-eitje-daily.ts',
  'server/utils/productCatalog.ts',
  'scripts/check-morning-cron-yesterday.ts',
  'server/utils/opsNotifications/detectors/businessDayIsoMisuse.ts',
])

const SCAN_ROOTS = [
  'server/utils/venueStrip',
  'server/utils/dailyOpsSnapshot',
  'server/utils/dailyOpsMetrics',
  'server/utils/dailyOpsRevenue',
  'server/api/daily-ops',
  'composables',
  'components/daily-ops',
  'pages/daily-ops',
  'utils/dailyOpsPeriod.ts',
  'utils/dailyOpsRevenuePeriod.ts',
]

const FORBIDDEN_PATTERNS: Array<{ id: string; re: RegExp; hint: string }> = [
  {
    id: 'calendarYmdInAmsterdam',
    re: /calendarYmdInAmsterdam\s*\(/,
    hint: 'Use amsterdamOpenRegisterBusinessDateYmd() or registerBusinessDateForInstant() for Daily Ops “today”. calendarYmdInAmsterdam is for Bork API fetch only (see ADR-010).',
  },
  {
    id: 'utcIsoTodaySlice',
    re: /new Date\(\)\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/,
    hint: 'UTC ISO date is not register business_date. Use amsterdamOpenRegisterBusinessDateYmd() (ADR-010).',
  },
  {
    id: 'utcIsoYesterdaySlice',
    re: /Date\.now\(\)\s*-\s*86400000\)\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/,
    hint: 'Use addCalendarDaysYmd(amsterdamOpenRegisterBusinessDateYmd(), -1) for yesterday register day (ADR-010).',
  },
]

function listSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const abs = join(dir, name)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.nuxt') continue
      listSourceFiles(abs, out)
      continue
    }
    if (/\.(ts|vue|js|mjs)$/.test(name)) out.push(abs)
  }
  return out
}

function relPath(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, '/')
}

function collectScanFiles(): string[] {
  const files = new Set<string>()
  for (const root of SCAN_ROOTS) {
    const abs = resolve(ROOT, root)
    try {
      const st = statSync(abs)
      if (st.isFile()) {
        files.add(abs)
        continue
      }
    } catch {
      continue
    }
    for (const f of listSourceFiles(abs)) files.add(f)
  }
  return [...files]
}

export function detectBusinessDayIsoMisuseNotifications(): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []

  for (const abs of collectScanFiles()) {
    const rel = relPath(abs)
    if (ALLOWLIST.has(rel)) continue

    let content: string
    try {
      content = readFileSync(abs, 'utf-8')
    } catch {
      continue
    }

    for (const { id, re, hint } of FORBIDDEN_PATTERNS) {
      if (!re.test(content)) continue
      items.push(
        buildNotificationItem({
          kind: 'daily_ops_iso_calendar_misuse',
          businessDate: 'system',
          locationId: `platform:${rel.replace(/\//g, '_')}:${id}`,
          locationName: 'Platform',
          message: `${rel} uses ISO/calendar date logic (\`${id}\`) in a Daily Ops read/UI path. Violates ADR-010 register business day.`,
          fixHint: hint,
          severity: 'critical',
          meta: { file: rel, pattern: id, adr: 'ADR-010' },
        }),
      )
    }
  }

  return items
}
