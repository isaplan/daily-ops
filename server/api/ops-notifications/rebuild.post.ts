import { getDb } from '../../utils/db'
import { buildDailyOpsSnapshot } from '../../services/dailyOpsSnapshotService'

type Body = {
  businessDate?: string
  locationId?: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const businessDate = body.businessDate?.trim()
  const locationId = body.locationId?.trim()
  if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
    throw createError({ statusCode: 400, message: 'businessDate (YYYY-MM-DD) required' })
  }
  if (!locationId) {
    throw createError({ statusCode: 400, message: 'locationId required' })
  }

  await getDb()
  const result = await buildDailyOpsSnapshot({ businessDate, locationId })
  return {
    ok: result.errors.length === 0,
    businessDate,
    locationId,
    built: result.built,
    errors: result.errors,
  }
})
