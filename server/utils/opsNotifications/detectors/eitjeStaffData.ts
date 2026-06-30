/**
 * @description: Eitje staff data quality — aligned with eitjeStaffHub (ADR-009 Option B).
 * @last-fix: [2026-06-28] Use staff hub SSOT; active staff only; register notification kinds.
 * @adr-ref: ADR-009
 */

import type { Db } from 'mongodb'
import { getEitjeStaffHubRows, isStaffHubRowActive } from '../../eitjeStaffHub'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'

function staffNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function detectEitjeStaffDataNotifications(db: Db): Promise<OpsNotificationDto[]> {
  const items: OpsNotificationDto[] = []
  const rows = await getEitjeStaffHubRows(db, { bustCache: true })

  for (const row of rows) {
    if (!isStaffHubRowActive(row)) continue

    if (row.is_unmatched) {
      items.push(
        buildNotificationItem({
          kind: 'eitje_staff_not_in_members',
          businessDate: row.recent_activity.last_worked ?? 'system',
          locationId: 'staff',
          locationName: 'Staff',
          idSuffix: staffNameKey(row.employee_name),
          message: `"${row.employee_name}" has ${Math.round(row.recent_activity.total_hours)}h in the last 30 days in Eitje but is not in members.`,
          fixHint: `Add "${row.employee_name}" to members with contract_type, hourly_rate, and support_id.`,
          severity: 'warning',
          meta: {
            user_name: row.employee_name,
            last_worked: row.recent_activity.last_worked,
            total_hours: row.recent_activity.total_hours,
          },
        }),
      )
      continue
    }

    if (!row.member_id || row.compensation_status !== 'missing') continue

    items.push(
      buildNotificationItem({
        kind: 'eitje_staff_missing_compensation',
        businessDate: row.recent_activity.last_worked ?? 'system',
        locationId: 'staff',
        locationName: 'Staff',
        idSuffix: row.member_id,
        message: `Active staff "${row.employee_name}" is missing compensation data (${row.missing_data.join(', ') || 'contract/rate'}). ${Math.round(row.recent_activity.total_hours)}h in last 30 days.`,
        fixHint: `Update members/${row.member_id} with contract_type and hourly_rate (or cost_per_hour). Staff hub uses compensation revisions SSOT.`,
        severity: 'warning',
        meta: {
          member_id: row.member_id,
          name: row.employee_name,
          missing_fields: row.missing_data,
          total_hours: row.recent_activity.total_hours,
        },
      }),
    )
  }

  return items
}
