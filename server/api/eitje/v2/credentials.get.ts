import { getDb } from '../../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const row = await db.collection('api_credentials').findOne(
    { provider: 'eitje', isActive: true },
    { sort: { createdAt: -1 } }
  )

  return {
    success: true,
    credentials: row
      ? {
          baseUrl: row.baseUrl || 'https://open-api.eitje.app/open_api',
          additionalConfig: row.additionalConfig || {},
        }
      : null,
  }
})
