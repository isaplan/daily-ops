import { getDb } from '../../utils/db'
import { runOpsNotificationScan } from '../../utils/opsNotifications/runOpsNotificationScan'
import type { OpsNotificationsCountDto } from '~/types/ops-notifications'

export default defineEventHandler(async (event): Promise<OpsNotificationsCountDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store, max-age=0')
  const db = await getDb()
  const report = await runOpsNotificationScan(db, { lookbackDays: 14, skipArchitecture: true })
  return {
    total: report.total,
    criticalCount: report.criticalCount,
    warningCount: report.warningCount,
  }
})
