/**
 * Europe/Amsterdam civil clock hour (0–23) for a Date instant.
 * Used for inbox cron batch chips (aligned with Bork basis reports).
 */

export function getAmsterdamWallHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const n = parseInt(h, 10)
  return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : 0
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Prefer Gmail receive time, then parsed row creation, then now (manual upload / script). */
export function resolveInboxImportInstant(dto: {
  sourceEmailReceivedAt?: string | Date | null
  parsedDataCreatedAt?: string | Date | null
}): Date {
  return (
    parseOptionalDate(dto.sourceEmailReceivedAt) ??
    parseOptionalDate(dto.parsedDataCreatedAt) ??
    new Date()
  )
}
