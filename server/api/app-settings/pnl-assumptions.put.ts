/**
 * @registry-id: appSettingsPnlAssumptionsPut
 * @created: 2026-05-31T12:00:00.000Z
 * @last-modified: 2026-05-31T12:00:00.000Z
 * @description: PUT org-wide P&L calculation assumptions into app_settings
 * @last-fix: [2026-05-31] Initial Mongo-backed assumptions write
 * @role-ref: MUST restrict to admin|owner when RBAC is implemented — currently open for dev
 *
 * @exports-to:
 * ✓ composables/useDailyOpsRevenuePnlAssumptions.ts
 */

import { getDb } from '../../utils/db'
import { savePnlAssumptions } from '../../utils/appSettings/pnlAssumptionsSetting'
import type { PnlAssumptionsSettingDto } from '~/types/app-settings'
import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

export default defineEventHandler(async (event): Promise<PnlAssumptionsSettingDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<Partial<DailyOpsSimplePnLAssumptions>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body required' })
  }
  const db = await getDb()
  // TODO(role-rbac): require session member role admin|owner before save
  return savePnlAssumptions(db, body)
})
