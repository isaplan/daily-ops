import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = await getDb()
  const members = await db.collection('members').find({}).sort({ name: 1 }).toArray()
  const data = members.map((m: Record<string, unknown>) => {
    const nameVal = m.name ?? m.Name ?? m.naam ?? m.displayName ?? m.full_name ?? m.title
    const name = typeof nameVal === 'string' ? nameVal.trim() : ''
    const isActive = m.is_active !== false && m.isActive !== false
    return {
      _id: String(m._id),
      name: name || `Member ${String(m._id).slice(-6)}`,
      email: (typeof m.email === 'string' ? m.email : '') || '',
      slack_username: typeof m.slack_username === 'string' ? m.slack_username : undefined,
      is_active: isActive,
    }
  })
  return { success: true, data }
})
