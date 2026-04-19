import { getDb } from '../../../utils/db'
import { documentToCredentialsApiShape, findEitjeCredentialDocument } from '../../../utils/eitjeApiCredentials'

export default defineEventHandler(async () => {
  const db = await getDb()
  const row = await findEitjeCredentialDocument(db)
  const credentials = row ? documentToCredentialsApiShape(row) : null

  return {
    success: true,
    credentials,
  }
})
