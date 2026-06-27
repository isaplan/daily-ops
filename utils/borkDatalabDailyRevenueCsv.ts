/**
 * @registry-id: borkDatalabDailyRevenueCsv
 * @created: 2026-06-24T00:00:00.000Z
 * @last-modified: 2026-06-24T00:00:00.000Z
 * @description: Parse Datalab daily revenue CSV (comma-separated, EU number format)
 * @last-fix: [2026-06-24] Initial parser for 2024 full-year export
 *
 * @exports-to:
 * ✓ server/utils/revenueDailyBenchmarkService.ts
 * ✓ scripts/seed-revenue-daily-benchmarks.ts
 */

export type ParsedDatalabDailyRevenueRow = {
  businessDate: string
  locationId: string
  locationName: string
  ex_vat: number
  inc_vat: number
  quantity: number
}

const WINKEL_TO_LOCATION = new Map<string, { locationId: string; locationName: string }>([
  ['Gastropub Van Kinsbergen', { locationId: '69d6cfa63d2adf93b79d1ae7', locationName: 'Van Kinsbergen' }],
  ['Bar Bea', { locationId: '69d6cfa63d2adf93b79d1ae6', locationName: 'Bar Bea' }],
  ["L'Amour Toujours", { locationId: '69d6cfa73d2adf93b79d1ae8', locationName: "l'Amour Toujours" }],
])

/** Resolve Datalab winkel label → unified locationId (strip SSOT names). */
export function datalabWinkelToLocation(winkel: string): { locationId: string; locationName: string } | null {
  const s = winkel.trim()
  const direct = WINKEL_TO_LOCATION.get(s)
  if (direct) return direct
  if (/kinsbergen/i.test(s)) return WINKEL_TO_LOCATION.get('Gastropub Van Kinsbergen') ?? null
  if (/bar\s*bea/i.test(s.replace(/\s+/g, ''))) return WINKEL_TO_LOCATION.get('Bar Bea') ?? null
  if (/amour/i.test(s) && /toujours/i.test(s)) return WINKEL_TO_LOCATION.get("L'Amour Toujours") ?? null
  return null
}

export function parseDatalabEurAmount(raw: string): number {
  const t = raw.trim().replace(/^"|"$/g, '').replace(/\s/g, '')
  if (!t || t === '-' || t === '0' || t === '0,00') return 0
  const normalized = t.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function parseDatalabQuantity(raw: string): number {
  const t = raw.trim().replace(/^"|"$/g, '').replace(/\./g, '').replace(/\s/g, '')
  if (!t) return 0
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : 0
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/** Parse full Datalab daily revenue export text into venue-day rows. */
export function parseDatalabDailyRevenueCsv(csvText: string): ParsedDatalabDailyRevenueRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const rows: ParsedDatalabDailyRevenueRow[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (i === 0 && line.toLowerCase().includes('dag') && line.toLowerCase().includes('winkel')) continue
    const parts = parseCsvLine(line)
    if (parts.length < 6) continue
    const businessDate = parts[0]!.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) continue
    const loc = datalabWinkelToLocation(parts[2] ?? '')
    if (!loc) continue
    const ex_vat = parseDatalabEurAmount(parts[3] ?? '')
    const inc_vat = parseDatalabEurAmount(parts[4] ?? '')
    const quantity = parseDatalabQuantity(parts[5] ?? '')
    if (ex_vat <= 0 && inc_vat <= 0 && quantity <= 0) continue
    rows.push({
      businessDate,
      locationId: loc.locationId,
      locationName: loc.locationName,
      ex_vat,
      inc_vat,
      quantity,
    })
  }
  return rows
}
