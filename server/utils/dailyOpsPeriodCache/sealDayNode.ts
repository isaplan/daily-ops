/**
 * @registry-id: dailyOpsPeriodCacheSealDayNode
 * @created: 2026-08-08T21:20:00.000Z
 * @last-modified: 2026-08-08T21:20:00.000Z
 * @description: Seal day period-cache nodes (open vs ops_sealed) via register business day
 * @last-fix: [2026-08-08] Apply open-register status + inbox lead-source rules
 * @adr-ref: ADR-010, ADR-023
 *
 * @exports-to:
 * ✓ scripts/backfill-period-cache.ts
 * ✓ server/utils/dailyOpsPeriodCache/cascadePeriod.ts
 */

import type { Db } from 'mongodb'
import type { DailyOpsPeriodNode, DailyOpsPeriodStatus } from '~/types/daily-ops-period-cache'
import { isOpenRegisterBusinessDate } from '~/utils/dailyOpsBusinessDate'
import {
  aggregateVenueDayNodes,
  buildDayNode,
} from './buildDayNode'
import { upsertPeriodNode } from './store'
import { VENUE_STRIP_LOCATIONS } from '../venueStrip/constants'

function applySealStatus (node: DailyOpsPeriodNode): DailyOpsPeriodNode {
  const open = isOpenRegisterBusinessDate(node.businessDateStart)
  let status: DailyOpsPeriodStatus
  if (open) {
    status = 'open'
  } else if (node.revenue.leadSource === 'inbox_digest') {
    status = 'ops_sealed'
  } else if (node.revenue.exVat > 0) {
    // Closed day with Bork/benchmark headline — still ops-usable
    status = 'ops_sealed'
  } else {
    status = 'partial'
  }
  return { ...node, status }
}

export type SealDayResult = {
  written: number
  errors: string[]
  nodes: DailyOpsPeriodNode[]
}

/**
 * Build + seal day nodes for all venues + combined for one business date.
 */
export async function sealDayNodesForDate (
  db: Db,
  businessDate: string,
): Promise<SealDayResult> {
  const errors: string[] = []
  const venueNodes: DailyOpsPeriodNode[] = []

  for (const venue of VENUE_STRIP_LOCATIONS) {
    const { node, error } = await buildDayNode(db, {
      businessDate,
      locationId: venue.locationId,
    })
    if (!node) {
      errors.push(error ?? `Failed ${businessDate} ${venue.locationId}`)
      continue
    }
    const sealed = applySealStatus(node)
    await upsertPeriodNode(db, sealed)
    venueNodes.push(sealed)
  }

  if (venueNodes.length === 0) {
    return { written: 0, errors, nodes: [] }
  }

  const combined = applySealStatus(
    aggregateVenueDayNodes(venueNodes, businessDate),
  )
  await upsertPeriodNode(db, combined)

  return {
    written: venueNodes.length + 1,
    errors,
    nodes: [...venueNodes, combined],
  }
}
