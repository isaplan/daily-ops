/**
 * @registry-id: eitjeStaffRefreshFromInbox
 * @created: 2026-06-06T13:15:00.000Z
 * @last-modified: 2026-06-06T13:15:00.000Z
 * @description: Manual endpoint to refresh members collection from inbox-eitje-hours (current month)
 * @last-fix: [2026-06-06] Created for retroactive contract updates (ADR-009 Option B)
 *
 * @adr-ref: ADR-009
 *
 * @exports-to:
 * ✓ Admin/ops manual refresh when needed
 */

import { getDb } from '../../utils/db'
import { applyContractInboxRowToMember } from '../../utils/memberCompensationRevisions'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const targetMonth = body?.month || new Date().toISOString().slice(0, 7) // YYYY-MM

    const db = await getDb()

    // Get start and end of target month
    const [year, month] = targetMonth.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid month format. Use YYYY-MM',
      })
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    console.log(`[eitje-staff-refresh] Processing inbox-eitje-hours for ${targetMonth}`)
    console.log(`  Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Fetch all inbox-eitje-hours rows for target month
    const rows = await db
      .collection('inbox-eitje-hours')
      .find({
        date: { $gte: startDate, $lte: endDate },
      })
      .project({
        employee_name: 1,
        support_id: 1,
        hourly_rate: 1,
        contract_type: 1,
        contract_location: 1,
        contract_start_date: 1,
        contract_end_date: 1,
        cost_per_hour: 1,
        date: 1,
      })
      .toArray()

    console.log(`[eitje-staff-refresh] Found ${rows.length} inbox rows`)

    // Deduplicate by employee_name + support_id (keep latest by date)
    const byKey = new Map<string, any>()
    for (const row of rows) {
      const key = `${String(row.employee_name ?? '').trim().toLowerCase()}|${String(row.support_id ?? '').trim()}`
      const existing = byKey.get(key)
      if (!existing || (row.date && existing.date && row.date > existing.date)) {
        byKey.set(key, row)
      }
    }

    console.log(`[eitje-staff-refresh] Deduped to ${byKey.size} unique staff`)

    // Apply contract data to members
    let updated = 0
    let skipped = 0

    for (const row of byKey.values()) {
      // Only apply if row has contract data
      if (row.hourly_rate || row.contract_type || row.support_id) {
        try {
          await applyContractInboxRowToMember(db, row)
          updated++
        } catch (error) {
          console.error(
            `[eitje-staff-refresh] Failed to apply row for ${row.employee_name}:`,
            error
          )
          skipped++
        }
      } else {
        skipped++
      }
    }

    return {
      success: true,
      month: targetMonth,
      total_rows: rows.length,
      unique_staff: byKey.size,
      updated,
      skipped,
      message: `Successfully refreshed ${updated} staff members from inbox-eitje-hours for ${targetMonth}`,
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage:
        error instanceof Error ? error.message : 'Failed to refresh staff from inbox',
    })
  }
})
