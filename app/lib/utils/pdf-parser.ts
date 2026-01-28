/**
 * @registry-id: pdfParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: PDF parser with text extraction (no OCR)
 * @last-fix: [2026-01-28] Fixed pdfjs-dist SSR issue with dynamic import for Next.js server-side usage
 * 
 * @imports-from:
 *   - pdfjs-dist => PDF text extraction library
 * 
 * @exports-to:
 *   ✓ app/lib/services/documentParserService.ts => Uses pdfParser for PDF files
 */

import type { ParseResult } from '@/lib/types/inbox.types'

// Dynamic import for pdfjs-dist to avoid SSR issues
// Note: For server-side usage, pdfjs-dist doesn't require worker configuration
// Workers are primarily for browser environments to offload processing
// Server-side parsing works without workers (may be slightly slower but more reliable)

// Configure pdfjs-dist for server-side usage
let pdfjsLib: typeof import('pdfjs-dist') | null = null

async function getPdfJsLib() {
  if (!pdfjsLib) {
    // Use dynamic import to avoid SSR issues
    pdfjsLib = await import('pdfjs-dist')
    // Disable worker for server-side usage
    if (typeof window === 'undefined') {
      // Server-side: no worker needed
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }
  }
  return pdfjsLib
}

export interface PdfParseOptions {
  maxPages?: number
  extractTables?: boolean
}

/**
 * Parse PDF file and extract text
 */
export async function parsePDF(
  pdfBuffer: Buffer,
  options: PdfParseOptions = {}
): Promise<ParseResult> {
  try {
    const pdfjs = await getPdfJsLib()
    const loadingTask = pdfjs.getDocument({ data: pdfBuffer })
    const pdf = await loadingTask.promise
    const maxPages = options.maxPages || pdf.numPages

    const textChunks: string[] = []
    const rows: Record<string, unknown>[] = []

    // Extract text from each page
    for (let pageNum = 1; pageNum <= Math.min(maxPages, pdf.numPages); pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim()

      if (pageText) {
        textChunks.push(pageText)
      }
    }

    const fullText = textChunks.join('\n\n')

    // Try to extract table-like structures (simple heuristic)
    if (options.extractTables !== false && fullText.length > 0) {
      const lines = fullText.split('\n').filter((line) => line.trim().length > 0)
      
      // Look for lines that might be table rows (contain multiple spaces or tabs)
      const potentialTableRows = lines.filter((line) => {
        const spaceCount = (line.match(/\s{2,}/g) || []).length
        return spaceCount >= 2 || line.includes('\t')
      })

      if (potentialTableRows.length > 0) {
        // Extract headers from first potential table row
        const firstRow = potentialTableRows[0]
        const headers = firstRow
          .split(/\s{2,}|\t/)
          .map((h) => h.trim())
          .filter(Boolean)

        if (headers.length > 1) {
          // Parse remaining rows
          potentialTableRows.slice(1).forEach((row) => {
            const values = row.split(/\s{2,}|\t/).map((v) => v.trim())
            const rowObj: Record<string, unknown> = {}
            headers.forEach((header, index) => {
              rowObj[header] = values[index] || null
            })
            if (Object.keys(rowObj).length > 0) {
              rows.push(rowObj)
            }
          })
        }
      }
    }

    // If no table structure found, return text as single row
    if (rows.length === 0 && fullText.length > 0) {
      rows.push({
        text: fullText,
        pageCount: pdf.numPages,
      })
    }

    return {
      success: true,
      format: 'pdf',
      headers: rows.length > 0 ? Object.keys(rows[0]) : ['text'],
      rows,
      rowCount: rows.length,
      metadata: {
        pageCount: pdf.numPages,
        extractedText: fullText.substring(0, 1000), // First 1000 chars for preview
      },
    }
  } catch (error) {
    return {
      success: false,
      format: 'pdf',
      headers: [],
      rows: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown PDF parsing error',
    }
  }
}
