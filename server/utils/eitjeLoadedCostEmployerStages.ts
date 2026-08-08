/**
 * @registry-id: eitjeLoadedCostEmployerStages
 * @created: 2026-05-14T00:00:00.000Z
 * @last-modified: 2026-08-05T00:05:00.000Z
 * @description: Nul-uren employer cph override + per-shift loaded_cost for Eitje rebuild pipeline.
 * @last-fix: [2026-08-05] ADR-020: nul-uren 1.56 is fallback; employer loaded_cost must match Finance
 *
 * @adr-ref: ADR-001, ADR-020
 *
 * @exports-to:
 *   ✓ server/services/eitjeRebuildAggregationService.ts
 */

import { aggIsNumeric, LOADED_FALLBACK_RATIO } from './eitjeLoadedCostShared'

/**
 * When matched contract_type contains "nul", replace resolved cost_per_hour with
 * bruto hourly_rate × LOADED_FALLBACK_RATIO (employer cost per hour).
 */
export const EITJE_NUL_UREN_EMPLOYER_CPH_OVERRIDE = {
  $addFields: {
    cost_per_hour: {
      $cond: [
        {
          $and: [
            {
              $regexMatch: {
                input: {
                  $toString: {
                    $ifNull: [
                      { $arrayElemAt: ['$memberDoc.contract_type', 0] },
                      { $arrayElemAt: ['$contractDoc.contract_type', 0] },
                      '',
                    ],
                  },
                },
                regex: 'nul',
                options: 'i',
              },
            },
            aggIsNumeric('$hourly_rate'),
          ],
        },
        { $multiply: ['$hourly_rate', LOADED_FALLBACK_RATIO] },
        '$cost_per_hour',
      ],
    },
  },
}

export const EITJE_LOADED_COST_FIELDS = {
  $addFields: {
    loaded_cost: {
      $cond: [
        { $and: [aggIsNumeric('$hours'), aggIsNumeric('$cost_per_hour')] },
        { $multiply: ['$hours', '$cost_per_hour'] },
        {
          $cond: [
            { $and: [aggIsNumeric('$hours'), aggIsNumeric('$hourly_rate')] },
            { $multiply: ['$hours', { $multiply: ['$hourly_rate', LOADED_FALLBACK_RATIO] }] },
            0,
          ],
        },
      ],
    },
    loaded_cost_source: {
      $let: {
        vars: {
          contractType: {
            $toString: {
              $ifNull: [{ $arrayElemAt: ['$memberDoc.contract_type', 0] }, ''],
            },
          },
          memberCph: { $arrayElemAt: ['$memberDoc.cost_per_hour', 0] },
        },
        in: {
          $cond: [
            {
              $and: [
                { $regexMatch: { input: '$$contractType', regex: 'zzp', options: 'i' } },
                aggIsNumeric('$hourly_rate'),
              ],
            },
            'zzp-hourly-rate',
            {
              $cond: [
                {
                  $and: [
                    { $regexMatch: { input: '$$contractType', regex: 'nul', options: 'i' } },
                    aggIsNumeric('$hourly_rate'),
                  ],
                },
                'nul-uren-employer-1.56',
                {
                  $cond: [
                    aggIsNumeric('$$memberCph'),
                    'members',
                    { $cond: [aggIsNumeric('$hourly_rate'), 'fallback-1.56', 'none'] },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  },
}
