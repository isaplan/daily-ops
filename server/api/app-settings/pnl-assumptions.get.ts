/**
 * @registry-id: appSettingsPnlAssumptionsGet
 * @created: 2026-05-31T12:00:00.000Z
 * @last-modified: 2026-05-31T12:00:00.000Z
 * @description: GET org-wide P&L calculation assumptions from app_settings
 * @last-fix: [2026-05-31] Initial Mongo-backed assumptions read
 * @role-ref: Read is open; PUT restricted to admin|owner when RBAC lands
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenuePnlAssumptions.ts
 */

import { getDb } from '../../utils/db'
import { loadPnlAssumptionsDto } from '../../utils/appSettings/pnlAssumptionsSetting'
import type { PnlAssumptionsSettingDto } from '~/types/app-settings'

export default defineEventHandler(async (event): Promise<PnlAssumptionsSettingDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const db = await getDb()
  return loadPnlAssumptionsDto(db)
})
