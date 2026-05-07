/**
 * POST /api/inbox/backfill-basis-reports — Remap all basis_report rows from parseddatas → inbox-bork-basis-report
 * Query: dryRun=1 — no DB writes; cleanupStaleLegacy=0 — skip deleting legacy Unknown/Unspecified rows without source_attachment_id
 */

import { backfillBasisReportsFromParsedData } from '../../services/basisReportBackfillService'

export default defineEventHandler(async (event) => {
  try {
    const q = getQuery(event)
    const dryRun = q.dryRun === 'true' || q.dryRun === '1'
    const cleanupStaleLegacy = !(q.cleanupStaleLegacy === 'false' || q.cleanupStaleLegacy === '0')

    const result = await backfillBasisReportsFromParsedData({ dryRun, cleanupStaleLegacy })

    return {
      success: true,
      dryRun,
      cleanupStaleLegacy,
      ...result,
    }
  } catch (err) {
    throw createError({
      statusCode: 500,
      statusMessage: err instanceof Error ? err.message : 'Basis report backfill failed',
    })
  }
})
