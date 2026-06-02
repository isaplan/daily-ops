/**
 * @registry-id: pnlAssumptionsSetting
 * @created: 2026-05-31T12:00:00.000Z
 * @last-modified: 2026-05-31T12:00:00.000Z
 * @description: Mongo-backed P&L assumption settings (Eenvoudige P&L + profit-by-interval SSOT)
 * @last-fix: [2026-05-31] Shared org-wide assumptions; default beverage COGS 30%
 * @role-ref: Writes via PUT must be admin|owner only when RBAC lands (see appSettingsStore)
 *
 * @exports-to:
 * ✓ server/api/daily-ops/revenue/pnl.get.ts
 * ✓ server/api/app-settings/pnl-assumptions.get.ts
 * ✓ server/api/app-settings/pnl-assumptions.put.ts
 * ✓ server/utils/dailyOpsSnapshot/fetchDashboardBundle.ts
 * ✓ server/utils/dailyOpsRevenue/pnlAssumptions.ts
 */

import type { Db } from 'mongodb'
import {
  APP_SETTING_KEYS,
  type PnlAssumptionsSettingDto,
  type PnlAssumptionsSettingValue,
} from '~/types/app-settings'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'
import {
  DEFAULT_PNL_ASSUMPTIONS,
  normalizePnlAssumptions,
} from '~/utils/dailyOpsPnlAssumptionsDefaults'
import { getAppSettingValue, setAppSettingValue } from './appSettingsStore'

export { DEFAULT_PNL_ASSUMPTIONS, normalizePnlAssumptions }

const PNL_ASSUMPTIONS_SCHEMA_VERSION = 1

export async function loadPnlAssumptions(db: Db): Promise<DailyOpsSimplePnLAssumptions> {
  const loaded = await getAppSettingValue(db, APP_SETTING_KEYS.PNL_ASSUMPTIONS, DEFAULT_PNL_ASSUMPTIONS)
  return normalizePnlAssumptions(loaded.value)
}

export async function loadPnlAssumptionsDto(db: Db): Promise<PnlAssumptionsSettingDto> {
  const loaded = await getAppSettingValue(db, APP_SETTING_KEYS.PNL_ASSUMPTIONS, DEFAULT_PNL_ASSUMPTIONS)
  return {
    assumptions: normalizePnlAssumptions(loaded.value),
    source: loaded.source,
    updatedAt: loaded.updatedAt?.toISOString() ?? null,
  }
}

export async function savePnlAssumptions(
  db: Db,
  next: Partial<DailyOpsSimplePnLAssumptions>,
  updatedBy?: string | null,
): Promise<PnlAssumptionsSettingDto> {
  const assumptions = normalizePnlAssumptions(next)
  const saved = await setAppSettingValue<PnlAssumptionsSettingValue>(db, {
    key: APP_SETTING_KEYS.PNL_ASSUMPTIONS,
    category: 'calculations',
    schemaVersion: PNL_ASSUMPTIONS_SCHEMA_VERSION,
    description: 'Eenvoudige P&L + Daily Ops profit-by-interval COGS and overhead assumptions',
    value: assumptions,
    updatedBy: updatedBy ?? null,
  })
  return {
    assumptions: normalizePnlAssumptions(saved.value),
    source: 'mongo',
    updatedAt: saved.updatedAt.toISOString(),
  }
}
