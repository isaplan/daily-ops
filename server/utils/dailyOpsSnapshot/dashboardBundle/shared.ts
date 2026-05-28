/**
 * @registry-id: dailyOpsDashboardBundleShared
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: Shared helpers for snapshot dashboard bundle assembly
 * @adr-ref: ADR-004
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function locDayKey(date: string, locationId: string): string {
  return `${date}|${locationId}`
}
