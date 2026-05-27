import { getDb } from '../../utils/db'
import { tryFixOpsNotification } from '../../utils/opsNotifications/tryFixNotification'
import type { OpsNotificationKind } from '~/types/ops-notifications'

type Body = {
  kind?: OpsNotificationKind
  businessDate?: string
  locationId?: string
  meta?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const kind = body.kind
  const businessDate = body.businessDate?.trim()
  const locationId = body.locationId?.trim()

  if (!kind || !businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw createError({ statusCode: 400, message: 'kind and businessDate (YYYY-MM-DD) required' })
  }
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId required' })
  }

  const db = await getDb()
  return tryFixOpsNotification(db, { kind, businessDate, locationId, meta: body.meta })
})
