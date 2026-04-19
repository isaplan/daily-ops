/**
 * @registry-id: documentParserService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: Document parser — routes CSV/XLSX/PDF and classifies document type (Nuxt port)
 * @last-fix: [2026-04-18] Ported from next-js-old
 *
 * @exports-to:
 * ✓ server/services/inboxProcessService.ts
 * ✓ server/api/inbox/parse.post.ts
 * ✓ server/api/inbox/upload.post.ts
 */

import { parseCSV } from '../utils/inbox/csv-parser'
import { parseExcel } from '../utils/inbox/excel-parser'
import { parsePDF } from '../utils/inbox/pdf-parser'
import { classifyDocument, classifyByFilename } from '../utils/inbox/document-classifier'
import type { DocumentType, ParseResult } from '~/types/inbox'

export type ParseDocumentOptions = {
  fileName: string
  mimeType: string
  data: string | Buffer
  autoDetectType?: boolean
}

class DocumentParserService {
  private detectFormat(
    fileName: string,
    mimeType: string,
  ): 'csv' | 'xlsx' | 'pdf' | 'html' | 'unknown' {
    const lowerName = fileName.toLowerCase()
    const lowerMime = mimeType.toLowerCase()

    if (lowerMime.includes('csv') || lowerName.endsWith('.csv')) {
      return 'csv'
    }
    if (
      lowerMime.includes('spreadsheet') ||
      lowerMime.includes('excel') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls')
    ) {
      return 'xlsx'
    }
    if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
      return 'pdf'
    }
    if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerMime.includes('text/html')) {
      return 'html'
    }

    return 'unknown'
  }

  async parseDocument(
    options: ParseDocumentOptions,
  ): Promise<ParseResult & { documentType?: DocumentType }> {
    const format = this.detectFormat(options.fileName, options.mimeType)

    let parseResult: ParseResult

    try {
      switch (format) {
        case 'csv': {
          if (typeof options.data !== 'string') {
            return {
              success: false,
              format: 'csv',
              headers: [],
              rows: [],
              rowCount: 0,
              error: 'CSV data must be a string',
            }
          }
          const filenameHint = classifyByFilename(options.fileName)
          const skipLines =
            filenameHint.type === 'product_mix' ? 10 : filenameHint.type === 'food_beverage' ? 8 : undefined
          parseResult = await parseCSV(options.data, { autoDetectDelimiter: true, skipLines })
          break
        }

        case 'xlsx': {
          if (!(options.data instanceof Buffer)) {
            return {
              success: false,
              format: 'xlsx',
              headers: [],
              rows: [],
              rowCount: 0,
              error: 'Excel data must be a Buffer',
            }
          }
          const filenameHint = classifyByFilename(options.fileName)
          const basisReportOptions =
            filenameHint.type === 'basis_report'
              ? { parseAllSheets: false, skipRows: 9, emptyHeadersAsColumnN: true }
              : { parseAllSheets: true }
          parseResult = await parseExcel(options.data, basisReportOptions)
          break
        }

        case 'pdf': {
          if (!(options.data instanceof Buffer)) {
            return {
              success: false,
              format: 'pdf',
              headers: [],
              rows: [],
              rowCount: 0,
              error: 'PDF data must be a Buffer',
            }
          }
          parseResult = await parsePDF(options.data, { extractTables: true })
          break
        }

        case 'html': {
          return {
            success: false,
            format: 'html',
            headers: [],
            rows: [],
            rowCount: 0,
            error: 'HTML files are ignored (not parsed)',
          }
        }

        default: {
          return {
            success: false,
            format: 'unknown',
            headers: [],
            rows: [],
            rowCount: 0,
            error: `Unsupported file format: ${format}`,
          }
        }
      }

      if (options.autoDetectType !== false && parseResult.success) {
        const classification = classifyDocument(options.fileName, parseResult.headers)

        if (classification.type === 'formitabele' || classification.type === 'pasy') {
          return {
            ...parseResult,
            success: false,
            error: `Document type "${classification.type}" is not yet supported (coming soon)`,
            documentType: classification.type,
          }
        }

        return {
          ...parseResult,
          documentType: classification.type,
        }
      }

      return parseResult
    } catch (error) {
      return {
        success: false,
        format,
        headers: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      }
    }
  }
}

export const documentParserService = new DocumentParserService()
