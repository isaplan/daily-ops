import { getDb } from '../../utils/db'

interface QueryParams {
  active?: string
}

export default defineEventHandler(async (event) => {
  const db = await getDb()
  const query = getQuery<QueryParams>(event)

  // Build filter
  const filter: Record<string, any> = {
    email: { $exists: true, $ne: '' },
  }

  // Filter by active status if specified
  if (query.active === 'true') {
    filter.is_active = true
  } else if (query.active === 'false') {
    filter.is_active = false
  }

  const workers = await db
    .collection('members')
    .find(filter)
    .sort({ name: 1 })
    .project({
      _id: 1,
      name: 1,
      email: 1,
      contract_type: 1,
      contract_start_date: 1,
      contract_end_date: 1,
      hourly_rate: 1,
      phone: 1,
      is_active: 1,
      age: 1,
      city: 1,
      postcode: 1,
      street: 1,
    })
    .toArray()

  const data = workers.map((w: any) => ({
    _id: String(w._id),
    name: w.name || '',
    email: w.email || '',
    contractType: w.contract_type || '',
    contractStartDate: w.contract_start_date ? new Date(w.contract_start_date).toISOString() : null,
    contractEndDate: w.contract_end_date ? new Date(w.contract_end_date).toISOString() : null,
    hourlyRate: w.hourly_rate || 0,
    phone: w.phone || '',
    isActive: w.is_active || false,
    age: w.age || null,
    city: w.city || '',
    postcode: w.postcode || '',
    street: w.street || '',
  }))

  return {
    success: true,
    count: data.length,
    data,
  }
})
