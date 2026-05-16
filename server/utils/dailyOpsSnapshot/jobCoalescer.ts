/**
 * @registry-id: dailyOpsSnapshotJobCoalescer
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T09:20:00.000Z
 * @description: Light in-process debounce queue. Multiple enqueue() calls for the same
 *   (businessDate, locationId) within `windowMs` collapse to a single rebuild run.
 *   Used by event hooks (eitje sync, inbox upsert) so a burst of events does not trigger
 *   N rebuilds.
 * @last-fix: [2026-05-13] Coerce DEBUG to string before .includes (boolean env).
 *
 * @architecture:
 *   - In-process only (single Nuxt server instance assumption). For multi-instance,
 *     swap with a Redis-backed queue later.
 *   - Default window: 5000 ms. Configurable per-key on enqueue.
 *   - Runner is injected at registration time — no circular import on the service.
 *
 * @exports-to:
 *   ✓ server/services/dailyOpsSnapshotService.ts (registers runner)
 *   ✓ server/services/eitjeSyncService.ts (enqueues)
 *   ✓ server/services/inboxProcessService.ts (enqueues)
 *   ✓ server/services/basisReportBackfillService.ts (enqueues)
 */

const DEBUG = String(process.env.DEBUG ?? '').includes('snapshot:queue')
const DEFAULT_WINDOW_MS = 5000

export type SnapshotKey = { businessDate: string; locationId: string }
type Runner = (key: SnapshotKey) => Promise<void>

type TimerHandle = ReturnType<typeof setTimeout>
const pending = new Map<string, TimerHandle>()
let runner: Runner | null = null

function keyOf(k: SnapshotKey): string {
  return `${k.businessDate}|${k.locationId}`
}

export function registerSnapshotRunner(fn: Runner): void {
  runner = fn
}

export function enqueueSnapshotBuild(key: SnapshotKey, windowMs: number = DEFAULT_WINDOW_MS): void {
  const k = keyOf(key)
  const existing = pending.get(k)
  if (existing) {
    clearTimeout(existing)
    if (DEBUG) console.info(`[snapshot:queue] re-debounce ${k}`)
  } else if (DEBUG) {
    console.info(`[snapshot:queue] enqueue ${k}`)
  }
  const t = setTimeout(() => {
    pending.delete(k)
    if (!runner) {
      if (DEBUG) console.warn(`[snapshot:queue] no runner registered — dropping ${k}`)
      return
    }
    runner({ businessDate: key.businessDate, locationId: key.locationId }).catch((e) => {
      console.error(`[snapshot:queue] runner failed for ${k}`, e)
    })
  }, windowMs)
  pending.set(k, t)
}

/** Test/diagnostics only — drain all pending immediately. */
export function flushSnapshotQueue(): number {
  const n = pending.size
  for (const [k, t] of pending) {
    clearTimeout(t)
    pending.delete(k)
  }
  return n
}

export function getPendingCount(): number {
  return pending.size
}
