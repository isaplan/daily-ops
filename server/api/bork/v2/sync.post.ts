import { getDb } from '../../../utils/db'
import { executeBorkJob, syncBorkSingleLocation } from '../../../services/borkSyncService'

type Body = {
  locationId?: string
  endpoint?: string
  /** When true, only hit lightweight paths (connection test). */
  ping?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const db = await getDb()

  if (body?.locationId) {
    const mode = body.ping ? 'ping' : body.endpoint === 'master' || body.endpoint === 'master-data' ? 'master' : 'daily'
    const result = await syncBorkSingleLocation(db, body.locationId, mode)
    return {
      success: result.ok,
      message: result.message,
      sync: result,
    }
  }

  const jobType =
    body?.endpoint === 'master' || body?.endpoint === 'master-data'
      ? 'master-data'
      : body?.endpoint === 'historical-data'
        ? 'historical-data'
        : 'daily-data'

  const result = await executeBorkJob(db, jobType)
  return {
    success: result.ok,
    message: result.message,
    sync: result,
  }
})
