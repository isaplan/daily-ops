/**
 * @registry-id: pdfParser
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-04-18T00:00:00.000Z
 * @description: PDF text extraction (ported from next-js-old)
 * @last-fix: [2026-04-18] Nuxt server dynamic import pdfjs-dist
 *
 * @exports-to:
 * ✓ server/services/documentParserService.ts
 */

import { Buffer } from 'node:buffer'
import type { ParseResult } from '~/types/inbox'

let pdfjsLib: typeof import('pdfjs-dist') | null = null

async function getPdfJsLib() {
  if (!pdfjsLib) {
    // Polyfill DOMMatrix and other DOM globals required by pdfjs-dist
    if (typeof globalThis.DOMMatrix === 'undefined') {
      globalThis.DOMMatrix = class DOMMatrix {
        constructor(public values: (string | number)[] = []) {}
        static fromMatrix() { return new DOMMatrix() }
        static fromFloat32Array() { return new DOMMatrix() }
        static fromFloat64Array() { return new DOMMatrix() }
      } as any
    }
    if (typeof globalThis.DOMPoint === 'undefined') {
      globalThis.DOMPoint = class DOMPoint {
        constructor(public x: number = 0, public y: number = 0) {}
      } as any
    }
    
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''
  }
  return pdfjsLib
}

export type PdfParseOptions = {
  maxPages?: number
  extractTables?: boolean
}

export async function parsePDF(pdfBuffer: Buffer, options: PdfParseOptions = {}): Promise<ParseResult> {
  try {
    const pdfjs = await getPdfJsLib()
    const loadingTask = pdfjs.getDocument({ data: pdfBuffer })
    const pdf = await loadingTask.promise
    const maxPages = options.maxPages || pdf.numPages

    const textChunks: string[] = []
    const rows: Record<string, unknown>[] = []

    for (let pageNum = 1; pageNum <= Math.min(maxPages, pdf.numPages); pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: { str?: string }) => item.str)
        .join(' ')
        .trim()
      if (pageText) {
        textChunks.push(pageText)
      }
    }

    const fullText = textChunks.join('\n\n')

    if (options.extractTables !== false && fullText.length > 0) {
      const lines = fullText.split('\n').filter((line) => line.trim().length > 0)
      const potentialTableRows = lines.filter((line) => {
        const spaceCount = (line.match(/\s{2,}/g) || []).length
        return spaceCount >= 2 || line.includes('\t')
      })

      if (potentialTableRows.length > 0) {
        const firstRow = potentialTableRows[0]!
        const headers = firstRow
          .split(/\s{2,}|\t/)
          .map((h) => h.trim())
          .filter(Boolean)

        if (headers.length > 1) {
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

    if (rows.length === 0 && fullText.length > 0) {
      rows.push({
        text: fullText,
        pageCount: pdf.numPages,
      })
    }

    const firstDataRow = rows[0]
    return {
      success: true,
      format: 'pdf',
      headers: rows.length > 0 && firstDataRow ? Object.keys(firstDataRow) : ['text'],
      rows,
      rowCount: rows.length,
      metadata: {
        pageCount: pdf.numPages,
        extractedText: fullText.substring(0, 1000),
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
