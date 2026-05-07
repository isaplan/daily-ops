/**
 * Basis Report Mapper — Transform parsed XLSX data into structured sales format
 * Handles: Netto Sales, Betalingen, Correcties, Interne Verkoop
 * Preserves: Inc VAT, Ex VAT prices
 */

import type { ParseResult } from '~/types/inbox'
import {
  extractLocationFromBasisSpreadsheet,
  matchVenueLocationFromText,
} from './basis-report-location'

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
    /** Stable upsert key — one inbox attachment maps to one basis report row */
    source_attachment_id?: string
    source_email_id?: string
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
    attachmentId?: string
  },
  db?: any,
): Promise<BasisReportData | null> {
  if (!parseResult.success || parseResult.rows.length === 0) {
    return null
  }

  const rows = parseResult.rows as Record<string, unknown>[]
  let subject = emailData?.subject
  if (!subject && db && emailData?.emailId) {
    try {
      const { ObjectId } = await import('mongodb')
      const email = await db.collection('inboxemails').findOne({ _id: new ObjectId(emailData.emailId) })
      subject = email?.subject
    } catch {}
  }

  const dateFromSubject = extractDateFromSubject(subject) || ''
  const locationFromSubject = matchVenueLocationFromText(subject ?? '') || ''
  const dateFromMetadata = String((parseResult.metadata as Record<string, unknown>)?.extracted_date || '')
  const locationFromMetadata = String((parseResult.metadata as Record<string, unknown>)?.extracted_location || '')

  const dateStr = dateFromSubject || dateFromMetadata || extractDateFromFile(rows) || ''
  const locationRaw =
    locationFromSubject ||
    (locationFromMetadata && locationFromMetadata !== 'undefined' ? locationFromMetadata : '') ||
    extractLocationFromBasisSpreadsheet(rows, fileName) ||
    ''

  let locationId: string | undefined
  if (db && locationRaw && locationRaw !== 'Unknown' && locationRaw !== 'Unspecified') {
    try {
      const locDoc = await db.collection('unified_location').findOne({
        $or: [
          { name: locationRaw },
          { primaryName: locationRaw },
          { canonicalName: locationRaw },
          { abbreviation: locationRaw },
          { 'borkMapping.borkLocationName': locationRaw },
        ],
      })
      if (locDoc) {
        locationId = String(locDoc._id)
      }
    } catch (err) {
      // Fail silently
    }
  }
  
  /** Prefer Bork batch hour from subject (`Daily Report Sales 23:00 …`) — matches ops labels; Gmail arrival can be ~1h earlier. */
  const batchHourFromSubject = extractBatchHourFromSubject(subject)
  const receivedRaw = emailData?.receivedAt
  const receivedDate =
    receivedRaw instanceof Date
      ? receivedRaw
      : receivedRaw != null
        ? new Date(String(receivedRaw as string))
        : undefined
  const amsterdamWallHour =
    receivedDate && !Number.isNaN(receivedDate.getTime()) ? getAmsterdamWallHour(receivedDate) : undefined
  const cronHour = batchHourFromSubject ?? amsterdamWallHour
  const businessHour =
    cronHour !== undefined ? (cronHour - 8 + 24) % 24 : undefined

  // Parse sections from rows
  const sections: BasisReportData['sections'] = {}
  
  // Identify section boundaries by looking for section header KEYWORDS
  const sectionMarkers: Array<{ keyword: string; sectionType: string; rowIdx: number }> = []
  
  for (let i = 0; i < rows.length; i++) {
    const rowStr = Object.values(rows[i]).map(v => String(v || '').toLowerCase()).join(' ')
    if (rowStr.includes('betalingen') || rowStr.includes('betaalwijze')) {
      if (!sectionMarkers.find(m => m.sectionType === 'payments')) {
        sectionMarkers.push({ keyword: 'betalingen', sectionType: 'payments', rowIdx: i })
      }
    } else if (rowStr.includes('correctie')) {
      if (!sectionMarkers.find(m => m.sectionType === 'corrections')) {
        sectionMarkers.push({ keyword: 'correcties', sectionType: 'corrections', rowIdx: i })
      }
    } else if (rowStr.includes('interne') && rowStr.includes('verkoop')) {
      if (!sectionMarkers.find(m => m.sectionType === 'internal_sales')) {
        sectionMarkers.push({ keyword: 'interne verkoop', sectionType: 'internal_sales', rowIdx: i })
      }
    }
  }
  
  // Sort by row index
  sectionMarkers.sort((a, b) => a.rowIdx - b.rowIdx)
  
  // Extract section data: 
  // - Netto sales: from row 0 to first section marker
  // - Other sections: from their marker+1 to next marker
  const getRowsForSection = (startIdx: number, endIdx: number): Record<string, unknown>[] => {
    if (startIdx >= endIdx || startIdx < 0) return []
    const result = rows.slice(startIdx, endIdx).filter(row => {
      // Skip only section header rows (betalingen, correctie, etc), not data rows
      // Keep grand total / totaal rows - they are data!
      const rowStr = Object.values(row).map(v => String(v || '').toLowerCase()).join(' ')
      const isSectionHeader = ['betalingen', 'betaalwijze', 'correctie', 'interne', 'verkoop'].some(kw => rowStr.includes(kw))
      return !isSectionHeader && Object.values(row).some(v => v)
    })
    return result
  }
  
  // Netto sales: from start to first section marker
  const nettoEndIdx = sectionMarkers.length > 0 ? sectionMarkers[0].rowIdx : rows.length
  const nettoData = getRowsForSection(0, nettoEndIdx)
  if (nettoData.length > 0) {
    sections.netto_sales = mapNettoSales(nettoData, parseResult.headers)
  }
  
  // Payments: between "betalingen" and next section
  const paymentMarker = sectionMarkers.find(m => m.sectionType === 'payments')
  if (paymentMarker) {
    const paymentEndIdx = sectionMarkers.find(m => m.rowIdx > paymentMarker.rowIdx)?.rowIdx ?? rows.length
    const paymentData = getRowsForSection(paymentMarker.rowIdx + 1, paymentEndIdx)
    if (paymentData.length > 0) {
      sections.payments = mapPayments(paymentData)
    }
  }
  
  // Corrections: between "correcties" and next section
  const correctionMarker = sectionMarkers.find(m => m.sectionType === 'corrections')
  if (correctionMarker) {
    const correctionEndIdx = sectionMarkers.find(m => m.rowIdx > correctionMarker.rowIdx)?.rowIdx ?? rows.length
    const correctionData = getRowsForSection(correctionMarker.rowIdx + 1, correctionEndIdx)
    if (correctionData.length > 0) {
      sections.corrections = mapCorrections(correctionData, parseResult.headers)
    }
  }
  
  // Internal sales: between "interne verkoop" and end
  const internalMarker = sectionMarkers.find(m => m.sectionType === 'internal_sales')
  if (internalMarker) {
    const internalData = getRowsForSection(internalMarker.rowIdx + 1, rows.length)
    if (internalData.length > 0) {
      sections.internal_sales = mapInternalSales(internalData, parseResult.headers)
    }
  }

  // Normalize user names if database available
  if (db) {
    if (sections.corrections?.adjustments) {
      await normalizeUserNames(sections.corrections.adjustments, db)
    }
    if (sections.internal_sales?.staff) {
      await normalizeUserNames(sections.internal_sales.staff, db)
    }
  }

  // Calculate final revenue: use Netto Sales Grand Total as the authoritative revenue
  // (Corrections and Internal Sales are detailed line items, not adjustments to final revenue)
  const finalRevenueIncl = sections.netto_sales?.grand_total?.price_incl_vat || 0
  const finalRevenueEx = sections.netto_sales?.grand_total?.price_ex_vat || 0

  return {
    date: dateStr || 'UNKNOWN',
    location: locationRaw || 'Unspecified',
    location_id: locationId,
    location_raw: locationRaw,
    cron_hour: cronHour,
    business_hour: businessHour,
    received_at: emailData?.receivedAt,
    sections,
    final_revenue_incl_vat: finalRevenueIncl,
    final_revenue_ex_vat: finalRevenueEx,
    metadata: {
      email_subject: subject,
      attachment_filename: fileName,
      parsed_at: new Date(),
      ...(emailData?.attachmentId ? { source_attachment_id: emailData.attachmentId } : {}),
      ...(emailData?.emailId ? { source_email_id: emailData.emailId } : {}),
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
          const [, d, m, y] = match
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
        const matchSingle = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (matchSingle) {
          const [, d, m, y] = matchSingle
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
      }
    }
  }
  return new Date().toISOString().split('T')[0]
}

function mapNettoSales(
  rows: Record<string, unknown>[],
  headers: string[],
): BasisReportData['sections']['netto_sales'] {
  if (rows.length === 0) {
    return { categories: [], grand_total: { quantity: 0, price_incl_vat: 0, price_ex_vat: 0 } }
  }

  const categories: BasisReportData['sections']['netto_sales']['categories'] = []
  let grandTotalQty = 0
  let grandTotalIncl = 0
  let grandTotalEx = 0

  for (const row of rows) {
    // Get product name from Groep1 or similar (first non-null named column)
    const nameVal = row['Groep1'] || row['Product'] || row['Naam'] || ''
    const nameStr = String(nameVal || '').trim()

    // Match both "Grand Total" and "Algemeen totaal" (Dutch for General Total)
    // Also check lowercase
    const isGrandTotal = nameStr.toLowerCase().includes('grand total') 
      || nameStr.toLowerCase().includes('totaal') 
      || nameStr.toLowerCase().includes('algemeen')
      || nameStr.toLowerCase().includes('total')
    
    if (isGrandTotal) {
      const qty = String(row['Hoeveelheid'] || row['Quantity'] || 0).trim()
      const incl = String(row['Totale prijs'] || row['Total Price'] || 0).trim()
      const ex = String(row['Ex BTW'] || row['Ex VAT'] || 0).trim()
      
      grandTotalQty = parseFloat(qty)
      grandTotalIncl = parsePrice(incl)
      grandTotalEx = parsePrice(ex)
      
      continue
    }

    if (nameStr && !nameStr.toLowerCase().includes('groep')) {
      const qty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      const incl = parsePrice(String(row['Totale prijs'] || row['Total Price'] || 0))
      const ex = parsePrice(String(row['Ex BTW'] || row['Ex VAT'] || 0))

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
    const method = String(row['Betaalwijze'] || row['Method'] || row[Object.keys(row)[0]] || '').trim()

    if (method.toLowerCase() === 'grand total' || method.toLowerCase().includes('totaal')) {
      grandTotalQty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      continue
    }

    if (method && !method.includes('Betaalwijze')) {
      const qty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
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
    const user = String(row['Gebruiker'] || row['User'] || row[Object.keys(row)[0]] || '').trim()

    if (user.toLowerCase() === 'grand total' || user.toLowerCase().includes('totaal')) {
      grandTotalQty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      grandTotalIncl = parsePrice(String(row['Totale prijs'] || row['Total Price'] || 0))
      grandTotalEx = parsePrice(String(row['Ex BTW'] || row['Ex VAT'] || 0))
      continue
    }

    if (user && !user.includes('Gebruiker')) {
      const qty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      const incl = parsePrice(String(row['Totale prijs'] || row['Total Price'] || 0))
      const ex = parsePrice(String(row['Ex BTW'] || row['Ex VAT'] || 0))

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
    const user = String(row['Gebruiker'] || row['User'] || row[Object.keys(row)[0]] || '').trim()

    if (user.toLowerCase() === 'grand total' || user.toLowerCase().includes('totaal')) {
      grandTotalQty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      grandTotalIncl = parsePrice(String(row['Totale prijs'] || row['Total Price'] || 0))
      grandTotalEx = parsePrice(String(row['Ex BTW'] || row['Ex VAT'] || 0))
      continue
    }

    if (user && !user.includes('Gebruiker')) {
      const qty = parseFloat(String(row['Hoeveelheid'] || row['Quantity'] || 0))
      const incl = parsePrice(String(row['Totale prijs'] || row['Total Price'] || 0))
      const ex = parsePrice(String(row['Ex BTW'] || row['Ex VAT'] || 0))

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
    const [, d, m, y] = match
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

/** e.g. `Daily Report Sales18:00 Kinsbergen` or `Daily Report Sales 23:00 lAmour…` — hour is **local NL / report batch**, not UTC */
function extractBatchHourFromSubject(subject?: string): number | undefined {
  if (!subject) return undefined
  const patterns = [/Daily Report Sales\s*(\d{1,2}):(\d{2})\b/i, /Daily Sales Report\s+(\d{1,2}):(\d{2})\b/i]
  for (const re of patterns) {
    const m = subject.match(re)
    if (m) {
      const h = parseInt(m[1], 10)
      if (Number.isFinite(h) && h >= 0 && h <= 23) return h
    }
  }
  return undefined
}

/** Hour 0–23 on the Europe/Amsterdam civil clock (CEST/CET). */
function getAmsterdamWallHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const n = parseInt(h, 10)
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0
}
