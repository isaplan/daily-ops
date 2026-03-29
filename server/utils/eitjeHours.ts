/**
 * Single source of truth for Eitje raw-data hours calculation.
 * Used by: hours-aggregated (raw fallback), hours-row-records, hours-consistency-check.
 * Changing this file updates all aggregation vs raw comparisons; run consistency check after changes.
 *
 * @registry-id: eitjeHours
 * @description: Shared hours $addFields + UTC day range for date matching
 */

/** MongoDB $addFields expression: computes `hours` from extracted/rawApiResponse (same order everywhere). */
export const EITJE_HOURS_ADD_FIELDS = {
  hours: {
    $ifNull: [
      { $toDouble: '$extracted.hours' },
      {
        $ifNull: [
          { $toDouble: '$extracted.hoursWorked' },
          {
            $ifNull: [
              { $toDouble: '$rawApiResponse.hours' },
              {
                $ifNull: [
                  { $toDouble: '$rawApiResponse.hours_worked' },
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$rawApiResponse.start', null] },
                          { $ne: ['$rawApiResponse.end', null] }
                        ]
                      },
                      {
                        $subtract: [
                          {
                            $divide: [
                              {
                                $subtract: [
                                  { $toDate: '$rawApiResponse.end' },
                                  { $toDate: '$rawApiResponse.start' }
                                ]
                              },
                              3600000
                            ]
                          },
                          { $divide: [{ $ifNull: [{ $toDouble: '$rawApiResponse.break_minutes' }, 0] }, 60] }
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
} as const

export type UtcDayRange = { dayStart: Date; dayEnd: Date }

/** UTC day bounds for a YYYY-MM-DD string. Use for raw date matching so aggregation and raw use the same day. */
export function getUtcDayRange (dateStr: string): UtcDayRange {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayStart = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
  return { dayStart, dayEnd }
}
