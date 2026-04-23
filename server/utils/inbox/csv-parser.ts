/**
 * @registry-id: csvParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-19T00:00:00.000Z
 * @description: CSV parser with auto-delimiter detection (ported from next-js-old)
 * @last-fix: [2026-04-19] header:false keeps all array rows (incl. all-empty cells) for correct per-line row count
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 */

import Papa from 'papaparse'
import type { DocumentType, ParseResult } from '~/types/inbox'

export type CsvParseOptions = {
  delimiter?: string
  autoDetectDelimiter?: boolean
  skipEmptyLines?: boolean
  skipLines?: number
  /** When false, each physical row becomes one object with column_0…column_N (for hierarchical / preamble CSVs). */
  header?: boolean
  /** When false, keep cell values as trimmed strings (no €→number coercion). Used with header:false for Trivec exports. */
  coerceNumbers?: boolean
}

function detectDelimiter(csvText: string): string {
  const delimiters = [',', ';', '|', '\t']
  const firstLine = csvText.split('\n')[0] || ''
  let bestDelimiter = ','
  let maxFields = 0
  for (const delimiter of delimiters) {
    const fields = firstLine.split(delimiter).length
    if (fields > maxFields && fields > 1) {
      maxFields = fields
      bestDelimiter = delimiter
    }
  }
  return bestDelimiter
}

const UTF8_BOM = '\uFEFF'
const EXPORT_LEAD_IN = '\u25B2'
const EURO_LIKE = /[\u20AC\uFFFD\u0080]/g

function stripLeadingJunk(s: string): string {
  let out = s
  while (out.length > 0 && (out.startsWith(UTF8_BOM) || out.startsWith(EXPORT_LEAD_IN))) {
    out = out.startsWith(UTF8_BOM) ? out.slice(UTF8_BOM.length) : out.slice(EXPORT_LEAD_IN.length)
  }
  return out
}

const stringCellTransform = (value: string) => {
  let trimmed = value.trim()
  if (trimmed.toLowerCase().includes('excel') && trimmed.toLowerCase().includes('geen data')) {
    trimmed = trimmed.replace(/\bExcel\b/gi, 'bron')
  }
  if (trimmed === '') return null
  return trimmed
}

/** Filename-classified sales + semicolon + first non-empty line is not a standard header row → Trivec-style export. */
export function looksLikeTrivecSemicolonSales(csvText: string, filenameDocumentType: DocumentType): boolean {
  if (filenameDocumentType !== 'sales') return false
  const norm = stripLeadingJunk(csvText)
  if (detectDelimiter(norm) !== ';') return false
  const first = (norm.split(/\r?\n/).find((l) => l.trim()) || '').trim()
  if (/^(date|datum|product)\s*;/i.test(first)) return false
  return true
}

export async function parseCSV(csvText: string, options: CsvParseOptions = {}): Promise<ParseResult> {
  try {
    let normalized = stripLeadingJunk(csvText)
    if (options.skipLines != null && options.skipLines > 0) {
      const lines = normalized.split(/\r?\n/)
      normalized = lines.slice(options.skipLines).join('\n')
    }
    const delimiter =
      options.autoDetectDelimiter !== false ? detectDelimiter(normalized) : options.delimiter || ','

    const useHeader = options.header !== false
    const coerceNumbers = options.coerceNumbers !== false

    const parseConfig: Parameters<typeof Papa.parse>[1] = {
      header: useHeader,
      skipEmptyLines: options.skipEmptyLines !== false,
      delimiter,
      transform: coerceNumbers
        ? (value: string) => {
            let trimmed = value.trim()
            if (trimmed.toLowerCase().includes('excel') && trimmed.toLowerCase().includes('geen data')) {
              trimmed = trimmed.replace(/\bExcel\b/gi, 'bron')
            }
            const forNumber = trimmed.replace(EURO_LIKE, '').replace(/\s/g, '').replace(',', '.').trim()
            if (trimmed === '') return null
            if (!isNaN(Number(trimmed)) && trimmed !== '') {
              return Number(trimmed)
            }
            if (forNumber !== '' && !isNaN(Number(forNumber))) {
              return Number(forNumber)
            }
            return trimmed
          }
        : stringCellTransform,
    }
    if (useHeader) {
      parseConfig.transformHeader = (header: string, index?: number) => {
        const trimmed = header
          .replace(new RegExp(UTF8_BOM, 'g'), '')
          .replace(new RegExp(EXPORT_LEAD_IN, 'g'), '')
          .trim()
        return trimmed || `column_${index ?? 0}`
      }
    }
    const parseResult = Papa.parse(normalized, parseConfig)

    const fatalErrors = parseResult.errors.filter(
      (e) => (e as { type?: string }).type !== 'FieldMismatch',
    )
    if (fatalErrors.length > 0) {
      const errorMessages = fatalErrors.map((e) => e.message).join('; ')
      return {
        success: false,
        format: 'csv',
        headers: [],
        rows: [],
        rowCount: 0,
        error: `CSV parsing errors: ${errorMessages}`,
        metadata: { delimiter },
      }
    }

    let headers: string[]
    let rows: Record<string, unknown>[]

    if (useHeader) {
      headers = parseResult.meta.fields || []
      rows = (parseResult.data as Record<string, unknown>[]).filter((row) => Object.keys(row).length > 0)
    } else {
      const rawRows = parseResult.data as unknown[]
      let maxCols = 0
      rows = rawRows
        .filter((r) => Array.isArray(r) && (r as unknown[]).length > 0)
        .map((r) => {
          const arr = r as unknown[]
          maxCols = Math.max(maxCols, arr.length)
          const o: Record<string, unknown> = {}
          arr.forEach((cell, i) => {
            o[`column_${i}`] = cell
          })
          return o
        })
      headers = Array.from({ length: maxCols }, (_, i) => `column_${i}`)
    }

    return {
      success: true,
      format: 'csv',
      headers,
      rows,
      rowCount: rows.length,
      metadata: {
        delimiter,
      },
    }
  } catch (error) {
    return {
      success: false,
      format: 'csv',
      headers: [],
      rows: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown CSV parsing error',
    }
  }
}
