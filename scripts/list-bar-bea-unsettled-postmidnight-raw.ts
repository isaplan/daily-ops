/**
 * Lists Bar Bea raw tickets skipped by V2 aggregation (ActualDate 10101) with Time hour 00–05.
 * Usage: node --experimental-strip-types scripts/list-bar-bea-unsettled-postmidnight-raw.ts
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient } from 'mongodb'

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

const BEA_KEY_26 = '6916766daf9930f74a6960be:bork_daily:20260426'
const BEA_KEY_27 = '6916766daf9930f74a6960be:bork_daily:20260427'

function extractHour(timeStr: string): number {
  const m = String(timeStr || '').match(/^(\d{1,2}):/)
  return m ? parseInt(m[1], 10) : -1
}

/** Sum line revenue; optional: only orders on these Bork YYYYMMDD dates (party window). */
function sumLines(
  orders: unknown[],
  onlyOrderDates?: Set<string>
): { rev: number; dates: string[] } {
  let rev = 0
  const dates = new Set<string>()
  if (!Array.isArray(orders)) return { rev, dates: [] }
  for (const o of orders) {
    if (!o || typeof o !== 'object') continue
    const od = String((o as { Date?: unknown }).Date ?? '').padStart(8, '0')
    if (od && od !== '00000000') dates.add(od)
    if (onlyOrderDates && !onlyOrderDates.has(od)) continue
    const lines = (o as { Lines?: unknown[] }).Lines
    if (!Array.isArray(lines)) continue
    for (const line of lines) {
      if (!line || typeof line !== 'object') continue
      const l = line as { Price?: unknown; Qty?: unknown }
      rev += Number(l.Price || 0) * Number(l.Qty || 0)
    }
  }
  return { rev, dates: [...dates].sort() }
}

async function scanBlob(
  db: ReturnType<MongoClient['db']>,
  syncKey: string,
  filter: (tk: Record<string, unknown>) => boolean,
  onlyOrderDates?: Set<string>
): Promise<
  Array<{
    syncKey: string
    ticketIndex: number
    TicketId?: unknown
    Time: string
    ActualDate: unknown
    UserName?: string
    AccountName?: string
    lineRev: number
    lineRevPartyWindow?: number
    orderDates: string[]
  }>
> {
  const doc = await db.collection('bork_raw_data').findOne({ syncDedupKey: syncKey })
  if (!doc?.rawApiResponse) return []
  const tickets = Array.isArray(doc.rawApiResponse) ? doc.rawApiResponse : [doc.rawApiResponse]
  const out: Array<{
    syncKey: string
    ticketIndex: number
    TicketId?: unknown
    Time: string
    ActualDate: unknown
    UserName?: string
    AccountName?: string
    lineRev: number
    lineRevPartyWindow?: number
    orderDates: string[]
  }> = []
  tickets.forEach((t: unknown, ticketIndex: number) => {
    if (!t || typeof t !== 'object') return
    const tk = t as Record<string, unknown>
    if (!filter(tk)) return
    const orders = (tk.Orders as unknown[]) || []
    const { rev, dates } = sumLines(orders)
    const party = onlyOrderDates ? sumLines(orders, onlyOrderDates).rev : undefined
    const useRev = onlyOrderDates ? party ?? 0 : rev
    if (useRev <= 0) return
    out.push({
      syncKey,
      ticketIndex,
      TicketId: tk.TicketId ?? tk.Id ?? tk.TicketNr,
      Time: String(tk.Time ?? ''),
      ActualDate: tk.ActualDate,
      UserName: tk.UserName as string | undefined,
      AccountName: tk.AccountName as string | undefined,
      lineRev: Math.round(rev * 100) / 100,
      lineRevPartyWindow:
        onlyOrderDates !== undefined ? Math.round((party ?? 0) * 100) / 100 : undefined,
      orderDates: dates,
    })
  })
  return out
}

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('Missing MONGODB_URI')
    process.exit(1)
  }
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'daily-ops')

  const isUnsettled = (tk: Record<string, unknown>) =>
    tk.ActualDate === 10101 || tk.ActualDate === '10101'

  const isPostMidnightHour = (tk: Record<string, unknown>) => {
    const h = extractHour(String(tk.Time ?? ''))
    return h >= 0 && h <= 5
  }

  const partyDates = new Set(['20260426', '20260427'])

  const rowsA = await scanBlob(
    db,
    BEA_KEY_26,
    (tk) => isUnsettled(tk) && isPostMidnightHour(tk),
    partyDates
  )
  const rowsB = await scanBlob(
    db,
    BEA_KEY_27,
    (tk) => isUnsettled(tk) && isPostMidnightHour(tk),
    partyDates
  )

  const byKey = new Map<
    string,
    (typeof rowsA)[0] & { seenInBlobs: string[]; lineRevPartyWindow: number }
  >()
  for (const r of [...rowsA, ...rowsB]) {
    const id =
      r.TicketId !== undefined && r.TicketId !== null && String(r.TicketId) !== ''
        ? `id:${String(r.TicketId)}`
        : `idx:${r.UserName ?? ''}|${r.AccountName ?? ''}|${r.lineRevPartyWindow ?? r.lineRev}`
    const prev = byKey.get(id)
    const pw = r.lineRevPartyWindow ?? 0
    if (!prev) {
      byKey.set(id, { ...r, lineRevPartyWindow: pw, seenInBlobs: [r.syncKey] })
    } else {
      prev.seenInBlobs.push(r.syncKey)
    }
  }
  const deduped = [...byKey.values()].sort((a, b) =>
    (a.AccountName ?? '').localeCompare(b.AccountName ?? '')
  )

  let sumParty = 0
  for (const r of deduped) sumParty += r.lineRevPartyWindow

  console.log(
    JSON.stringify(
      {
        note:
          'V2 skips tickets where ActualDate is 10101. Only lines with order.Date in 20260426–20260427 are summed (party window). Same TicketId deduped across the two daily raw blobs.',
        barBeaRawBlobs: [BEA_KEY_26, BEA_KEY_27],
        filter: 'ActualDate 10101 AND Time hour 00–05 AND order.Date in {20260426,20260427}',
        ticketCountDeduped: deduped.length,
        sumLineRevenuePartyWindowInclVat: Math.round(sumParty * 100) / 100,
        tickets: deduped.map(({ seenInBlobs, ...rest }) => ({ ...rest, seenInBlobs })),
      },
      null,
      2
    )
  )

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
