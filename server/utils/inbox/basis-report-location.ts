/**
 * Basis Rapport venue resolution — same rules for email subject + XLSX preamble rows.
 * Filenames are often generic (`Basis Rapport-1--1.xlsx`); location usually appears in subject or early sheet rows.
 *
 * **Trivec Basis Rapport XLSX layout (physical rows, 1-based):**
 *   1 = title ("Basis Rapport")
 *   2 = reporting date (often `dd/mm/yyyy - dd/mm/yyyy`)
 *   3 = empty
 *   4 = **venue name** (primary source of truth)
 *   5 = venue address
 *
 * The Excel parser uses `skipRows: 9` for the netto table, so row 4 is **not** in `parseResult.rows`;
 * it is supplied via `metadata.trivecBasisPreamble` from `excel-parser.ts`.
 */

/** First non-empty cell in a preamble row (handles merged / shifted columns). */
function firstNonEmptyCell(row: string[] | undefined): string {
  if (!row || row.length === 0) return ''
  for (const c of row) {
    const t = String(c ?? '').trim()
    if (t) return t
  }
  return ''
}

/**
 * Venue from Trivec Basis Rapport **sheet row 4** (0-based preamble index `3`).
 */
export function extractLocationFromTrivecBasisPreamble(preamble: string[][] | undefined | null): string {
  if (!preamble || preamble.length < 4) return ''
  const raw = firstNonEmptyCell(preamble[3])
  if (!raw) return ''
  const low = raw.toLowerCase()
  if (low.includes('basis rapport')) return ''
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) return ''
  /** Row 5 address often has postcode + NL */
  if (/\b\d{4}\s*[A-Z]{2}\b/i.test(raw) && /nederland|netherlands/i.test(raw)) return ''
  return raw
}

/**
 * Reporting date from **sheet row 2** (0-based preamble index `1`). Returns `YYYY-MM-DD` or `''`.
 */
export function extractDateFromTrivecBasisPreamble(preamble: string[][] | undefined | null): string {
  if (!preamble || preamble.length < 2) return ''
  const raw = firstNonEmptyCell(preamble[1])
  if (!raw) return ''
  const range = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (range) {
    const [, d, m, y] = range
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const single = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (single) {
    const [, d, m, y] = single
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return ''
}

/** Lowercase, spaces collapsed — internal helper */
function normalizeLooseLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Single bucket per physical venue so Basis inbox labels align with Bork `locationName`.
 * Covers Barbea vs Bar Bea, lAmour vs l'Amour Toujours, Kinsbergen vs Van Kinsbergen.
 */
export function canonicalVenueKeyForBorkMatching(raw: string): string {
  const n = normalizeLooseLabel(raw)
  if (!n || n === 'unspecified' || n === 'unknown') return ''
  const compact = n.replace(/[^a-z0-9]/g, '')

  if (compact.includes('kinsbergen')) return 'venue:k'
  if (compact === 'barbea' || (compact.includes('bar') && compact.includes('bea'))) return 'venue:bb'
  if (compact.includes('toujours') || (compact.includes('amour') && compact.includes('toujours'))) return 'venue:lat'
  if (compact === 'lamour') return 'venue:lat'

  return `venue:${n}`
}

export function matchVenueLocationFromText(text: string): string | null {
  const s = text.replace(/\s+/g, ' ').trim()
  if (s.length < 2) return null

  if (/kinsbergen/i.test(s)) return 'Kinsbergen'

  if (/bar\s*bea/i.test(s) || /barbea/i.test(s)) return 'Barbea'

  /** Full venue name often split ("lAmour Toujours"); also catches I/l confusion in UI fonts */
  if (/toujours/i.test(s) && /amour/i.test(s)) return "l'Amour Toujours"
  if (/l\s*['']?\s*amour|lamour/i.test(s)) return "l'Amour Toujours"

  if (/\bbea\b/i.test(s) && !/barbea/i.test(s)) return 'Bea'

  return null
}

/** Scan early rows: any cell may contain the venue (merged titles, preamble before Groep columns). */
export function extractLocationFromBasisSpreadsheet(
  rows: Record<string, unknown>[],
  fileName: string,
): string {
  const maxRow = Math.min(40, rows.length)
  for (let i = 0; i < maxRow; i++) {
    const row = rows[i] as Record<string, unknown>
    const vals = Object.values(row)
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)

    for (const val of vals) {
      const hit = matchVenueLocationFromText(val)
      if (hit) return hit
    }

    const joined = vals.join(' ')
    if (joined.length > 3) {
      const rowHit = matchVenueLocationFromText(joined)
      if (rowHit) return rowHit
    }
  }

  return extractLocationFromBasisFileName(fileName)
}

export function extractLocationFromBasisFileName(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes('kinsbergen')) return 'Kinsbergen'
  if (lower.includes('toujours') || lower.includes('lamour') || lower.includes("l'amour"))
    return "l'Amour Toujours"
  if (lower.includes('barbea') || lower.includes('bar-bea')) return 'Barbea'
  if (/\bbea\b/.test(lower) && !lower.includes('barbea')) return 'Bea'
  return ''
}
