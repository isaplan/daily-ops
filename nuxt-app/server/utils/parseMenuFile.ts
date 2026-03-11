/**
 * Parse CSV, Excel, or PDF file buffer into rows (array of string[] or Record<string, unknown>).
 * Used by menu import to support wijnkaart CSV/Excel/PDF.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { parsePdfToRows } from './parsePdf'

export type ParseMenuFileResult =
  | { success: true; format: 'csv' | 'xlsx' | 'pdf'; rows: string[][]; rowCount: number }
  | { success: false; format: 'csv' | 'xlsx' | 'pdf'; error: string }

const WIJNKAART_DATA_START_ROW = 5

function parseEuro(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const s = String(value).trim().replace(/^€\s*/, '').replace(',', '.').replace(/\s/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : undefined
}

function parseNum(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const s = String(value).trim().replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parse CSV buffer. Returns rows as string[][].
 * Skips empty leading rows; caller decides which row is header/data.
 */
export function parseCsvToRows(buffer: Buffer): ParseMenuFileResult {
  const text = buffer.toString('utf-8')
  const result = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
  if (result.errors.length > 0) {
    const msg = result.errors.map((e) => e.message).join('; ')
    return { success: false, format: 'csv', error: msg }
  }
  const rows = (result.data as string[][]).filter((row) => row.some((cell) => String(cell).trim() !== ''))
  return { success: true, format: 'csv', rows, rowCount: rows.length }
}

/**
 * Parse Excel buffer. First sheet only. Returns rows as string[][].
 */
export function parseExcelToRows(buffer: Buffer): ParseMenuFileResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { success: false, format: 'xlsx', error: 'No sheet found' }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
    const nonEmpty = (rows as string[][]).filter((row) => row.some((cell) => String(cell).trim() !== ''))
    return { success: true, format: 'xlsx', rows: nonEmpty, rowCount: nonEmpty.length }
  } catch (e) {
    return {
      success: false,
      format: 'xlsx',
      error: e instanceof Error ? e.message : 'Failed to parse Excel',
    }
  }
}

/**
 * Detect wijnkaart data rows: row[col.rowNum] is numeric, row[col.type] looks like type (Witte Wijn, Rode Wijn, ...).
 */
function isWijnkaartDataRow(row: string[], index: number, col: ColMap = COL): boolean {
  if (index < WIJNKAART_DATA_START_ROW) return false
  const col1 = parseNum(row[col.rowNum])
  const col2 = String(row[col.type] ?? '').trim()
  const hasType =
    col2.includes('Wijn') ||
    col2 === 'rose' ||
    col2.toLowerCase().includes('mousserend') ||
    col2.toLowerCase().includes('mouserrend')
  return col1 !== undefined && col1 >= 0 && hasType
}

/** Column indices for wijnkaart CSV (0-based). Defaults; can be overridden by header detection. */
const COL_DEFAULT = {
  rowNum: 1,
  type: 2,
  name: 3,
  regio: 4,
  land: 5,
  jaar: 6,
  unitPrice: 7,
  costPerPieceAfterWaste: 8,
  marginMultiplier: 10,
  priceExVat: 11,
  priceIncVat: 12,
  opslag25Margin: 18,
  opslag25Net: 19,
  opslag30Margin: 20,
  opslag30Net: 21,
} as const

type ColMap = Record<keyof typeof COL_DEFAULT, number>

/**
 * Detect column indices from a header row (one of the first rows). Handles Excel/CSV where
 * the first column might be missing or columns are in a different order.
 */
function detectColumns(rows: string[][]): ColMap {
  const col: ColMap = { ...COL_DEFAULT }
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r]
    if (!row || row.length < 8) continue
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').toLowerCase()
      if (cell.trim() === 'type') col.type = c
      if (cell.includes('product') || cell.includes('kinsbergen')) col.name = c
      if (cell.includes('regio')) col.regio = c
      if (cell === 'land' || cell.trim() === 'land') col.land = c
      if (cell === 'jaar' || cell.trim() === 'jaar') col.jaar = c
      if (cell.includes('eenheid') && cell.includes('prijs')) col.unitPrice = c
      if (cell.includes('kostprijs') && cell.includes('stuk')) col.costPerPieceAfterWaste = c
      if (cell.includes('netto') && cell.includes('marge')) col.marginMultiplier = c + 1
      if (cell.includes('netto') && cell.includes('kaartprijs')) col.priceExVat = c
      if (cell.includes('bruto') && cell.includes('kaartprijs')) col.priceIncVat = c
    }
    if (col.priceExVat !== COL_DEFAULT.priceExVat || col.priceIncVat !== COL_DEFAULT.priceIncVat) break
  }
  return col
}

const COL = COL_DEFAULT

export type MappedMenuItem = {
  name: string
  subType?: string
  regio?: string
  land?: string
  jaar?: string
  sortOrder?: number
  calculationMethod: 'opslag'
  type: 'wine'
  vatRate: 21
  alcohol: true
  unitPrice?: number
  costPerPieceAfterWaste?: number
  targetMarginMultiplier?: number
  priceExVat?: number
  priceIncVat?: number
  opslagScenarios?: Array<{ label: string; marginMultiplier?: number; calculatedNetPrice?: number }>
}

/**
 * Map a wijnkaart data row (string[]) to a menu item for upsert.
 */
export function mapWijnkaartRowToItem(
  row: string[],
  rowIndex: number,
  col: ColMap = COL
): MappedMenuItem | null {
  const name = String(row[col.name] ?? '').trim().replace(/^"+|"+$/g, '')
  if (!name) return null

  const subType = String(row[col.type] ?? '').trim() || undefined
  const regio = String(row[col.regio] ?? '').trim() || undefined
  const land = String(row[col.land] ?? '').trim() || undefined
  const jaar = String(row[col.jaar] ?? '').trim() || undefined
  const sortOrder = parseNum(row[col.rowNum])
  const unitPrice = parseEuro(row[col.unitPrice])
  const costPerPieceAfterWaste = parseEuro(row[col.costPerPieceAfterWaste])
  const targetMarginMultiplier = parseNum(row[col.marginMultiplier])
  const priceExVat = parseEuro(row[col.priceExVat])
  const priceIncVat = parseEuro(row[col.priceIncVat])

  const opslagScenarios: MappedMenuItem['opslagScenarios'] = []
  const m25 = parseNum(row[col.opslag25Margin])
  const n25 = parseEuro(row[col.opslag25Net])
  if (m25 !== undefined || n25 !== undefined) {
    opslagScenarios.push({ label: '25%', marginMultiplier: m25, calculatedNetPrice: n25 })
  }
  const m30 = parseNum(row[col.opslag30Margin])
  const n30 = parseEuro(row[col.opslag30Net])
  if (m30 !== undefined || n30 !== undefined) {
    opslagScenarios.push({ label: '30%', marginMultiplier: m30, calculatedNetPrice: n30 })
  }

  return {
    name,
    subType,
    regio,
    land,
    jaar,
    sortOrder: sortOrder ?? rowIndex,
    calculationMethod: 'opslag',
    type: 'wine',
    vatRate: 21,
    alcohol: true,
    unitPrice,
    costPerPieceAfterWaste,
    targetMarginMultiplier,
    priceExVat,
    priceIncVat,
    opslagScenarios: opslagScenarios.length ? opslagScenarios : undefined,
  }
}

/**
 * Extract wijnkaart data rows from parsed rows and map to menu items.
 * Detects column indices from header rows so Netto/Bruto Kaartprijs are found even if column order differs.
 */
export function extractWijnkaartItems(rows: string[][]): { items: MappedMenuItem[]; errors: Array<{ row: number; error: string }> } {
  const items: MappedMenuItem[] = []
  const errors: Array<{ row: number; error: string }> = []
  const col = detectColumns(rows)
  for (let i = 0; i < rows.length; i++) {
    if (!isWijnkaartDataRow(rows[i], i, col)) continue
    const row = rows[i]
    const name = String(row[col.name] ?? '').trim().replace(/^"+|"+$/g, '')
    if (!name || name.toLowerCase() === 'gemiddeld') {
      if (name.toLowerCase() === 'gemiddeld') continue
      errors.push({ row: i + 1, error: 'Missing product name' })
      continue
    }
    const item = mapWijnkaartRowToItem(row, i + 1, col)
    if (item) items.push(item)
  }
  return { items, errors }
}

/**
 * Parse a menu file (CSV, Excel, or PDF) into rows.
 * Dispatches to the appropriate parser based on filename extension.
 */
export async function parseMenuFileToRows(
  buffer: Buffer,
  filename: string
): Promise<ParseMenuFileResult> {
  const lower = filename.toLowerCase()
  const isPdf = lower.endsWith('.pdf')
  const isCsv = lower.endsWith('.csv')
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls')

  if (isCsv) {
    const result = parseCsvToRows(buffer)
    return result
  }

  if (isExcel) {
    const result = parseExcelToRows(buffer)
    return result
  }

  if (isPdf) {
    const result = await parsePdfToRows(buffer)
    if (result.success) {
      return { success: true, format: 'pdf', rows: result.rows, rowCount: result.rowCount }
    } else {
      return { success: false, format: 'pdf', error: result.error }
    }
  }

  return {
    success: false,
    format: 'csv',
    error: `Unsupported format: ${filename}. Supported: CSV, Excel (.xlsx, .xls), PDF (.pdf)`,
  }
}
