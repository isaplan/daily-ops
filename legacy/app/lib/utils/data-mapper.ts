/**
 * @registry-id: dataMapper
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Data mapper utilities - column matching, value normalization, validation
 * @last-fix: [2026-01-26] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/inbox.types.ts => FieldMapping type
 * 
 * @exports-to:
 *   ✓ app/lib/services/dataMappingService.ts => Uses data-mapper utilities
 */

import type { FieldMapping } from '@/lib/services/dataMappingService'

/**
 * Match source columns to target fields using fuzzy matching
 */
export function matchColumns(
  sourceColumns: string[],
  targetMappings: FieldMapping[]
): Map<string, string> {
  const columnMap = new Map<string, string>()

  for (const mapping of targetMappings) {
    // Try exact match first
    const exactMatch = sourceColumns.find(
      (col) => col.toLowerCase() === mapping.sourceColumn.toLowerCase()
    )

    if (exactMatch) {
      columnMap.set(exactMatch, mapping.targetField)
      continue
    }

    // Try partial match
    const partialMatch = sourceColumns.find((col) => {
      const colLower = col.toLowerCase()
      const sourceLower = mapping.sourceColumn.toLowerCase()
      return colLower.includes(sourceLower) || sourceLower.includes(colLower)
    })

    if (partialMatch) {
      columnMap.set(partialMatch, mapping.targetField)
    }
  }

  return columnMap
}

/**
 * Normalize value based on type
 */
export function normalizeValue(value: unknown, targetType?: 'string' | 'number' | 'date'): unknown {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (targetType === 'number') {
    const num = Number(value)
    return isNaN(num) ? null : num
  }

  if (targetType === 'date') {
    const date = new Date(value as string)
    return isNaN(date.getTime()) ? null : date
  }

  if (targetType === 'string') {
    return String(value).trim()
  }

  return value
}

/**
 * Apply validation rules to a row
 */
export function applyValidation(
  row: Record<string, unknown>,
  requiredFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const field of requiredFields) {
    if (row[field] === null || row[field] === undefined || row[field] === '') {
      errors.push(`Missing required field: ${field}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Generate mapping report
 */
export function generateMappingReport(
  totalRows: number,
  mappedRows: number,
  errors: Array<{ row: number; error: string }>
): {
  successRate: number
  totalRows: number
  mappedRows: number
  errorRows: number
  errors: Array<{ row: number; error: string }>
} {
  return {
    successRate: totalRows > 0 ? (mappedRows / totalRows) * 100 : 0,
    totalRows,
    mappedRows,
    errorRows: errors.length,
    errors,
  }
}
