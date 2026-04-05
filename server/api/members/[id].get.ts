import { ObjectId } from 'mongodb'
import { getDb } from '../../utils/db'
import { fetchContractLocations, fetchHoursActivityByLocationTeam } from '../../utils/memberEitjeContext'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  let oid: ObjectId
  try {
    oid = new ObjectId(id)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const db = await getDb()
  const member = await db.collection('members').findOne({
    _id: oid,
  })
  if (!member) {
    throw createError({ statusCode: 404, statusMessage: 'Member not found' })
  }
  const m = member as Record<string, unknown>
  const nameVal = m.name ?? m.Name ?? m.naam ?? m.displayName ?? m.full_name ?? m.title
  const name = typeof nameVal === 'string' ? nameVal.trim() : ''
  const locationId = m.location_id as unknown
  const teamId = m.team_id as unknown
  let locationName: string | undefined
  let teamName: string | undefined
  if (locationId) {
    try {
      const loc = await db.collection('locations').findOne({ _id: new ObjectId(String(locationId)) })
      locationName = loc ? (loc as Record<string, unknown>).name as string : undefined
    } catch {
      // ignore
    }
  }
  if (teamId) {
    try {
      const team = await db.collection('teams').findOne({ _id: new ObjectId(String(teamId)) })
      teamName = team ? (team as Record<string, unknown>).name as string : undefined
    } catch {
      // ignore
    }
  }

  const supportIdStr = typeof m.support_id === 'string' ? m.support_id : undefined
  const [contract_locations, hours_activity] = await Promise.all([
    fetchContractLocations(db, supportIdStr, name),
    fetchHoursActivityByLocationTeam(db, {
      supportId: supportIdStr,
      userName: name,
      monthsBack: 3,
    }),
  ])

  const data = {
    _id: String(member._id),
    name: name || `Member ${String(member._id).slice(-6)}`,
    email: (typeof m.email === 'string' ? m.email : '') || '',
    slack_username: typeof m.slack_username === 'string' ? m.slack_username : undefined,
    location_id: locationId ? String(locationId) : undefined,
    team_id: teamId ? String(teamId) : undefined,
    location_name: locationName,
    team_name: teamName,
    is_active: m.is_active !== false && m.isActive !== false,
    // Worker data fields
    contract_type: typeof m.contract_type === 'string' ? m.contract_type : undefined,
    contract_start_date: m.contract_start_date ? new Date(m.contract_start_date as string).toISOString() : undefined,
    contract_end_date: m.contract_end_date ? new Date(m.contract_end_date as string).toISOString() : undefined,
    hourly_rate: typeof m.hourly_rate === 'number' ? m.hourly_rate : undefined,
    weekly_hours: typeof m.weekly_hours === 'number' ? m.weekly_hours : undefined,
    monthly_hours: typeof m.monthly_hours === 'number' ? m.monthly_hours : undefined,
    phone: typeof m.phone === 'string' ? m.phone : undefined,
    age: typeof m.age === 'number' ? m.age : undefined,
    birthday: typeof m.birthday === 'string' ? m.birthday : undefined,
    postcode: typeof m.postcode === 'string' ? m.postcode : undefined,
    city: typeof m.city === 'string' ? m.city : undefined,
    street: typeof m.street === 'string' ? m.street : undefined,
    nmbrs_id: typeof m.nmbrs_id === 'string' ? m.nmbrs_id : undefined,
    support_id: typeof m.support_id === 'string' ? m.support_id : undefined,
    contract_locations,
    hours_activity: {
      range_start: hours_activity.range_start,
      range_end: hours_activity.range_end,
      entries: hours_activity.entries,
    },
  }
  return { success: true, data }
})
