/**
 * @registry-id: csvParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: CSV parser with auto-delimiter detection (ported from next-js-old)
 * @last-fix: [2026-04-18] Nuxt server path imports
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 */

import Papa from 'papaparse'
import type { ParseResult } from '~/types/inbox'

export type CsvParseOptions = {
  delimiter?: string
  autoDetectDelimiter?: boolean
  skipEmptyLines?: boolean
  skipLines?: number
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

export async function parseCSV(csvText: string, options: CsvParseOptions = {}): Promise<ParseResult> {
  try {
    let normalized = stripLeadingJunk(csvText)
    if (options.skipLines != null && options.skipLines > 0) {
      const lines = normalized.split(/\r?\n/)
      normalized = lines.slice(options.skipLines).join('\n')
    }
    const delimiter =
      options.autoDetectDelimiter !== false ? detectDelimiter(normalized) : options.delimiter || ','

    const parseResult = Papa.parse(normalized, {
      header: true,
      skipEmptyLines: options.skipEmptyLines !== false,
      delimiter,
      transformHeader: (header: string, index?: number) => {
        const trimmed = header
          .replace(new RegExp(UTF8_BOM, 'g'), '')
          .replace(new RegExp(EXPORT_LEAD_IN, 'g'), '')
          .trim()
        return trimmed || `column_${index ?? 0}`
      },
      transform: (value: string) => {
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
      },
    })

    const headers = parseResult.meta.fields || []
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
    const rows = (parseResult.data as Record<string, unknown>[]).filter(
      (row) => Object.keys(row).length > 0,
    )

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
