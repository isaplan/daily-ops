/**
 * @registry-id: eitjeLoadedCostShared
 * @created: 2026-05-14T00:00:00.000Z
 * @last-modified: 2026-05-14T12:00:00.000Z
 * @description: Shared constants and Mongo $expr helpers for Eitje loaded-cost aggregation.
 * @last-fix: [2026-05-14] Split from eitjeLoadedCostStages to keep modules under ~120 lines.
 *
 * @exports-to:
 *   ✓ server/utils/eitjeLoadedCostStages.ts
 *   ✓ server/utils/eitjeLoadedCostEmployerStages.ts
 */

export const LOADED_FALLBACK_RATIO = 1.36

/** True in aggregation when `path` is double/int/long/decimal (not missing/null). */
export const aggIsNumeric = (path: string): Record<string, unknown> => ({
  $in: [{ $type: path }, ['double', 'int', 'long', 'decimal']],
})
