import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const members = await db
    .collection('members')
    .find({ is_active: true })
    .sort({ name: 1 })
    .project({ _id: 1, name: 1, email: 1 })
    .toArray()
  return { success: true, data: members }
})
