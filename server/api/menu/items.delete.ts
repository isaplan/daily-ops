import { getMenuItemsCollection } from '../../utils/db'

export default defineEventHandler(async () => {
  const coll = await getMenuItemsCollection()
  const result = await coll.deleteMany({})
  return { success: true, deleted: result.deletedCount }
})
