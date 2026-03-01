/**
 * Header-based CSV dump: find a header row, map every data row to an object by header name.
 * Used for multi-tab product CSVs (rum, whiskey, cocktail, koffie, bier, etc.).
 */

import Papa from 'papaparse'

const HEADER_KEYWORDS = [
  '#',
  'type',
  'product',
  'kinsbergen',
  'prijs',
  'netto',
  'bruto',
  'kostprijs',
  'eenheid',
  'status',
  'leverancier',
  'inkoop',
  'verkoop',
  'marge',
  'waste',
  'regio',
  'land',
  'jaar',
  'calculatie',
  'opslag',
]

function normalizeHeader(cell: string): string {
  return String(cell ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
}

/** Must have at least one cell that is clearly a column name (Type, Product, #), not a value like "Inkoop Prijs" */
function hasProductOrTypeHeaderCell(row: string[]): boolean {
  const productTypeCells = ['#', 'type', 'product', 'status', 'leverancier']
  for (const cell of row) {
    const n = String(cell ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!n) continue
    if (productTypeCells.includes(n)) return true
    if (n.includes('kinsbergen') || n === 'product kinsbergen') return true
    if (n.startsWith('type') && n.length <= 15) return true
  }
  return false
}

function looksLikeHeaderRow(row: string[]): boolean {
  const joined = row.map((c) => String(c).toLowerCase()).join(' ')
  const matchCount = HEADER_KEYWORDS.filter((kw) => joined.includes(kw)).length
  const nonEmpty = row.filter((c) => String(c).trim() !== '').length
  return nonEmpty >= 2 && matchCount >= 1 && hasProductOrTypeHeaderCell(row)
}

/**
 * Parse CSV buffer. Tries comma first, then semicolon if first row has only one column.
 */
export function parseCsvToRows(buffer: Buffer): string[][] {
  const text = buffer.toString('utf-8')
  let result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
  const firstRow = (result.data as string[][])[0]
  if (firstRow && firstRow.length <= 1 && text.includes(';')) {
    result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false, delimiter: ';' })
  }
  const rows = (result.data as string[][]).filter((row) => row.some((cell) => String(cell).trim() !== ''))
  return rows
}

/**
 * Find the first row that looks like a header (contains Type, Product, Prijs, etc.).
 * Returns header row index and normalized header keys. If none found, use col0, col1, ...
 */
export function detectHeaderRow(rows: string[][]): { headerIndex: number; headers: string[] } {
  const maxCols = Math.max(...rows.map((r) => r.length), 1)
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    if (looksLikeHeaderRow(row)) {
      const headers: string[] = []
      const seen = new Map<string, number>()
      for (let c = 0; c < Math.max(row.length, maxCols); c++) {
        const raw = normalizeHeader(row[c] ?? '')
        const key = raw || `col${c}`
        const count = seen.get(key) ?? 0
        seen.set(key, count + 1)
        const finalKey = count === 0 ? key : `${key}_${count}`
        headers.push(finalKey)
      }
      return { headerIndex: i, headers }
    }
  }
  const headers = Array.from({ length: maxCols }, (_, c) => `col${c}`)
  return { headerIndex: 0, headers }
}

/**
 * Build a data object from a row using header keys by index.
 */
export function rowToData(row: string[], headers: string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < Math.max(row.length, headers.length); i++) {
    const key = headers[i] ?? `col${i}`
    const raw = row[i]
    const val = raw === undefined || raw === null ? '' : String(raw).trim()
    if (key.startsWith('col') && val === '') continue
    data[key] = val === '' ? undefined : val
  }
  return data
}

/**
 * Derive product group slug from filename (e.g. "rum_info-Tabel 1.csv" -> "rum", "cocktail calculaties-Tabel 1.csv" -> "cocktail").
 */
export function productGroupFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '').replace(/\s*-\s*Tabel\s*\d+\s*$/i, '').trim()
  const lower = base.toLowerCase()
  if (lower.includes('rum')) return 'rum'
  if (lower.includes('whiskey') || lower.includes('whisky')) return 'whiskey'
  if (lower.includes('wijnkaart') && lower.includes('fles')) return 'wine_bottle'
  if (lower.includes('wijnkaart') || lower.includes('wijn_calculatie')) return 'wine'
  if (lower.includes('cocktail')) return 'cocktail'
  if (lower.includes('koffie') || lower.includes('thee')) return 'coffee_tea'
  if (lower.includes('fris') || lower.includes('siroop')) return 'soft'
  if (lower.includes('sterk')) return 'spirit'
  if (lower.includes('wijn') && lower.includes('glas')) return 'wine_glass'
  if (lower.includes('bier')) return 'beer'
  return base.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_') || 'other'
}

export type DumpRow = {
  productGroup: string
  sourceFile: string
  rowIndex: number
  data: Record<string, unknown>
}

/**
 * Parse CSV and return dump rows: header-based mapping, one object per data row.
 */
export function extractDumpRows(rows: string[][], sourceFile: string, productGroup: string): DumpRow[] {
  const { headerIndex, headers } = detectHeaderRow(rows)
  const result: DumpRow[] = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    const data = rowToData(row ?? [], headers)
    const hasAny = Object.values(data).some((v) => v !== undefined && v !== '')
    if (!hasAny) continue
    result.push({
      productGroup,
      sourceFile,
      rowIndex: i + 1,
      data,
    })
  }
  return result
}
