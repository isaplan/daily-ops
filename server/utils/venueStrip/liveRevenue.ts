/**
 * @registry-id: dailyOpsVenueStripLiveRevenue
 * @created: 2026-06-06T18:00:00.000Z
 * @last-modified: 2026-07-01T21:30:00.000Z
 * @description: Open register-day helpers (revenue reads are snapshot-only on GET — ADR-004)
 * @last-fix: [2026-07-01] Removed live Bork GET overlay; headline from snapshot orderHourly
 * @adr-ref: ADR-004, ADR-010
 */

import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'

/** True when `ymd` is the open register business day (ADR-010). */
export function isTodayBusinessDate(ymd: string): boolean {
  return isOpenRegisterBusinessDate(ymd)
}
