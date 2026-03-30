/**
 * Run integrity checks and fix (e.g. remove aggregation duplicates). Trigger: after sync, after aggregation, or manual GET.
 * Runs, fixes, returns. No schedule.
 */
import { runAndFix } from '../../services/dataIntegrityService'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const result = await runAndFix({
    startDate: q.startDate as string | undefined,
    endDate: q.endDate as string | undefined,
    rawOnly: q.rawOnly === '1' || q.rawOnly === 'true',
  })
  return { success: true, ...result }
})
