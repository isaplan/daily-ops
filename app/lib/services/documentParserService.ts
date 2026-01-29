/**
 * @registry-id: documentParserService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-29T00:00:00.000Z
 * @description: Document parser service - routes to appropriate parser (CSV/Excel/PDF) and classifies document type
 * @last-fix: [2026-01-29] BORK Basis Rapport Excel: skip 9 rows; Food/Bev 8; Product Mix 10
 * 
 * @imports-from:
 *   - app/lib/utils/csv-parser.ts => CSV parsing
 *   - app/lib/utils/excel-parser.ts => Excel parsing
 *   - app/lib/utils/pdf-parser.ts => PDF parsing
 *   - app/lib/utils/document-classifier.ts => Document type classification
 *   - app/lib/types/inbox.types.ts => ParseResult type
 * 
 * @exports-to:
 *   ✓ app/api/inbox/process/route.ts => Parses attachments
 *   ✓ app/api/inbox/parse/route.ts => Manual parse endpoint
 *   ✓ app/lib/services/inboxService.ts => Uses documentParserService
 */

import { parseCSV } from '@/lib/utils/csv-parser'
import { parseExcel } from '@/lib/utils/excel-parser'
import { parsePDF } from '@/lib/utils/pdf-parser'
import { classifyDocument, classifyByFilename } from '@/lib/utils/document-classifier'
import type { ParseResult, DocumentType } from '@/lib/types/inbox.types'

export interface ParseDocumentOptions {
  fileName: string
  mimeType: string
  data: string | Buffer
  autoDetectType?: boolean
}

class DocumentParserService {
  /**
   * Auto-detect file format from MIME type or filename
   */
  private detectFormat(fileName: string, mimeType: string): 'csv' | 'xlsx' | 'pdf' | 'unknown' {
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

    return 'unknown'
  }

  /**
   * Parse document based on format
   */
  async parseDocument(options: ParseDocumentOptions): Promise<ParseResult & { documentType?: DocumentType }> {
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
          // BORK Product Mix: 10 metadata lines; BORK Food/Bev: 8 metadata lines before header
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
          // BORK Basis Rapport: 9 metadata rows before header (Groep1, Hoeveelheid, Totale prijs, Ex BTW, etc.)
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

      // Classify document type if auto-detect enabled
      if (options.autoDetectType !== false && parseResult.success) {
        const classification = classifyDocument(options.fileName, parseResult.headers)
        
        // Handle "coming soon" types
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

  /**
   * Parse base64 encoded file (from Gmail attachment)
   */
  async parseBase64Attachment(
    fileName: string,
    mimeType: string,
    base64Data: string
  ): Promise<ParseResult & { documentType?: DocumentType }> {
    try {
      // Decode base64
      const buffer = Buffer.from(base64Data, 'base64')

      // Convert to string for CSV, keep as buffer for Excel/PDF
      const format = this.detectFormat(fileName, mimeType)
      const data = format === 'csv' ? buffer.toString('utf-8') : buffer

      return this.parseDocument({
        fileName,
        mimeType,
        data,
        autoDetectType: true,
      })
    } catch (error) {
      return {
        success: false,
        format: 'unknown',
        headers: [],
        rows: [],
        rowCount: 0,
        error: error instanceof Error ? error.message : 'Failed to decode base64 attachment',
      }
    }
  }
}

export const documentParserService = new DocumentParserService()
