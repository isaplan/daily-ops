/**
 * @registry-id: inboxSalesRowCanonical
 * @created: 2026-04-23T00:00:00.000Z
 * @last-modified: 2026-04-23T00:00:00.000Z
 * @description: Canonical field names + BSON date for inbox-bork-sales (reportDate API filters on `date`)
 * @last-fix: [2026-04-23] Align Trivec / CSV column aliases with inbox import table + Mongo $dateToString filter
 *
 * @exports-to:
 * ✓ server/utils/inbox/trivec-sales-csv.ts
 * ✓ server/services/rawDataStorageService.ts
 */

const EURO_SNIP = /[\u20AC\uFFFD\u0080]/g

/** DD/MM/YYYY → noon UTC so Europe/Amsterdam calendar day stays stable in $dateToString. */
export function parseDdMmYyyyToNoonUtc(ddmmyyyy: string): Date | null {
  const m = String(ddmmyyyy).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = Number.parseInt(m[1], 10)
  const month = Number.parseInt(m[2], 10)
  const year = Number.parseInt(m[3], 10)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

export function parseYmdToNoonUtc(ymd: string): Date | null {
  const m = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number.parseInt(m[1], 10)
  const month = Number.parseInt(m[2], 10)
  const day = Number.parseInt(m[3], 10)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

export function parseEuroInbox(s: string | number | null | undefined): number {
  if (s == null) return 0
  if (typeof s === 'number') return Number.isNaN(s) ? 0 : s
  const str = String(s).trim()
  if (!str) return 0
  let cleaned = str.replace(EURO_SNIP, '').replace(/\s/g, '').trim()
  if (cleaned.toLowerCase().includes('n.v.t')) return 0
  cleaned = cleaned.replace(',', '.')
  const num = Number(cleaned)
  return Number.isNaN(num) ? 0 : num
}

/**
 * Ensures `date` is a BSON Date for `inboxImportTableQuery` reportDate filter; merges common CSV header aliases.
 */
export function canonicalInboxSalesRow(row: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...row }

  if (o.date instanceof Date && !Number.isNaN(o.date.getTime())) {
    // already correct type
  } else {
    const fromDdMm =
      typeof o.date === 'string' ? parseDdMmYyyyToNoonUtc(o.date) : null
    if (fromDdMm) o.date = fromDdMm
    else if (typeof o.date === 'string') {
      const ymd = parseYmdToNoonUtc(o.date)
      if (ymd) o.date = ymd
    }

    if (!(o.date instanceof Date) || Number.isNaN((o.date as Date).getTime())) {
      const capDate = o.Date != null ? String(o.Date).trim() : ''
      const datum = o.Datum != null ? String(o.Datum).trim() : ''
      const parsed = parseDdMmYyyyToNoonUtc(capDate || datum)
      if (parsed) o.date = parsed
    }
  }

  delete o.Date
  delete o.Datum

  if (o.product_name == null && o.Product != null) o.product_name = o.Product
  if (o.product_name == null && o.Productnaam != null) o.product_name = o.Productnaam
  delete o.Product
  delete o.Productnaam

  if (o.revenue == null && o.Revenue != null) {
    o.revenue = typeof o.Revenue === 'number' ? o.Revenue : parseEuroInbox(o.Revenue as string)
  }
  delete o.Revenue
  if (o.revenue == null && o.Omzet != null) {
    o.revenue = typeof o.Omzet === 'number' ? o.Omzet : parseEuroInbox(o.Omzet as string)
  }
  delete o.Omzet

  if (o.quantity == null && o.Quantity != null) o.quantity = Number(o.Quantity) || 0
  delete o.Quantity
  if (o.quantity == null && o.Aantal != null) o.quantity = Number(o.Aantal) || 0
  delete o.Aantal

  return o
}
