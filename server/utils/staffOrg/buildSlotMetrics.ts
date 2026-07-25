/**
 * @registry-id: staffOrgBuildSlotMetrics
 * @created: 2026-07-22T18:00:00.000Z
 * @last-modified: 2026-07-22T18:15:00.000Z
 * @description: Re-export — SSOT is utils/staffOrg/buildSlotMetrics
 * @last-fix: [2026-07-22] Re-export shared util (ADR-016)
 * @adr-ref: ADR-016
 *
 * @exports-to:
 * ✓ server/api/staff-org/scenarios/[id].get.ts
 * ✓ server/api/staff-org/scenarios/[id].patch.ts
 */
export { buildSlotMetrics } from '~/utils/staffOrg/buildSlotMetrics'
