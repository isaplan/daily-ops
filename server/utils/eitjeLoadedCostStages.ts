/**
 * @registry-id: eitjeLoadedCostStages
 * @created: 2026-05-14T00:00:00.000Z
 * @last-modified: 2026-05-14T12:00:00.000Z
 * @description: MongoDB aggregation stages: normalized employee name, contract lookup,
 *   and resolved cost_per_hour (before nul-uren employer override — see eitjeLoadedCostEmployerStages).
 * @last-fix: [2026-05-16] members.cost_per_hour before inbox contracts (ADR-001)
 *
 * @adr-ref: ADR-001
 *
 * @architecture:
 *   - Name match against contracts is normalized (lower/trim/collapse-spaces).
 *   - Shared numeric guard: eitjeLoadedCostShared.aggIsNumeric
 *
 * @exports-to:
 *   ✓ server/services/eitjeRebuildAggregationService.ts
 */

import { aggIsNumeric } from './eitjeLoadedCostShared'

/**
 * Normalized employee_name addFields stage. Must be inserted BEFORE the cost lookups.
 */
export const EITJE_NORM_NAME_FIELD = {
  $addFields: {
    norm_employee_name: {
      $trim: {
        input: {
          $toLower: {
            $reduce: {
              input: {
                $split: [
                  {
                    $ifNull: [
                      '$rawApiResponse.employee_name',
                      { $ifNull: ['$rawApiResponse.user.name', ''] },
                    ],
                  },
                  ' ',
                ],
              },
              initialValue: '',
              in: {
                $cond: [
                  { $eq: ['$$value', ''] },
                  { $cond: [{ $eq: ['$$this', ''] }, '', '$$this'] },
                  { $cond: [{ $eq: ['$$this', ''] }, '$$value', { $concat: ['$$value', ' ', '$$this'] }] },
                ],
              },
            },
          },
        },
      },
    },
  },
}

export const EITJE_CONTRACT_CPH_LOOKUP = {
  $lookup: {
    from: 'inbox-eitje-contracts',
    let: { normName: '$norm_employee_name' },
    pipeline: [
      {
        $addFields: {
          _norm: {
            $trim: { input: { $toLower: { $ifNull: ['$employee_name', ''] } } },
          },
        },
      },
      { $match: { $expr: { $eq: ['$_norm', '$$normName'] } } },
      { $sort: { importedAt: -1 } },
      { $limit: 1 },
      { $project: { cost_per_hour: 1, hourly_rate: 1, contract_type: 1 } },
    ],
    as: 'contractDoc',
  },
}

/** Priority: memberDoc.cost_per_hour → contractDoc.cost_per_hour → null (ADR-001). */
export const EITJE_RESOLVE_COST_PER_HOUR_FIELDS = {
  $addFields: {
    cost_per_hour: {
      $let: {
        vars: {
          contractCph: { $arrayElemAt: ['$contractDoc.cost_per_hour', 0] },
          memberCph: { $arrayElemAt: ['$memberDoc.cost_per_hour', 0] },
        },
        in: {
          $cond: [
            aggIsNumeric('$$memberCph'),
            '$$memberCph',
            { $cond: [aggIsNumeric('$$contractCph'), '$$contractCph', null] },
          ],
        },
      },
    },
  },
}
