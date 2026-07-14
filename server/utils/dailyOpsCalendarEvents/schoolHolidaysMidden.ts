/**
 * @registry-id: dailyOpsCalendarEventsSchoolMidden
 * @created: 2026-07-14T21:00:00.000Z
 * @last-modified: 2026-07-14T21:00:00.000Z
 * @description: Regio Midden school holidays (Den Haag / Zuid-Holland) — rijksoverheid.nl
 * @adr-ref: ADR-015
 *
 * @exports-to:
 * ✓ server/utils/dailyOpsCalendarEvents/seedCalendarEvents.ts
 */

import type { CalendarEvent } from '~/types/calendarEvent'

/** Official regio Midden school holiday ranges (schooljaar boundaries). */
const SCHOOL_HOLIDAYS_MIDDEN: Array<{ schoolYear: string; name: string; startDate: string; endDate: string }> = [
  { schoolYear: '2023-2024', name: 'Herfstvakantie', startDate: '2023-10-14', endDate: '2023-10-22' },
  { schoolYear: '2023-2024', name: 'Kerstvakantie', startDate: '2023-12-23', endDate: '2024-01-07' },
  { schoolYear: '2023-2024', name: 'Voorjaarsvakantie', startDate: '2024-02-17', endDate: '2024-02-25' },
  { schoolYear: '2023-2024', name: 'Meivakantie', startDate: '2024-04-27', endDate: '2024-05-05' },
  { schoolYear: '2023-2024', name: 'Zomervakantie', startDate: '2024-07-20', endDate: '2024-09-01' },
  { schoolYear: '2024-2025', name: 'Herfstvakantie', startDate: '2024-10-19', endDate: '2024-10-27' },
  { schoolYear: '2024-2025', name: 'Kerstvakantie', startDate: '2024-12-21', endDate: '2025-01-05' },
  { schoolYear: '2024-2025', name: 'Voorjaarsvakantie', startDate: '2025-02-15', endDate: '2025-02-23' },
  { schoolYear: '2024-2025', name: 'Meivakantie', startDate: '2025-04-26', endDate: '2025-05-04' },
  { schoolYear: '2024-2025', name: 'Zomervakantie', startDate: '2025-07-19', endDate: '2025-08-31' },
  { schoolYear: '2025-2026', name: 'Herfstvakantie', startDate: '2025-10-18', endDate: '2025-10-26' },
  { schoolYear: '2025-2026', name: 'Kerstvakantie', startDate: '2025-12-20', endDate: '2026-01-04' },
  { schoolYear: '2025-2026', name: 'Voorjaarsvakantie', startDate: '2026-02-14', endDate: '2026-02-22' },
  { schoolYear: '2025-2026', name: 'Meivakantie', startDate: '2026-04-25', endDate: '2026-05-03' },
  { schoolYear: '2025-2026', name: 'Zomervakantie', startDate: '2026-07-18', endDate: '2026-08-30' },
  { schoolYear: '2026-2027', name: 'Herfstvakantie', startDate: '2026-10-17', endDate: '2026-10-25' },
  { schoolYear: '2026-2027', name: 'Kerstvakantie', startDate: '2026-12-19', endDate: '2027-01-03' },
  { schoolYear: '2026-2027', name: 'Voorjaarsvakantie', startDate: '2027-02-13', endDate: '2027-02-21' },
  { schoolYear: '2026-2027', name: 'Meivakantie', startDate: '2027-05-01', endDate: '2027-05-09' },
  { schoolYear: '2026-2027', name: 'Zomervakantie', startDate: '2027-07-17', endDate: '2027-08-29' },
  { schoolYear: '2027-2028', name: 'Herfstvakantie', startDate: '2027-10-16', endDate: '2027-10-24' },
  { schoolYear: '2027-2028', name: 'Kerstvakantie', startDate: '2027-12-18', endDate: '2028-01-02' },
  { schoolYear: '2027-2028', name: 'Voorjaarsvakantie', startDate: '2028-02-19', endDate: '2028-02-27' },
  { schoolYear: '2027-2028', name: 'Meivakantie', startDate: '2028-04-22', endDate: '2028-04-30' },
  { schoolYear: '2027-2028', name: 'Zomervakantie', startDate: '2028-07-08', endDate: '2028-08-20' },
  { schoolYear: '2028-2029', name: 'Herfstvakantie', startDate: '2028-10-21', endDate: '2028-10-29' },
  { schoolYear: '2028-2029', name: 'Kerstvakantie', startDate: '2028-12-23', endDate: '2029-01-07' },
  { schoolYear: '2028-2029', name: 'Voorjaarsvakantie', startDate: '2029-02-10', endDate: '2029-02-18' },
  { schoolYear: '2028-2029', name: 'Meivakantie', startDate: '2029-04-21', endDate: '2029-04-29' },
  { schoolYear: '2028-2029', name: 'Zomervakantie', startDate: '2029-07-07', endDate: '2029-08-19' },
]

export function schoolHolidaysMidden(): CalendarEvent[] {
  return SCHOOL_HOLIDAYS_MIDDEN.map((row) => ({
    id: `school-midden-${row.startDate}`,
    startDate: row.startDate,
    endDate: row.endDate,
    type: 'school_holiday_midden' as const,
    title: `${row.name} (regio Midden)`,
    note: row.schoolYear,
  }))
}
