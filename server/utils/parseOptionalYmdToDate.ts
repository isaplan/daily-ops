/**
 * Parse `YYYY-MM-DD` into a local calendar Date, or undefined if invalid / empty.
 */
export function parseOptionalYmdToDate(v: unknown): Date | undefined {
  if (v == null || v === '') return undefined
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return undefined
  return dt
}
