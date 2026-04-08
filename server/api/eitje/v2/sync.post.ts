import { getDb } from '../../../utils/db'
import {
  eitjeCredentialsHintMessage,
  loadActiveEitjeCredentials,
  pingEitjeApi,
  syncEitjeByRequest,
} from '../../../services/eitjeSyncService'

type Body = {
  endpoint?: string
  startDate?: string
  endDate?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const db = await getDb()
  const ep = body?.endpoint ?? 'environments'

  if (ep === 'environments' || ep === 'locations') {
    const creds = await loadActiveEitjeCredentials(db)
    if (!creds) {
      return { success: false, error: eitjeCredentialsHintMessage() }
    }
    const ping = await pingEitjeApi(creds)
    return {
      success: ping.ok,
      message: ping.message,
      error: ping.ok ? undefined : ping.message,
    }
  }

  const result = await syncEitjeByRequest(db, {
    endpoint: ep,
    startDate: body?.startDate,
    endDate: body?.endDate,
  })

  return {
    success: result.ok,
    message: result.message,
    error: result.ok ? undefined : result.message,
    sync: result,
  }
})
