import { getDb } from '../../../utils/db'
import { parseStaffPlusminInput } from '../../../utils/dailyOpsStaff/parseStaffPlusminInput'
import { fetchStaffPlusminSummary } from '../../../utils/dailyOpsStaff/fetchStaffPlusminSummary'
import type { DailyOpsStaffPlusminSummaryDto } from '~/types/daily-ops-staff'

export default defineEventHandler(async (event): Promise<DailyOpsStaffPlusminSummaryDto> => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const input = parseStaffPlusminInput(getQuery(event) as Record<string, unknown>)
  const db = await getDb()
  return fetchStaffPlusminSummary(db, input)
})
