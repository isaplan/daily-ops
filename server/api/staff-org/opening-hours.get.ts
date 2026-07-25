/**
 * @registry-id: api/staff-org/opening-hours.get
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:00:00.000Z
 * @description: GET /api/staff-org/opening-hours — day/evening slot lengths per venue
 * @last-fix: [2026-07-22] Initial opening-hours wrapper
 * @adr-ref: ADR-016
 */

import { buildOpeningSlotHours, STAFF_ORG_SLOT_CUT } from '~/server/utils/staffOrg/buildOpeningSlots'

export default defineEventHandler(() => {
  return {
    success: true,
    data: {
      slotCut: STAFF_ORG_SLOT_CUT,
      slots: buildOpeningSlotHours(),
    },
  }
})
