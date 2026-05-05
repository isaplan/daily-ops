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
    return null
  }

  const rows = parseResult.rows as Record<string, unknown>[]
  const headers = parseResult.headers || []

  // Extract date from first few rows (typically row 0 contains date range)
  const dateStr = extractDateFromFile(rows)
  const location = extractLocationFromFile(rows, fileName)

  const data: BasisReportData = {
    date: dateStr,
    location,
    sections: {},
    final_revenue_incl_vat: 0,
    final_revenue_ex_vat: 0,
  }

  // Parse sections by identifying section headers
  let currentSection: string | null = null
  const sections: Record<string, Record<string, unknown>[]> = {
    netto_sales: [],
    payments: [],
    corrections: [],
    internal_sales: [],
  }

  for (const row of rows) {
    const firstCol = Object.values(row)[0] as string | number | undefined
    const firstColStr = String(firstCol).toLowerCase().trim()

    // Detect section headers
    if (firstColStr.includes('netto sales') || firstColStr.includes('netto')) {
      currentSection = 'netto_sales'
      continue
    }
    if (firstColStr.includes('betalingen') || firstColStr.includes('payment')) {
      currentSection = 'payments'
      continue
    }
    if (firstColStr.includes('correcties') || firstColStr.includes('correction')) {
      currentSection = 'corrections'
      continue
    }
    if (firstColStr.includes('interne verkoop') || firstColStr.includes('internal')) {
      currentSection = 'internal_sales'
      continue
    }

    // Skip headers and section labels
    if (firstColStr.includes('grand total') && currentSection) {
      continue
    }
    if (firstColStr.includes('groep') || firstColStr.includes('betaalwijze') || firstColStr.includes('gebruiker')) {
      continue
    }

    // Add data rows to current section
    if (currentSection && Object.keys(row).length > 0) {
      sections[currentSection].push(row)
    }
  }

  // Map each section
  if (sections.netto_sales.length > 0) {
    data.sections.netto_sales = mapNettoSales(sections.netto_sales, headers)
  }

  if (sections.payments.length > 0) {
    data.sections.payments = mapPayments(sections.payments)
  }

  if (sections.corrections.length > 0) {
    data.sections.corrections = mapCorrections(sections.corrections, headers)
  }

  if (sections.internal_sales.length > 0) {
    data.sections.internal_sales = mapInternalSales(sections.internal_sales, headers)
  }

  // Calculate final revenue (use netto_sales grand total if available)
  if (data.sections.netto_sales?.grand_total) {
    data.final_revenue_incl_vat = data.sections.netto_sales.grand_total.price_incl_vat
    data.final_revenue_ex_vat = data.sections.netto_sales.grand_total.price_ex_vat
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
  const categories: BasisReportData['sections']['netto_sales']['categories'] = []
  let grandTotalQty = 0
  let grandTotalIncl = 0
  let grandTotalEx = 0

  for (const row of rows) {
    const name = String(Object.values(row)[0] || '').trim()

    if (name.toLowerCase() === 'grand total') {
      const qty = parseFloat(String(Object.values(row)[1] || 0))
      const incl = parsePrice(String(Object.values(row)[2] || 0))
      const ex = parsePrice(String(Object.values(row)[3] || 0))
      grandTotalQty = qty
      grandTotalIncl = incl
      grandTotalEx = ex
      continue
    }

    if (name && !name.includes('Groep')) {
      const qty = parseFloat(String(Object.values(row)[1] || 0))
      const incl = parsePrice(String(Object.values(row)[2] || 0))
      const ex = parsePrice(String(Object.values(row)[3] || 0))

      if (!Number.isNaN(qty)) {
        categories.push({
          name,
          quantity: qty,
          price_incl_vat: incl,
          price_ex_vat: ex,
        })
      }
    }
  }

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
