/**
 * Single source of truth for Eitje raw-data hours calculation.
 * Used by: hours-aggregated (raw fallback), hours-row-records, hours-consistency-check, hours-row-detail.
 * Changing this file updates all aggregation vs raw comparisons; run consistency check after changes.
 *
 * @registry-id: eitjeHours
 * @last-modified: 2026-05-11T15:00:00.000Z
 * @description: Shared hours $addFields + labor period from shift start (Amsterdam calendar day)
 * @last-fix: [2026-05-11] Labor period = Amsterdam date of ISO start — not Bork-style post-midnight revenue day
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

/**
 * Shift clock for labor bucketing: Eitje `start` (ISO). Fallbacks match `buildRawShiftDoc` in eitjeSyncService.
 * Period = Amsterdam **calendar date** of this instant (shifts start same service day; close-after-midnight does not change start date).
 */
export const EITJE_LABOR_SHIFT_START_FIELD: Record<string, unknown> = {
  shiftStart: {
    $ifNull: [
      { $toDate: '$rawApiResponse.start' },
      {
        $ifNull: [
          { $toDate: '$rawApiResponse.start_time' },
          {
            $ifNull: [
              { $toDate: '$rawApiResponse.started_at' },
              { $ifNull: [{ $toDate: '$rawApiResponse.from' }, { $toDate: '$date' }] },
            ],
          },
        ],
      },
    ],
  },
}

export const EITJE_LABOR_PERIOD_FROM_SHIFT_START_FIELD: Record<string, unknown> = {
  period: {
    $dateToString: { format: '%Y-%m-%d', date: '$shiftStart', timezone: 'Europe/Amsterdam' },
  },
}

export type UtcDayRange = { dayStart: Date; dayEnd: Date }

/** UTC day bounds for a YYYY-MM-DD string. Use for raw date matching so aggregation and raw use the same day. */
export function getUtcDayRange (dateStr: string): UtcDayRange {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayStart = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999))
  return { dayStart, dayEnd }
}

/** Normalize venue label for grouping / query params (matches Mongo `venueKey` logic below). */
export function normalizeEitjeHoursVenueName (raw: string): string {
  return raw.replace(/\u00a0/g, ' ').trim().toLowerCase()
}

/**
 * Merge labor rows for the same venue when `locationId` differs (unified ObjectId vs Eitje env id).
 * If `location_name` is empty, falls back to `id:<locationId>` so unnamed rows do not collapse together.
 */
export const EITJE_AGG_ADD_VENUE_KEY: { $addFields: Record<string, unknown> } = {
  $addFields: {
    venueKey: {
      $cond: [
        {
          $gt: [
            {
              $strLenCP: {
                $trim: {
                  input: {
                    $replaceAll: {
                      input: { $ifNull: ['$location_name', ''] },
                      find: '\u00a0',
                      replacement: ' ',
                    },
                  },
                },
              },
            },
            0,
          ],
        },
        {
          $toLower: {
            $trim: {
              input: {
                $replaceAll: {
                  input: { $ifNull: ['$location_name', ''] },
                  find: '\u00a0',
                  replacement: ' ',
                },
              },
            },
          },
        },
        { $concat: ['id:', { $toString: { $ifNull: ['$locationId', 'unknown'] } }] },
      ],
    },
  },
}
