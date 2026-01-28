/**
 * @registry-id: excelParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Excel parser with multi-sheet support (handles Eitje Data + Metadata sheets)
 * @last-fix: [2026-01-26] Initial implementation with Eitje metadata sheet support
 * 
 * @imports-from:
 *   - xlsx => Excel parsing library
 * 
 * @exports-to:
 *   ✓ app/lib/services/documentParserService.ts => Uses excelParser for Excel files
 *   ✓ app/lib/utils/data-mapper.ts => Uses parsed Excel data
 */

import * as XLSX from 'xlsx'
import type { ParseResult } from '@/lib/types/inbox.types'

export interface ExcelParseOptions {
  sheetName?: string
  parseAllSheets?: boolean
}

/**
 * Parse Excel file (supports .xlsx and .xls)
 */
export async function parseExcel(
  excelBuffer: Buffer,
  options: ExcelParseOptions = {}
): Promise<ParseResult & { sheets?: ParseResult[] }> {
  try {
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    const sheetNames = workbook.SheetNames

    if (sheetNames.length === 0) {
      return {
        success: false,
        format: 'xlsx',
        headers: [],
        rows: [],
        rowCount: 0,
        error: 'Excel file contains no sheets',
      }
    }

    // If specific sheet requested
    if (options.sheetName) {
      const sheet = workbook.Sheets[options.sheetName]
      if (!sheet) {
        return {
          success: false,
          format: 'xlsx',
          headers: [],
          rows: [],
          rowCount: 0,
          error: `Sheet "${options.sheetName}" not found`,
        }
      }
      return parseSheet(sheet, 'xlsx', sheetNames)
    }

    // If parse all sheets (for Eitje format: Data + Metadata)
    if (options.parseAllSheets !== false && sheetNames.length > 1) {
      const sheetResults: ParseResult[] = []

      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const result = parseSheet(sheet, 'xlsx', [sheetName])
        sheetResults.push(result)
      }

      // First sheet is typically data, others might be metadata
      const dataSheet = sheetResults[0]
      const metadataSheets = sheetResults.slice(1)

      // Extract userInfo from metadata sheets (Eitje format)
      const userInfo: Record<string, unknown> = {}
      metadataSheets.forEach((metaSheet) => {
        if (metaSheet.success && metaSheet.rows.length > 0) {
          // Convert metadata rows to object
          metaSheet.rows.forEach((row) => {
            Object.assign(userInfo, row)
          })
        }
      })

      return {
        ...dataSheet,
        metadata: {
          ...dataSheet.metadata,
          sheets: sheetNames,
          userInfo: Object.keys(userInfo).length > 0 ? userInfo : undefined,
        },
        sheets: sheetResults,
      }
    }

    // Parse first sheet by default
    const firstSheet = workbook.Sheets[sheetNames[0]]
    return parseSheet(firstSheet, 'xlsx', sheetNames)
  } catch (error) {
    return {
      success: false,
      format: 'xlsx',
      headers: [],
      rows: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown Excel parsing error',
    }
  }
}

/**
 * Parse a single Excel sheet
 */
function parseSheet(
  sheet: XLSX.WorkSheet,
  format: 'xlsx',
  sheetNames: string[]
): ParseResult {
  try {
    // Convert sheet to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    }) as unknown[][]

    if (jsonData.length === 0) {
      return {
        success: false,
        format,
        headers: [],
        rows: [],
        rowCount: 0,
        error: 'Sheet is empty',
        metadata: {
          sheets: sheetNames,
        },
      }
    }

    // First row is headers
    const headers = (jsonData[0] as string[]).map((h) => String(h || '').trim()).filter(Boolean)
    const dataRows = jsonData.slice(1)

    // Convert rows to objects
    const rows: Record<string, unknown>[] = dataRows
      .filter((row) => row.some((cell) => cell !== null && cell !== ''))
      .map((row) => {
        const rowObj: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          const value = row[index]
          // Try to parse numbers
          if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
            rowObj[header] = Number(value)
          } else {
            rowObj[header] = value ?? null
          }
        })
        return rowObj
      })

    return {
      success: true,
      format,
      headers,
      rows,
      rowCount: rows.length,
      metadata: {
        sheets: sheetNames,
      },
    }
  } catch (error) {
    return {
      success: false,
      format,
      headers: [],
      rows: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown sheet parsing error',
      metadata: {
        sheets: sheetNames,
      },
    }
  }
}

/**
 * Get sheet names from Excel file
 */
export function getSheetNames(excelBuffer: Buffer): string[] {
  try {
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    return workbook.SheetNames
  } catch {
    return []
  }
}
