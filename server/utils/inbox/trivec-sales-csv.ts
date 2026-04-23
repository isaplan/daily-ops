/**
 * @registry-id: trivecSalesCsv
 * @created: 2026-04-19T00:00:00.000Z
 * @last-modified: 2026-04-24T00:00:00.000Z
 * @description: Normalize Trivec semicolon "Sales" exports (preamble + one product row per line) into flat rows for dataMappingService
 * @last-fix: [2026-04-24] Extract location_name from CSV header + include in normalized rows
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 */

import type { ParseResult } from '~/types/inbox'
import { parseDdMmYyyyToNoonUtc, parseEuroInbox } from './inbox-sales-row-canonical'

const EUROISH = /[\u20AC\uFFFD\u0080]/

function extractReportDateDdMmYyyy(csvText: string): string | null {
  const range = csvText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}/)
  if (range) return range[1]
  const one = csvText.match(/(\d{2}\/\d{2}\/\d{4})/)
  return one ? one[1] : null
}

/** Extract location name from Trivec CSV: find the non-null string value that repeats across rows. */
export function extractLocationFromTrivecCsv(parseResult: ParseResult): string | null {
  if (!parseResult.rows || parseResult.rows.length < 2) return null
  
  // Sample first 10 rows to find the location field (repeating non-null value)
  const columnValues: Record<string, Set<string>> = {}
  
  for (const row of parseResult.rows.slice(0, 10)) {
    for (const [k, v] of Object.entries(row)) {
      if (/^column_\d+$/.test(k) && v != null && String(v).trim().length > 2) {
        if (!columnValues[k]) columnValues[k] = new Set()
        columnValues[k].add(String(v).trim())
      }
    }
  }
  
  // Find column that has exactly one consistent value (location)
  for (const [_col, values] of Object.entries(columnValues)) {
    if (values.size === 1) {
      const [locName] = values
      if (locName && !/sales?|total|amount|count|quantit/i.test(locName)) {
        return locName
      }
    }
  }
  
  return null
}

function rowToOrderedCells(row: Record<string, unknown>): string[] {
  const entries = Object.entries(row).filter(([k]) => /^column_\d+$/i.test(k))
  entries.sort((a, b) => {
    const na = Number(a[0].replace(/^column_/i, ''))
    const nb = Number(b[0].replace(/^column_/i, ''))
    return na - nb
  })
  return entries.map(([, v]) => String(v ?? '').trim())
}

function firstAmountColumnIndex(cells: string[]): number {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] || ''
    if (EUROISH.test(c)) return i
    const compact = c.replace(/\s/g, '')
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(compact)) return i
  }
  return -1
}

function isPlainIntegerCell(s: string): boolean {
  return /^\d+$/.test(s.trim())
}

/**
 * Maps each physical semicolon row (column_*) to keys stored in inbox-bork-sales / mapped bork_sales.
 */
export function normalizeTrivecSemicolonSalesParse(parseResult: ParseResult, rawCsvText: string): ParseResult {
  if (!parseResult.success) return parseResult

  const reportDateStr = extractReportDateDdMmYyyy(rawCsvText)
  const reportDate = reportDateStr ? parseDdMmYyyyToNoonUtc(reportDateStr) : null
  const locationName = extractLocationFromTrivecCsv(parseResult)
  const outRows: Record<string, unknown>[] = []

  for (const row of parseResult.rows) {
    const cells = rowToOrderedCells(row)
    if (cells.length === 0) continue

    const amountIdx = firstAmountColumnIndex(cells)
    let product = ''
    let revenueRaw = '0'
    let quantity: number | string = 0

    if (amountIdx >= 0) {
      const before = cells.slice(0, amountIdx)
      product = [...before].reverse().find((c) => c.length > 0) || ''
      revenueRaw = cells[amountIdx] || '0'
      if (amountIdx > 0 && isPlainIntegerCell(cells[amountIdx - 1])) {
        quantity = Number.parseInt(cells[amountIdx - 1], 10) || 0
      }
    } else {
      product = cells.filter((c) => c.length > 0).join(' | ')
    }

    const trimmedProduct = product.trim() || '(row)'
    const qtyNum = typeof quantity === 'number' ? quantity : Number(quantity) || 0
    outRows.push({
      date: reportDate,
      location_name: locationName,
      product_name: trimmedProduct,
      revenue: parseEuroInbox(revenueRaw),
      quantity: qtyNum,
    })
  }

  return {
    ...parseResult,
    success: true,
    headers: ['date', 'location_name', 'product_name', 'revenue', 'quantity'],
    rows: outRows,
    rowCount: outRows.length,
    metadata: {
      ...parseResult.metadata,
      trivecSalesNormalized: true,
      trivecReportDate: reportDateStr,
      trivecLocation: locationName,
    },
  }
}
