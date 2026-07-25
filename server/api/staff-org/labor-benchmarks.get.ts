/**
 * @registry-id: staffOrgLaborBenchmarksGet
 * @created: 2026-07-23T10:40:00.000Z
 * @last-modified: 2026-07-23T10:45:00.000Z
 * @description: GET labor % + food/bev shares from accounting P&L for Staff Org seed
 * @last-fix: [2026-07-23] Drop setResponseHeader (no asyncContext)
 * @adr-ref: ADR-016
 */

import { buildStaffOrgLaborBenchmarks } from '~/server/utils/staffOrg/laborBenchmarks'

export default defineEventHandler(() => ({
  success: true,
  data: {
    year: 2025,
    venues: buildStaffOrgLaborBenchmarks(2025),
  },
}))
