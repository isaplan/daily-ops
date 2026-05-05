/**
 * Basis Report Mapper — Transform parsed XLSX data into structured sales format
 * Handles: Netto Sales, Betalingen, Correcties, Interne Verkoop
 * Preserves: Inc VAT, Ex VAT prices
 */

import type { ParseResult } from '~/types/inbox'

export type BasisReportData = {
  date: string
  location: string
  address?: string
  cron_hour?: number
  sections: {
    netto_sales?: {
      categories: Array<{
        name: string
        quantity: number
        price_incl_vat: number
        price_ex_vat: number
      }>
      grand_total?: {
        quantity: number
        price_incl_vat: number
        price_ex_vat: number
      }
    }
    payments?: {
      methods: Array<{
        method: string
        quantity: number
      }>
      grand_total_qty?: number
    }
    corrections?: {
      adjustments: Array<{
        user: string
        action?: string
        quantity: number
        price_incl_vat: number
        price_ex_vat: number
      }>
      grand_total?: {
        quantity: number
        price_incl_vat: number
        price_ex_vat: number
      }
    }
    internal_sales?: {
      staff: Array<{
        user: string
        ticket_type?: string
        quantity: number
        price_incl_vat?: number
        price_ex_vat?: number
      }>
      grand_total?: {
        quantity: number
        price_incl_vat: number
        price_ex_vat: number
      }
    }
  }
  final_revenue_incl_vat: number
  final_revenue_ex_vat: number
}

export function mapBasisReportXLSX(
  parseResult: ParseResult,
  fileName: string,
): BasisReportData | null {
  if (!parseResult.success || parseResult.rows.length === 0) {
    console.log('[mapBasisReportXLSX] Failed: success=', parseResult.success, 'rows=', parseResult.rows.length)
    return null
  }

  const rows = parseResult.rows as Record<string, unknown>[]
  const headers = parseResult.headers || []

  console.log('[mapBasisReportXLSX] Mapping', rows.length, 'rows')

  // Extract date and location
  const dateStr = extractDateFromFile(rows)
  const location = extractLocationFromFile(rows, fileName)
  
  console.log('[mapBasisReportXLSX] Date:', dateStr, 'Location:', location)

  const data: BasisReportData = {
    date: dateStr,
    location,
    sections: {},
    final_revenue_incl_vat: 0,
    final_revenue_ex_vat: 0,
  }

  // For Basis Rapport, the structure is:
  // First set of rows: product categories (Netto Sales)
  // Look for "Grand Total" to mark the end
  const nettoSalesRows: Record<string, unknown>[] = []
  let foundGrandTotal = false

  for (const row of rows) {
    const firstCol = Object.values(row)[0] as string | number | undefined
    const firstColStr = String(firstCol || '').toLowerCase().trim()

    if (firstColStr.includes('grand total')) {
      foundGrandTotal = true
      // This row is the grand total for netto sales
      nettoSalesRows.push(row)
      break
    }

    // Skip header rows
    if (firstColStr.includes('groep') || firstColStr === '') {
      continue
    }

    // Add to netto sales
    nettoSalesRows.push(row)
  }

  if (nettoSalesRows.length > 0) {
    data.sections.netto_sales = mapNettoSales(nettoSalesRows, headers)
    console.log('[mapBasisReportXLSX] Mapped', nettoSalesRows.length, 'netto_sales rows, categories:', data.sections.netto_sales?.categories?.length || 0)
  } else {
    console.log('[mapBasisReportXLSX] NO netto sales rows found!')
  }

  // Calculate final revenue
  if (data.sections.netto_sales?.grand_total) {
    data.final_revenue_incl_vat = data.sections.netto_sales.grand_total.price_incl_vat
    data.final_revenue_ex_vat = data.sections.netto_sales.grand_total.price_ex_vat
  }

  console.log('[mapBasisReportXLSX] FINAL: returning data with date=', data.date, 'revenue=', data.final_revenue_incl_vat, 'location=', data.location)
  
  // DEBUG: Always return something
  if (!data.date || data.date === 'Invalid date' || data.date.includes('undefined')) {
    console.log('[mapBasisReportXLSX] ERROR: Invalid date extracted, setting to today')
    data.date = new Date().toISOString().split('T')[0]
  }
  if (!data.location || data.location === 'Unknown') {
    console.log('[mapBasisReportXLSX] WARNING: Unknown location')
  }
  
  return data
}

function extractDateFromFile(rows: Record<string, unknown>[]): string {
  // Look for date range in first few rows
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const vals = Object.values(rows[i])
    for (const val of vals) {
      const str = String(val).trim()
      if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
        // Extract end date from range (05/05/2026 - 05/05/2026 → 05/05/2026)
        const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (match) {
          const [, m, d, y] = match
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
        const matchSingle = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (matchSingle) {
          const [, m, d, y] = matchSingle
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
      }
    }
  }
  return new Date().toISOString().split('T')[0]
}

function extractLocationFromFile(rows: Record<string, unknown>[], fileName: string): string {
  // Look for location name in first few rows (usually after "Basis Rapport")
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const vals = Object.values(rows[i])
    for (const val of vals) {
      const str = String(val).trim()
      // Common location names
      if (
        str.match(
          /^(Bar|Kinsbergen|lAmour|Barbea|Bea|Restaurant|Cafe|Gastropub|Bistro)/i,
        )
      ) {
        return str
      }
    }
  }
  // Fallback to extract from filename
  if (fileName.includes('Kinsbergen')) return 'Kinsbergen'
  if (fileName.includes('lAmour')) return 'lAmour Toujours'
  if (fileName.includes('Barbea')) return 'Barbea'
  if (fileName.includes('Bea')) return 'Bea'
  return 'Unknown'
}

function mapNettoSales(
  rows: Record<string, unknown>[],
  headers: string[],
): BasisReportData['sections']['netto_sales'] {
  console.log('[mapNettoSales] Input: rows=', rows.length, 'headers=', headers.slice(0, 5))
  if (rows.length === 0) {
    console.log('[mapNettoSales] No rows!')
    return { categories: [], grand_total: { quantity: 0, price_incl_vat: 0, price_ex_vat: 0 } }
  }

  console.log('[mapNettoSales] First row keys:', Object.keys(rows[0]))
  console.log('[mapNettoSales] First row values:', JSON.stringify(Object.entries(rows[0]).slice(0, 3)))

  const categories: BasisReportData['sections']['netto_sales']['categories'] = []
  let grandTotalQty = 0
  let grandTotalIncl = 0
  let grandTotalEx = 0

  for (const row of rows) {
    // Find the relevant columns - the first non-null value is usually the product name
    const name = Object.values(row).find(v => v && String(v).trim() && !String(v).toLowerCase().includes('groep'))
    const nameStr = String(name || '').trim()

    if (nameStr.toLowerCase().includes('grand total')) {
      const values = Object.values(row)
      grandTotalQty = parseFloat(String(values[1] || 0))
      grandTotalIncl = parsePrice(String(values[2] || 0))
      grandTotalEx = parsePrice(String(values[3] || 0))
      continue
    }

    if (nameStr && !nameStr.toLowerCase().includes('groep')) {
      const values = Object.values(row)
      const qty = parseFloat(String(values[1] || 0))
      const incl = parsePrice(String(values[2] || 0))
      const ex = parsePrice(String(values[3] || 0))

      if (!Number.isNaN(qty) && qty > 0) {
        categories.push({
          name: nameStr,
          quantity: qty,
          price_incl_vat: incl,
          price_ex_vat: ex,
        })
      }
    }
  }

  console.log('[mapNettoSales] Returned', categories.length, 'categories, grandTotal=', grandTotalQty)
  return {
    categories,
    grand_total: {
      quantity: grandTotalQty,
      price_incl_vat: grandTotalIncl,
      price_ex_vat: grandTotalEx,
    },
  }
}

function mapPayments(
  rows: Record<string, unknown>[],
): BasisReportData['sections']['payments'] {
  const methods: BasisReportData['sections']['payments']['methods'] = []
  let grandTotalQty = 0

  for (const row of rows) {
    const method = String(Object.values(row)[0] || '').trim()

    if (method.toLowerCase() === 'grand total') {
      grandTotalQty = parseFloat(String(Object.values(row)[1] || 0))
      continue
    }

    if (method && !method.includes('Betaalwijze')) {
      const qty = parseFloat(String(Object.values(row)[1] || 0))
      if (!Number.isNaN(qty)) {
        methods.push({ method, quantity: qty })
      }
    }
  }

  return {
    methods,
    grand_total_qty: grandTotalQty,
  }
}

function mapCorrections(
  rows: Record<string, unknown>[],
  headers: string[],
): BasisReportData['sections']['corrections'] {
  const adjustments: BasisReportData['sections']['corrections']['adjustments'] = []
  let grandTotalQty = 0
  let grandTotalIncl = 0
  let grandTotalEx = 0

  for (const row of rows) {
    const user = String(Object.values(row)[0] || '').trim()

    if (user.toLowerCase() === 'grand total') {
      grandTotalQty = parseFloat(String(Object.values(row)[1] || 0))
      grandTotalIncl = parsePrice(String(Object.values(row)[2] || 0))
      grandTotalEx = parsePrice(String(Object.values(row)[3] || 0))
      continue
    }

    if (user && !user.includes('Gebruiker')) {
      const qty = parseFloat(String(Object.values(row)[1] || 0))
      const incl = parsePrice(String(Object.values(row)[2] || 0))
      const ex = parsePrice(String(Object.values(row)[3] || 0))

      if (!Number.isNaN(qty)) {
        adjustments.push({
          user,
          quantity: qty,
          price_incl_vat: incl,
          price_ex_vat: ex,
        })
      }
    }
  }

  return {
    adjustments,
    grand_total: {
      quantity: grandTotalQty,
      price_incl_vat: grandTotalIncl,
      price_ex_vat: grandTotalEx,
    },
  }
}

function mapInternalSales(
  rows: Record<string, unknown>[],
  headers: string[],
): BasisReportData['sections']['internal_sales'] {
  const staff: BasisReportData['sections']['internal_sales']['staff'] = []
  let grandTotalQty = 0
  let grandTotalIncl = 0
  let grandTotalEx = 0

  for (const row of rows) {
    const user = String(Object.values(row)[0] || '').trim()

    if (user.toLowerCase() === 'grand total') {
      grandTotalQty = parseFloat(String(Object.values(row)[1] || 0))
      grandTotalIncl = parsePrice(String(Object.values(row)[2] || 0))
      grandTotalEx = parsePrice(String(Object.values(row)[3] || 0))
      continue
    }

    if (user && !user.includes('Gebruiker')) {
      const qty = parseFloat(String(Object.values(row)[1] || 0))
      const incl = parsePrice(String(Object.values(row)[2] || 0))
      const ex = parsePrice(String(Object.values(row)[3] || 0))

      if (!Number.isNaN(qty)) {
        staff.push({
          user,
          quantity: qty,
          price_incl_vat: incl,
          price_ex_vat: ex,
        })
      }
    }
  }

  return {
    staff,
    grand_total: {
      quantity: grandTotalQty,
      price_incl_vat: grandTotalIncl,
      price_ex_vat: grandTotalEx,
    },
  }
}

function parsePrice(priceStr: string): number {
  const cleaned = String(priceStr).replace(/[€\s]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}
