import { getDb } from '../../utils/db'
import { runOpsNotificationScan } from '../../utils/opsNotifications/runOpsNotificationScan'
import type { OpsNotificationsResponseDto } from '~/types/ops-notifications'

export default defineEventHandler(async (event): Promise<OpsNotificationsResponseDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const q = getQuery(event)
  const lookbackDays = q.lookbackDays ? Number(q.lookbackDays) : undefined
  const endDate = typeof q.endDate === 'string' ? q.endDate : undefined
  const db = await getDb()
  return runOpsNotificationScan(db, {
    lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays : undefined,
    endDate,
  })
})
