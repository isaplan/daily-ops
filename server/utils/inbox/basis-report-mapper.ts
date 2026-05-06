/**
 * Basis Report Mapper — Transform parsed XLSX data into structured sales format
 * Handles: Netto Sales, Betalingen, Correcties, Interne Verkoop
 * Preserves: Inc VAT, Ex VAT prices
 */

import type { ParseResult } from '~/types/inbox'

export type BasisReportData = {
  date: string
  location: string
  location_id?: string
  location_raw?: string
  
  cron_hour?: number
  business_hour?: number
  received_at?: Date
  
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
        user_id?: string
        user_raw?: string
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
        user_id?: string
        user_raw?: string
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
  
  metadata?: {
    email_subject?: string
    attachment_filename?: string
    parsed_at?: Date
    errors?: string[]
  }
}

export async function mapBasisReportXLSX(
  parseResult: ParseResult,
  fileName: string,
  emailData?: {
    subject?: string
    receivedAt?: Date
    messageId?: string
    emailId?: string
  },
  db?: any,
): Promise<BasisReportData | null> {
  if (!parseResult.success || parseResult.rows.length === 0) {
    return null
  }

  const rows = parseResult.rows as Record<string, unknown>[]

  // Extract from email subject (NOW WORKS since we're passing it correctly)
  let dateStr = ''
  let locationRaw = ''
  
  console.error('[mapper] emailData.subject:', emailData?.subject)
  if (emailData?.subject) {
    const dateMatch = emailData.subject.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (dateMatch) {
      const [, m, d, y] = dateMatch
      dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      console.error('[mapper] ✓ Extracted date:', dateStr)
    }
    
    const locations = ['Barbea', 'Bea', 'Kinsbergen', "l'Amour", 'lAmour', 'Bar Bea']
    for (const loc of locations) {
      if (emailData.subject.includes(loc)) {
        locationRaw = loc
        console.error('[mapper] ✓ Extracted location:', loc)
        break
      }
    }
  }
  
  // Fallback to file parsing if subject extraction didn't work
  if (!dateStr) dateStr = extractDateFromFile(rows) || ''
  if (!locationRaw) locationRaw = extractLocationFromFile(rows, fileName) || ''
  
  // Normalize location
  let locationId: string | undefined
  if (db && locationRaw && locationRaw !== 'Unknown') {
    const locDoc = await db.collection('unified_location').findOne({ 
      $or: [
        { name: locationRaw },
        { primaryName: locationRaw },
        { 'borkMapping.borkLocationName': locationRaw }
      ]
    })
    if (locDoc) {
      locationId = String(locDoc._id)
    }
  }
  
  // Calculate business hour from email received time
  let businessHour: number | undefined
  let cronHour: number | undefined
  if (emailData?.receivedAt) {
    const amsterdamHour = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(emailData.receivedAt).find(p => p.type === 'hour')?.value
    if (amsterdamHour) {
      cronHour = parseInt(amsterdamHour, 10)
      businessHour = (parseInt(amsterdamHour, 10) - 8 + 24) % 24
    }
  }

  // FOR NOW: RETURN HARDCODED TEST DATA TO VERIFY END-TO-END FLOW
  // UPDATED 2026-05-06 00:14
  return {
    date: '2026-05-04',
    location: 'Barbea',
    location_id: undefined,
    location_raw: 'Barbea',
    cron_hour: 8,
    business_hour: 0,
    received_at: emailData?.receivedAt,
    sections: {},
    final_revenue_incl_vat: 12345.67,
    final_revenue_ex_vat: 10203.01,
    metadata: {
      email_subject: emailData?.subject || 'UNKNOWN',
      attachment_filename: fileName,
      parsed_at: new Date(),
    }
  }
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

async function normalizeUserNames(
  items: Array<{ user?: string; user_raw?: string; user_id?: string }>,
  db: any,
): Promise<void> {
  for (const item of items) {
    if (!item.user) continue
    
    item.user_raw = item.user
    
    try {
      const userDoc = await db.collection('unified_user').findOne({
        $or: [
          { primaryName: item.user },
          { canonicalName: item.user },
          { 'eitjeNames': item.user },
          { 'allIds.name': item.user }
        ]
      })
      if (userDoc) {
        item.user_id = String(userDoc._id)
        item.user = userDoc.canonicalName || userDoc.primaryName
      }
    } catch (e) {
      console.warn('[normalizeUserNames] Failed to normalize:', item.user, e)
    }
  }
}

function extractDateFromSubject(subject?: string): string | null {
  if (!subject) return null
  
  // Match patterns like "04/05/2026" or "4/5/2026"
  const match = subject.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    const [, m, d, y] = match
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

function extractLocationFromSubject(subject?: string): string | null {
  if (!subject) return null
  
  // Match location names in subject (e.g., "Daily Report Sales Yesterday Barbea")
  const locations = ['Barbea', 'Bea', 'Kinsbergen', "l'Amour", 'lAmour', 'Bar Bea']
  for (const loc of locations) {
    if (subject.includes(loc)) return loc
  }
  return null
}
