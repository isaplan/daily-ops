/**
 * @registry-id: csvParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: CSV parser with auto-delimiter detection using PapaParse
 * @last-fix: [2026-01-26] Initial implementation with auto-delimiter detection
 * 
 * @imports-from:
 *   - papaparse => CSV parsing library
 * 
 * @exports-to:
 *   ✓ app/lib/services/documentParserService.ts => Uses csvParser for CSV files
 *   ✓ app/lib/utils/data-mapper.ts => Uses parsed CSV data
 */

import Papa from 'papaparse'
import type { ParseResult } from '@/lib/types/inbox.types'

export interface CsvParseOptions {
  delimiter?: string
  autoDetectDelimiter?: boolean
  skipEmptyLines?: boolean
}

/**
 * Auto-detect CSV delimiter by trying common delimiters
 */
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

/**
 * Parse CSV file with auto-delimiter detection
 */
export async function parseCSV(
  csvText: string,
  options: CsvParseOptions = {}
): Promise<ParseResult> {
  try {
    const delimiter = options.autoDetectDelimiter !== false
      ? detectDelimiter(csvText)
      : options.delimiter || ','

    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: options.skipEmptyLines !== false,
      delimiter,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => {
        const trimmed = value.trim()
        // Try to parse numbers
        if (trimmed === '') return null
        if (!isNaN(Number(trimmed)) && trimmed !== '') {
          return Number(trimmed)
        }
        return trimmed
      },
    })

    if (parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.map((e) => e.message).join('; ')
      return {
        success: false,
        format: 'csv',
        headers: [],
        rows: [],
        rowCount: 0,
        error: `CSV parsing errors: ${errorMessages}`,
        metadata: {
          delimiter,
        },
      }
    }

    const headers = parseResult.meta.fields || []
    const rows = (parseResult.data as Record<string, unknown>[]).filter(
      (row) => Object.keys(row).length > 0
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

/**
 * Validate CSV structure
 */
export function validateCSV(rows: Record<string, unknown>[], minColumns: number = 1): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (rows.length === 0) {
    errors.push('CSV file is empty')
  }

  rows.forEach((row, index) => {
    const columnCount = Object.keys(row).length
    if (columnCount < minColumns) {
      errors.push(`Row ${index + 1}: Insufficient columns (expected at least ${minColumns}, got ${columnCount})`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
