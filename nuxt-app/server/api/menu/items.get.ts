import { getMenuItemsCollection } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Math.max(0, Number(query.limit) || 50), 2000)
  const skip = Math.max(0, Number(query.skip) || 0)
  const type = typeof query.type === 'string' ? query.type : undefined
  const subType = typeof query.subType === 'string' ? query.subType : undefined

  const coll = await getMenuItemsCollection()
  const filter: Record<string, unknown> = {}
  if (type) filter.type = type
  if (subType) filter.subType = subType

  const [items, total] = await Promise.all([
    coll
      .find(filter)
      .sort({ productGroup: 1, sourceFile: 1, rowIndex: 1, sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    coll.countDocuments(filter),
  ])

  const data = items.map((doc) => {
    const { _id, ...rest } = doc
    return { _id: _id?.toString(), ...rest }
  })

  return { success: true, data, total }
})
