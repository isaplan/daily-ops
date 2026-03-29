import { getDb } from '../../../utils/db'

type Body = {
  baseUrl: string
  additionalConfig?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.additionalConfig?.partner_username || !body.additionalConfig.partner_password ||
      !body.additionalConfig.api_username || !body.additionalConfig.api_password) {
    throw createError({ statusCode: 400, statusMessage: 'All credentials are required' })
  }

  const db = await getDb()

  // Deactivate all existing credentials
  await db.collection('api_credentials').updateMany(
    { provider: 'eitje' },
    { $set: { isActive: false, updatedAt: new Date() } }
  )

  // Create new active credentials
  const newCred = {
    provider: 'eitje',
    isActive: true,
    baseUrl: body.baseUrl || 'https://open-api.eitje.app/open_api',
    additionalConfig: {
      partner_username: body.additionalConfig.partner_username,
      partner_password: body.additionalConfig.partner_password,
      api_username: body.additionalConfig.api_username,
      api_password: body.additionalConfig.api_password,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await db.collection('api_credentials').insertOne(newCred)

  return { success: true, message: 'Credentials saved successfully' }
})
