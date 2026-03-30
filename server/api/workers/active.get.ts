import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const activeWorkers = await db
    .collection('members')
    .find({
      is_active: true,
      email: { $exists: true, $ne: '' },
    })
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
    })
    .toArray()

  const data = activeWorkers.map((w: any) => ({
    _id: String(w._id),
    name: w.name || '',
    email: w.email || '',
    contractType: w.contract_type || '',
    contractStartDate: w.contract_start_date ? new Date(w.contract_start_date).toISOString() : null,
    contractEndDate: w.contract_end_date ? new Date(w.contract_end_date).toISOString() : null,
    hourlyRate: w.hourly_rate || 0,
    phone: w.phone || '',
  }))

  return {
    success: true,
    count: data.length,
    data,
  }
})
