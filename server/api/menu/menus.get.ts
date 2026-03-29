import { getMenusCollection } from '../../utils/db'

export default defineEventHandler(async () => {
  const coll = await getMenusCollection()
  const docs = await coll
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray()
  const data = docs.map((doc) => {
    const { _id, ...rest } = doc
    return { _id: _id?.toString(), ...rest }
  })
  return { success: true, data }
})
