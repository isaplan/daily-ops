/**
 * @registry-id: borkExtractTableNumber
 * @created: 2026-05-30T00:00:00.000Z
 * @last-modified: 2026-05-30T00:00:00.000Z
 * @description: Read Bork table number from warm-tier sales-by-table aggregation rows
 * @last-fix: [2026-05-30] Support tableNumber (v2 agg) plus legacy field names
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsSnapshot/buildRevenueTablesSection.ts
 */

export function extractBorkTableNumber(doc: Record<string, unknown>): string {
  const raw = doc.tableNumber ?? doc.tableNum ?? doc.table_nr ?? doc.TableNr
  if (raw == null) return ''
  const value = String(raw).trim()
  return value.length > 0 ? value : ''
}
