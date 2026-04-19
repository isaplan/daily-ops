/**
 * @registry-id: excelParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Excel parser (ported from next-js-old)
 * @last-fix: [2026-04-18] Nuxt server path imports
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 */

import { Buffer } from 'node:buffer'
import * as XLSX from 'xlsx'
import type { ParseResult } from '~/types/inbox'

export type ExcelParseOptions = {
  sheetName?: string
  parseAllSheets?: boolean
  skipRows?: number
  emptyHeadersAsColumnN?: boolean
}

export async function parseExcel(
  excelBuffer: Buffer,
  options: ExcelParseOptions = {},
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

    const sheetOptions = { skipRows: options.skipRows, emptyHeadersAsColumnN: options.emptyHeadersAsColumnN }

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
      return parseSheet(sheet, 'xlsx', sheetNames, sheetOptions)
    }

    if (options.parseAllSheets !== false && sheetNames.length > 1) {
      const sheetResults: ParseResult[] = []
      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const result = parseSheet(sheet, 'xlsx', [sheetName])
        sheetResults.push(result)
      }
      const dataSheet = sheetResults[0]
      const metadataSheets = sheetResults.slice(1)
      const userInfo: Record<string, unknown> = {}
      metadataSheets.forEach((metaSheet) => {
        if (metaSheet.success && metaSheet.rows.length > 0) {
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

    const firstName = sheetNames[0]
    if (!firstName) {
      return {
        success: false,
        format: 'xlsx',
        headers: [],
        rows: [],
        rowCount: 0,
        error: 'Excel file contains no sheet names',
      }
    }
    const firstSheet = workbook.Sheets[firstName]
    if (!firstSheet) {
      return {
        success: false,
        format: 'xlsx',
        headers: [],
        rows: [],
        rowCount: 0,
        error: 'First sheet missing',
      }
    }
    return parseSheet(firstSheet, 'xlsx', sheetNames, sheetOptions)
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

type ParseSheetOptions = {
  skipRows?: number
  emptyHeadersAsColumnN?: boolean
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  format: 'xlsx',
  sheetNames: string[],
  opts: ParseSheetOptions = {},
): ParseResult {
  try {
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
        metadata: { sheets: sheetNames },
      }
    }

    const skipRows = opts.skipRows ?? 0
    const afterSkip = jsonData.slice(skipRows)
    if (afterSkip.length === 0) {
      return {
        success: false,
        format,
        headers: [],
        rows: [],
        rowCount: 0,
        error: 'No data after skipping rows',
        metadata: { sheets: sheetNames },
      }
    }

    const headerRow = afterSkip[0] as (string | null | number)[]
    const headers = headerRow.map((h, index) => {
      const s = String(h ?? '').trim()
      if (opts.emptyHeadersAsColumnN && !s) return `column_${index}`
      return s || `column_${index}`
    })
    const dataRows = afterSkip.slice(1)

    const rows: Record<string, unknown>[] = dataRows
      .filter((row) => row.some((cell) => cell !== null && cell !== ''))
      .map((row) => {
        const rowObj: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          const value = row[index]
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

export function getSheetNames(excelBuffer: Buffer): string[] {
  try {
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    return workbook.SheetNames
  } catch {
    return []
  }
}
