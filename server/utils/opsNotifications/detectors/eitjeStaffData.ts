/**
 * Ops notification detector: Eitje staff data quality issues.
 *
 * Detects:
 * 1. Staff in Eitje API (recent activity) but NOT in members collection
 * 2. Staff in members but missing critical data (hourly_rate, contract_type, support_id)
 */

import type { Db } from 'mongodb'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'

export async function detectEitjeStaffDataNotifications(db: Db): Promise<OpsNotificationDto[]> {
  const items: OpsNotificationDto[] = []

  // Get staff with recent API activity (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoffYmd = thirtyDaysAgo.toISOString().slice(0, 10)

  const apiStaff = await db
    .collection('eitje_time_registration_aggregation')
    .aggregate<{
      user_name: string
      last_worked: string
      total_hours: number
    }>([
      {
        $match: {
          period: { $gte: cutoffYmd },
          user_name: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$user_name' } } },
          user_name: { $first: '$user_name' },
          last_worked: { $max: '$period' },
          total_hours: { $sum: { $ifNull: ['$total_hours', 0] } },
        },
      },
      { $match: { total_hours: { $gt: 0 } } },
    ])
    .toArray()

  // Get all members
  const members = await db
    .collection('members')
    .find({})
    .project({
      name: 1,
      support_id: 1,
      hourly_rate: 1,
      contract_type: 1,
    })
    .toArray()

  const membersByName = new Map(
    members.map((m) => [
      String(m.name ?? '')
        .trim()
        .toLowerCase(),
      m,
    ])
  )

  // 1. Check for staff in API but NOT in members (new staff not yet in system)
  for (const staff of apiStaff) {
    const nameKey = String(staff.user_name ?? '')
      .trim()
      .toLowerCase()
    
    if (!membersByName.has(nameKey)) {
      items.push(
        buildNotificationItem({
          kind: 'eitje_staff_not_in_members',
          businessDate: staff.last_worked,
          locationId: 'all',
          severity: 'warning',
          title: `New staff in Eitje API: ${staff.user_name}`,
          description: `Staff member "${staff.user_name}" has ${Math.round(staff.total_hours)}h worked in last 30 days but is NOT in members collection. Last worked: ${staff.last_worked}.`,
          actionRequired: 'Add this staff member to members collection with contract details (hourly_rate, contract_type, support_id).',
          meta: {
            user_name: staff.user_name,
            last_worked: staff.last_worked,
            total_hours: Math.round(staff.total_hours * 100) / 100,
          },
        })
      )
    }
  }

  // 2. Check for members missing critical data
  for (const member of members) {
    const missing: string[] = []
    if (!member.hourly_rate) missing.push('hourly_rate')
    if (!member.contract_type || String(member.contract_type).trim() === '') missing.push('contract_type')
    if (!member.support_id || String(member.support_id).trim() === '') missing.push('support_id')

    if (missing.length > 0) {
      const nameKey = String(member.name ?? '')
        .trim()
        .toLowerCase()
      const hasRecentActivity = apiStaff.some(
        (s) => String(s.user_name ?? '').trim().toLowerCase() === nameKey
      )

      const activityStaff = apiStaff.find(
        (s) => String(s.user_name ?? '').trim().toLowerCase() === nameKey
      )

      items.push(
        buildNotificationItem({
          kind: 'eitje_staff_missing_data',
          businessDate: activityStaff?.last_worked || 'unknown',
          locationId: 'all',
          severity: 'error',
          title: `Staff missing critical data: ${member.name}`,
          description: `Staff member "${member.name}" is missing: ${missing.join(', ')}. ${hasRecentActivity ? `Has recent activity (${Math.round(activityStaff?.total_hours ?? 0)}h last 30 days).` : 'No recent activity.'}`,
          actionRequired: `Update members collection for "${member.name}" with: ${missing.join(', ')}. Without this data, cost calculations will be inaccurate.`,
          meta: {
            member_id: String(member._id),
            name: member.name,
            missing_fields: missing,
            has_recent_activity: hasRecentActivity,
            total_hours: activityStaff ? Math.round(activityStaff.total_hours * 100) / 100 : 0,
          },
        })
      )
    }
  }

  return items
}
