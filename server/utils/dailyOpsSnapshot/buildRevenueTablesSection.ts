/**
 * @registry-id: dailyOpsSnapshotBuildRevenueTablesSection
 * @created: 2026-05-20T00:00:00.000Z
 * @last-modified: 2026-07-29T22:10:00.000Z
 * @description: Per-table revenue snapshot from bork_sales_by_table (+ tablesByHour)
 * @last-fix: [2026-07-29] Seal tablesByHour for real hourly bezettingsgraad (ADR-017)
 *   Prior: [2026-07-17] Upsert learned venue tables catalog on snapshot build
 * @adr-ref: ADR-004, ADR-013, ADR-017
 *
 * @exports-to:
 * ✓ server/services/dailyOpsSnapshotService.ts
 */

import type { Db } from 'mongodb'
import { extractBorkTableNumber } from '../bork/extractBorkTableNumber'
import { fetchBorkTableDayRows } from '../bork/fetchBorkTableDayRows'
import {
  fallbackSpaceNameForTable,
  loadLocationRevenueSpaces,
  resolveSpaceNameForTable,
} from '../locationSpaceResolver'
import { upsertKnownVenueTables } from '../dailyOpsVenueTables/upsertKnownTables'
import type { DailyOpsSnapshotRevenueTablesSection } from '../../../types/daily-ops-snapshot'
import type { BuildRevenueInput } from './buildRevenueSection'

function docRevenueEx(doc: Record<string, unknown>): number {
  const ex = Number(doc.total_revenue_ex_vat ?? 0)
  if (ex > 0) return ex
  return Number(doc.total_revenue ?? 0)
}

/** Register business_hour 0..23 → Amsterdam calendar hour (08:00 start). */
function calendarHourFromBusinessHour(businessHour: number): number {
  return (businessHour + 8) % 24
}

export async function buildRevenueTablesSection(
  db: Db,
  input: BuildRevenueInput,
  headlineExVat?: number,
): Promise<DailyOpsSnapshotRevenueTablesSection> {
  const { businessDate, locationId, locationName } = input
  const rows = await fetchBorkTableDayRows(db, businessDate, locationId)

  const { spaces } = await loadLocationRevenueSpaces(db, locationId, { seedIfEmpty: true, locationName })
  const spaceForTable = (tableNum: string) =>
    spaces.length > 0 ? resolveSpaceNameForTable(tableNum, spaces) : fallbackSpaceNameForTable(tableNum)

  const byTable = new Map<string, { revenue_ex_vat: number; quantity: number; locationSpace: string }>()
  const byHourTables = new Map<number, Set<string>>()

  for (const r of rows) {
    const doc = r as Record<string, unknown>
    const tableNum = extractBorkTableNumber(doc)
    if (!tableNum) continue
    const rev = docRevenueEx(doc)
    const qty = Number(doc.total_quantity ?? 0)
    const space = spaceForTable(tableNum)
    const cur = byTable.get(tableNum) ?? { revenue_ex_vat: 0, quantity: 0, locationSpace: space }
    cur.revenue_ex_vat += rev
    cur.quantity += qty
    byTable.set(tableNum, cur)

    const bhRaw = Number(doc.business_hour)
    if (Number.isFinite(bhRaw) && bhRaw >= 0 && bhRaw <= 23) {
      const set = byHourTables.get(bhRaw) ?? new Set<string>()
      set.add(tableNum)
      byHourTables.set(bhRaw, set)
    }
  }

  const rawTables = Array.from(byTable.entries())
    .map(([tableNum, v]) => ({
      tableNum,
      locationSpace: v.locationSpace,
      revenue_ex_vat: v.revenue_ex_vat,
      quantity: v.quantity,
    }))
    .sort((a, b) => b.revenue_ex_vat - a.revenue_ex_vat)

  const borkTotal = rawTables.reduce((sum, t) => sum + t.revenue_ex_vat, 0)
  const scale =
    headlineExVat && headlineExVat > 0 && borkTotal > 0 && Math.abs(headlineExVat / borkTotal - 1) >= 0.001
      ? headlineExVat / borkTotal
      : 1

  const tables = scale === 1
    ? rawTables
    : rawTables.map((t) => ({ ...t, revenue_ex_vat: Math.round(t.revenue_ex_vat * scale * 100) / 100 }))

  const tablesByHour = Array.from({ length: 24 }, (_, businessHour) => {
    const activeTables = byHourTables.get(businessHour)?.size ?? 0
    return {
      businessHour,
      calendarHour: calendarHourFromBusinessHour(businessHour),
      activeTables,
    }
  })

  if (tables.length > 0) {
    await upsertKnownVenueTables(
      db,
      tables.map((t) => ({
        locationId,
        locationName,
        tableNum: t.tableNum,
        locationSpace: t.locationSpace,
        businessDate,
      })),
    )
  }

  return {
    schema_version: 2,
    businessDate,
    locationId,
    locationName,
    tables,
    tablesByHour,
    lastBuiltAt: new Date(),
  }
}
