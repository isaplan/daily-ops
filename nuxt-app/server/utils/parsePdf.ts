/**
 * Parse PDF file buffer and extract table-like structures as rows.
 * Attempts to detect menu tables in PDFs and convert them to string[][] format.
 */

import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export type ParsePdfResult =
  | { success: true; rows: string[][]; rowCount: number }
  | { success: false; error: string }

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
}

interface TextContent {
  items: TextItem[]
}

/**
 * Extract text items from PDF, grouped by Y-position (rows).
 * Groups text items that are at similar vertical positions.
 */
async function extractTextItems(pdfBuffer: Buffer): Promise<TextItem[][]> {
  const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise
  const allItems: TextItem[] = []

  for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = (await page.getTextContent()) as TextContent

    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        allItems.push({
          str: item.str,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        })
      }
    }
  }

  if (allItems.length === 0) {
    return []
  }

  // Group items by Y-position (within 5 units = same row)
  const rows: TextItem[][] = []
  let currentRow: TextItem[] = []
  let currentY = allItems[0].y

  for (const item of allItems) {
    if (Math.abs(item.y - currentY) < 5) {
      currentRow.push(item)
    } else {
      if (currentRow.length > 0) {
        rows.push([...currentRow])
      }
      currentRow = [item]
      currentY = item.y
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
}

/**
 * Convert text items grouped by row into string[][] format.
 * Sorts items by X-position within each row to preserve column order.
 */
function textItemsToRows(textRows: TextItem[][]): string[][] {
  return textRows.map((items) => {
    // Sort by X position to maintain column order
    const sorted = items.sort((a, b) => a.x - b.x)
    return sorted.map((item) => item.str.trim()).filter((text) => text.length > 0)
  })
}

/**
 * Detect if rows look like a table (has consistent column count, multiple rows).
 */
function looksLikeTable(rows: string[][]): boolean {
  if (rows.length < 3) return false
  const colCounts = rows.map((r) => r.length)
  const mode = Math.max(
    ...Array.from({ length: Math.max(...colCounts) + 1 }, (_, i) =>
      colCounts.filter((c) => c === i).length
    )
  )
  const avgColumns = colCounts.reduce((a, b) => a + b, 0) / colCounts.length
  return avgColumns >= 3 && mode >= colCounts.length * 0.6
}

/**
 * Parse PDF buffer and extract table rows.
 * Returns rows as string[][] similar to CSV/Excel format.
 */
export async function parsePdfToRows(buffer: Buffer): Promise<ParsePdfResult> {
  try {
    const textRows = await extractTextItems(buffer)

    if (textRows.length === 0) {
      return {
        success: false,
        error: 'No text found in PDF. Ensure the PDF contains readable text, not scanned images.',
      }
    }

    const rows = textItemsToRows(textRows)

    if (!looksLikeTable(rows)) {
      return {
        success: false,
        error: 'PDF does not appear to contain a structured table. Ensure the menu is formatted as a table with consistent columns.',
      }
    }

    return { success: true, rows, rowCount: rows.length }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to parse PDF',
    }
  }
}
