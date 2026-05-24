/**
 * @registry-id: eitjeLoadedCostShared
 * @created: 2026-05-14T00:00:00.000Z
 * @last-modified: 2026-05-14T12:00:00.000Z
 * @description: Shared constants and Mongo $expr helpers for Eitje loaded-cost aggregation.
 * @last-fix: [2026-05-21] Nul-uren / fallback loaded ratio 1.36 → 1.56
 *
 * @exports-to:
 *   ✓ server/utils/eitjeLoadedCostStages.ts
 *   ✓ server/utils/eitjeLoadedCostEmployerStages.ts
 */

/** Employer loaded-cost multiplier when `cost_per_hour` is missing (nul-uren and fallback). */
export const LOADED_FALLBACK_RATIO = 1.56

/** True in aggregation when `path` is double/int/long/decimal (not missing/null). */
export const aggIsNumeric = (path: string): Record<string, unknown> => ({
  $in: [{ $type: path }, ['double', 'int', 'long', 'decimal']],
})
