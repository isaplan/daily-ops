/** Iterate YYYY-MM-DD strings inclusive. */
export function* eachBusinessDate(startDate: string, endDate: string): Generator<string> {
  const [y0, m0, d0] = startDate.split('-').map(Number)
  const [y1, m1, d1] = endDate.split('-').map(Number)
  const cur = new Date(Date.UTC(y0!, m0! - 1, d0!))
  const end = new Date(Date.UTC(y1!, m1! - 1, d1!))
  while (cur <= end) {
    const y = cur.getUTCFullYear()
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const d = String(cur.getUTCDate()).padStart(2, '0')
    yield `${y}-${m}-${d}`
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
}

export function countDaysInclusive(startDate: string, endDate: string): number {
  let n = 0
  for (const _ of eachBusinessDate(startDate, endDate)) n++
  return n
}
