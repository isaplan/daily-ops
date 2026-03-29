/**
 * Run data integrity checks on demand.
 * GET /api/data-integrity/run?startDate=2025-01-01&endDate=2025-01-31&checks=duplicates_raw,normalization,sums
 * checks: comma-separated, or omit for all (duplicates_raw, duplicates_aggregation, normalization, sums)
 */
import { runIntegrityChecks } from '../../services/dataIntegrityService'
import type { IntegrityCheckKind } from '../../services/dataIntegrityService'

const VALID_CHECKS: IntegrityCheckKind[] = ['duplicates_raw', 'duplicates_aggregation', 'normalization', 'sums']

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const startDate = query.startDate as string | undefined
    const endDate = query.endDate as string | undefined
    const checksParam = query.checks as string | undefined
    const endpoint = (query.endpoint as string) || 'time_registration_shifts'
    const duplicateLimit = query.duplicateLimit != null ? Number(query.duplicateLimit) : 50
    const sumsTolerance = query.sumsTolerance != null ? Number(query.sumsTolerance) : 0.02

    let checks: IntegrityCheckKind[] | undefined
    if (checksParam) {
      const requested = checksParam.split(',').map((c) => c.trim()).filter(Boolean)
      const valid = requested.filter((c) => VALID_CHECKS.includes(c as IntegrityCheckKind)) as IntegrityCheckKind[]
      if (valid.length > 0) checks = valid
    }

    const report = await runIntegrityChecks({
      startDate,
      endDate,
      endpoint,
      checks,
      duplicateLimit,
      sumsTolerance,
    })

    return { success: true, report }
  } catch (error) {
    console.error('[data-integrity/run]', error)
    throw createError({
      statusCode: 500,
      message: 'Integrity check failed',
    })
  }
})
