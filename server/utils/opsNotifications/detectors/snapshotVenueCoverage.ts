/**
 * @registry-id: detectSnapshotVenueCoverage
 * @created: 2026-07-13T01:12:00.000Z
 * @last-modified: 2026-07-13T01:12:00.000Z
 * @description: Alert if snapshot coverage is incomplete for any businessDate (missing any venue from 3).
 *   Per VENUE_STRIP_LOCATIONS constant — if snapshot master exists for N < 3 venues on a date, flag it.
 * @adr-ref: ADR-004 (snapshot must cover all venues or Daily Ops GET shows silently partial data)
 * @exports-to:
 *   ✓ server/utils/opsNotifications/runOpsNotificationScan.ts
 */

import { VENUE_STRIP_LOCATIONS } from '../../venueStrip/constants'
import { buildNotificationItem } from '../notificationItem'
import type { OpsNotificationDto } from '~/types/ops-notifications'
import { snapKey, type OpsScanContext } from '../scanContext'

export function detectSnapshotVenueCoverageNotifications(
  ctx: OpsScanContext,
): OpsNotificationDto[] {
  const items: OpsNotificationDto[] = []
  const expectedVenues = new Set(VENUE_STRIP_LOCATIONS.map((v) => v.locationId))

  // Group masters by businessDate
  const mastersByDate = new Map<string, Set<string>>()
  for (const key of ctx.masterKeys) {
    const [businessDate, locationId] = key.split(':::') as [string, string]
    if (!mastersByDate.has(businessDate)) {
      mastersByDate.set(businessDate, new Set())
    }
    mastersByDate.get(businessDate)!.add(locationId)
  }

  // Check each date: if present in masters, must have all 3 venues
  for (const [businessDate, venuesPresent] of mastersByDate) {
    if (venuesPresent.size < expectedVenues.size) {
      const missingVenues = Array.from(expectedVenues).filter((vid) => !venuesPresent.has(vid))
      const missingNames = missingVenues
        .map((vid) => VENUE_STRIP_LOCATIONS.find((v) => v.locationId === vid)?.locationName ?? vid)
        .join(', ')

      items.push(
        buildNotificationItem({
          kind: 'snapshot_venue_coverage_incomplete',
          businessDate,
          locationId: 'all', // Not per-venue; indicates 'all' bundle is incomplete
          locationName: 'All venues',
          message: `Snapshot coverage incomplete for ${businessDate}: built ${venuesPresent.size}/${expectedVenues.size} venues. Missing: ${missingNames}. Daily Ops GET may show silently partial data.`,
          fixHint: `pnpm snapshots:backfill -- --start ${businessDate} --end ${businessDate}`,
          severity: 'warning',
          meta: { built: venuesPresent.size, expected: expectedVenues.size, missing: missingVenues },
        }),
      )
    }
  }

  return items
}
