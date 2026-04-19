import { getDb } from '../utils/db'
import { ObjectId } from 'mongodb'

type ProductLine = {
  productId: string
  productName: string
  revenue: number
  quantity: number
}

function parseLocationId(raw: string | undefined): ObjectId | string {
  if (!raw || raw === 'all') {
    throw createError({ statusCode: 400, message: 'locationId is required' })
  }
  try {
    return new ObjectId(raw)
  } catch {
    return raw
  }
}

/** Match `bork_sales_by_worker.workerId`: ObjectId when mapped, else literal `'unknown'`. */
function parseWorkerIdForFilter(raw: string): ObjectId | string {
  const wid = raw.trim()
  if (!wid || wid === 'unknown') return 'unknown'
  try {
    return new ObjectId(wid)
  } catch {
    return wid
  }
}

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const groupBy = String(q.groupBy || '')
    const date = String(q.date || '')
    const hourRaw = q.hour
    const hour = typeof hourRaw === 'string' || typeof hourRaw === 'number' ? Number(hourRaw) : NaN

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(hour)) {
      throw createError({ statusCode: 400, message: 'date (YYYY-MM-DD) and hour are required' })
    }

    const locationId = parseLocationId(typeof q.locationId === 'string' ? q.locationId : undefined)

    const db = await getDb()
    let collectionName = ''
    const filter: Record<string, unknown> = { date, hour, locationId }

    if (groupBy === 'hour' || groupBy === 'date_location') {
      collectionName = 'bork_sales_by_hour'
    } else if (groupBy === 'table') {
      collectionName = 'bork_sales_by_table'
      const tn = typeof q.tableNumber === 'string' ? q.tableNumber : String(q.tableNumber ?? '')
      if (!tn) {
        throw createError({ statusCode: 400, message: 'tableNumber is required for table detail' })
      }
      filter.tableNumber = tn
    } else if (groupBy === 'worker') {
      collectionName = 'bork_sales_by_worker'
      const wid = typeof q.workerId === 'string' ? q.workerId : String(q.workerId ?? '')
      filter.workerId = parseWorkerIdForFilter(wid.length > 0 ? wid : 'unknown')
    } else if (groupBy === 'guestAccount') {
      collectionName = 'bork_sales_by_guest_account'
      const acc = typeof q.accountName === 'string' ? q.accountName : ''
      if (!acc) {
        throw createError({ statusCode: 400, message: 'accountName is required for guestAccount detail' })
      }
      filter.accountName = acc
    } else {
      throw createError({ statusCode: 400, message: 'Invalid groupBy for product detail' })
    }

    const doc = await db
      .collection(collectionName)
      .findOne(filter, { projection: { products: 1, _id: 0 } })

    const products = (doc?.products as ProductLine[] | undefined) ?? []

    return { success: true, products, collection: collectionName }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err
    throw createError({ statusCode: 500, message: 'Failed to load product breakdown' })
  }
})
