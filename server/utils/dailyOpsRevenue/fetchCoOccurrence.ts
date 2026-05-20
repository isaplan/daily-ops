import type { Db } from 'mongodb'
import type {
  DailyOpsCoOccurrencePair,
  DailyOpsRevenueCoOccurrenceDto,
  DailyOpsRevenueQueryContext,
} from '~/types/daily-ops-revenue'

const MAX_ORDERS = 8000
const TOP_PAIRS = 25

function borkDateToIso(borkDate: number): string {
  const s = String(borkDate).padStart(8, '0')
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function productNameFromLine(line: Record<string, unknown>): string | null {
  const name = String(line.ProductName ?? line.productName ?? '').trim()
  return name.length > 0 && name !== 'Unknown' ? name : null
}

function addPairs(products: string[], pairCounts: Map<string, number>) {
  const unique = [...new Set(products)].filter(Boolean).sort()
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const key = `${unique[i]!}|||${unique[j]!}`
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
    }
  }
}

function extractHour(timeStr: string | undefined): number {
  if (!timeStr || timeStr.length < 2) return 12
  const h = parseInt(timeStr.slice(0, 2), 10)
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 12
}

/** Ticket-level product pairs from bork_raw_data (capped). */
export async function fetchCoOccurrence(
  db: Db,
  ctx: DailyOpsRevenueQueryContext,
): Promise<DailyOpsRevenueCoOccurrenceDto> {
  const pairCounts = new Map<string, number>()
  let ordersProcessed = 0
  const startBork = parseInt(ctx.startDate.replace(/-/g, ''), 10)
  const endBork = parseInt(ctx.endDate.replace(/-/g, ''), 10)

  const cursor = db.collection('bork_raw_data').find({ endpoint: 'bork_daily' }).batchSize(8)

  for await (const doc of cursor) {
    if (ordersProcessed >= MAX_ORDERS) break
    const raw = doc as {
      locationId?: string
      rawApiResponse?: unknown
    }
    if (ctx.locationId && String(raw.locationId) !== ctx.locationId) continue

    const tickets = Array.isArray(raw.rawApiResponse)
      ? raw.rawApiResponse
      : raw.rawApiResponse
        ? [raw.rawApiResponse]
        : []

    for (const ticket of tickets) {
      if (ordersProcessed >= MAX_ORDERS) break
      if (!ticket || typeof ticket !== 'object') continue
      const t = ticket as { Time?: string; Orders?: unknown[] }
      const calendarHour = extractHour(t.Time)
      const orders = Array.isArray(t.Orders) ? t.Orders : []

      for (const order of orders) {
        if (ordersProcessed >= MAX_ORDERS) break
        const o = order as { Date?: string; ActualDate?: string; Lines?: unknown[] }
        const orderDate = String(o.Date || o.ActualDate || '').padStart(8, '0')
        const orderBork = parseInt(orderDate, 10)
        if (!orderBork || orderBork < startBork || orderBork > endBork) continue

        const isoDate = borkDateToIso(orderBork)
        if (isoDate < ctx.startDate || isoDate > ctx.endDate) continue

        const names: string[] = []
        for (const line of Array.isArray(o.Lines) ? o.Lines : []) {
          const n = productNameFromLine(line as Record<string, unknown>)
          if (n) names.push(n)
        }
        if (names.length < 2) continue
        addPairs(names, pairCounts)
        ordersProcessed++
      }
    }
  }

  if (pairCounts.size === 0) {
    return {
      pairs: [],
      note:
        ordersProcessed === 0
          ? 'Geen orders in bereik voor co-occurrence (controleer bork_raw_data).'
          : 'Geen productparen gevonden.',
    }
  }

  const pairs: DailyOpsCoOccurrencePair[] = [...pairCounts.entries()]
    .map(([key, count]) => {
      const [productA, productB] = key.split('|||')
      return { productA: productA!, productB: productB!, count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_PAIRS)

  return {
    pairs,
    note: `Top ${pairs.length} paren · ${ordersProcessed.toLocaleString('nl-NL')} orders.`,
  }
}
