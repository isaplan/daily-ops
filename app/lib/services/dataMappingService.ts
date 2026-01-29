/**
 * @registry-id: dataMappingService
 * @created: 2026-01-26T00:00:00.000Z
 * @last-modified: 2026-01-29T00:00:00.000Z
 * @description: Data mapping service - maps parsed document data to MongoDB collections
 * @last-fix: [2026-01-29] BOM stripped in CSV parser (transformHeader); fixed required-field fallbacks (Date/Datum); using getDatabase() for consistent BSON driver
 * 
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/types/inbox.types.ts => DocumentType, ParsedData types
 *   - app/lib/utils/document-classifier.ts => Document type classification
 * 
 * @exports-to:
 *   ✓ app/api/inbox/process/route.ts => Maps parsed data to collections
 *   ✓ app/lib/services/inboxService.ts => Uses dataMappingService
 */

import { getDatabase } from '@/lib/mongodb/v2-connection'
import type { DocumentType, ParsedData, CreateParsedDataDto } from '@/lib/types/inbox.types'
import { ObjectId, type Db } from 'mongodb'

export interface MappingResult {
  success: boolean
  mappedToCollection: string
  matchedRecords: number
  createdRecords: number
  updatedRecords: number
  failedRecords: number
  errors: Array<{ row: number; error: string }>
}

export interface FieldMapping {
  sourceColumn: string
  targetField: string
  transform?: (value: unknown) => unknown
  required?: boolean
}

/**
 * Field mappings for each document type
 * Based on actual Eitje CSV structure from data-sources/
 */
const FIELD_MAPPINGS: Record<DocumentType, FieldMapping[]> = {
  hours: [
    // Eitje Hours CSV columns (Dutch)
    { sourceColumn: 'datum', targetField: 'date', required: true, transform: (v) => parseDate(v as string) },
    { sourceColumn: 'naam', targetField: 'employee_name', required: true },
    { sourceColumn: 'naam van vestiging', targetField: 'location_name', required: true },
    { sourceColumn: 'team naam', targetField: 'team_name' },
    { sourceColumn: 'type', targetField: 'shift_type' },
    { sourceColumn: 'uren', targetField: 'hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'gerealizeerde loonkosten', targetField: 'realized_labor_costs', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'Loonkosten per uur', targetField: 'cost_per_hour', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'contracttype', targetField: 'contract_type' },
    { sourceColumn: 'uurloon', targetField: 'hourly_rate', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'support ID', targetField: 'support_id', transform: (v) => String(v) },
    // English fallbacks (only one date column required: datum or Date or Datum)
    { sourceColumn: 'Date', targetField: 'date', transform: (v) => parseDate(v as string) },
    { sourceColumn: 'Datum', targetField: 'date', transform: (v) => parseDate(v as string) },
    { sourceColumn: 'Employee', targetField: 'employee_name' },
    { sourceColumn: 'Hours', targetField: 'hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'Location', targetField: 'location_name' },
  ],
  contracts: [
    // Eitje Contracts CSV columns (Dutch)
    { sourceColumn: 'naam', targetField: 'employee_name', required: true },
    { sourceColumn: 'contracttype', targetField: 'contract_type', required: true },
    { sourceColumn: 'uurloon', targetField: 'hourly_rate', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'wekelijkse contracturen', targetField: 'weekly_contract_hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'contractvestiging', targetField: 'contract_location' },
    { sourceColumn: 'Loonkosten per uur', targetField: 'cost_per_hour', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'eind plus/min saldo', targetField: 'end_balance', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'eind verlofsaldo', targetField: 'end_leave_balance', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: '* totaal gewerkte dagen', targetField: 'total_worked_days', transform: (v) => Number(v) || 0 },
    { sourceColumn: '* totaal gewerkte uren', targetField: 'total_worked_hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: '* ziekteuren', targetField: 'sick_hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: '* bijzonder verlofuren', targetField: 'special_leave_hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'maandelijkse contracturen', targetField: 'monthly_contract_hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'contracturen in periode', targetField: 'contract_hours_in_period', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'vloer ID', targetField: 'floor_id', transform: (v) => String(v) },
    { sourceColumn: 'Nmbrs ID', targetField: 'nmbrs_id', transform: (v) => String(v) },
    { sourceColumn: 'e-mailadres', targetField: 'email' },
    { sourceColumn: 'verjaardag', targetField: 'birthday', transform: (v) => (typeof v === 'string' && v.trim() ? v.trim() : null) },
    { sourceColumn: 'achternaam', targetField: 'last_name' },
    { sourceColumn: 'voornaam', targetField: 'first_name' },
    { sourceColumn: 'support ID', targetField: 'support_id', transform: (v) => String(v) },
    // English fallbacks
    { sourceColumn: 'Name', targetField: 'employee_name' },
    { sourceColumn: 'ContractType', targetField: 'contract_type' },
    { sourceColumn: 'StartDate', targetField: 'start_date', transform: (v) => parseDate(v as string) },
  ],
  finance: [
    { sourceColumn: 'datum', targetField: 'date', required: true, transform: (v) => parseDate(v as string) },
    { sourceColumn: 'Date', targetField: 'date', transform: (v) => parseDate(v as string) },
    { sourceColumn: 'naam van vestiging', targetField: 'location_name' },
    { sourceColumn: 'omzetgroep naam', targetField: 'revenue_group_name' },
    { sourceColumn: 'gerealiseerde arbeidsproductiviteit', targetField: 'labor_productivity', transform: (v) => Number(v) || 0 },
    { sourceColumn: 'gerealiseerde loonkosten', targetField: 'realized_labor_costs', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'gerealiseerde loonkosten percentage', targetField: 'labor_costs_percentage', transform: (v) => Number(v) || 0 },
    { sourceColumn: 'gewerkte uren', targetField: 'hours', transform: (v) => parseTimeToHours(v as string) },
    { sourceColumn: 'gerealiseerde omzet', targetField: 'realized_revenue', transform: (v) => parseEuro(v as string) },
    { sourceColumn: 'support ID', targetField: 'support_id', transform: (v) => String(v) },
    { sourceColumn: 'Amount', targetField: 'amount', transform: (v) => Number(v) || 0 },
    { sourceColumn: 'Description', targetField: 'description' },
    { sourceColumn: 'Category', targetField: 'category' },
  ],
  sales: [
    // Bork Sales CSV columns (expected structure - to be confirmed with first file)
    { sourceColumn: 'Date', targetField: 'date', required: true, transform: (v) => parseDate(v as string) },
    { sourceColumn: 'Datum', targetField: 'date', required: true, transform: (v) => parseDate(v as string) },
    { sourceColumn: 'Product', targetField: 'product_name' },
    { sourceColumn: 'Productnaam', targetField: 'product_name' },
    { sourceColumn: 'Quantity', targetField: 'quantity', transform: (v) => Number(v) || 0 },
    { sourceColumn: 'Aantal', targetField: 'quantity', transform: (v) => Number(v) || 0 },
    { sourceColumn: 'Revenue', targetField: 'revenue', transform: (v) => parseEuro(v as string) || Number(v) || 0 },
    { sourceColumn: 'Omzet', targetField: 'revenue', transform: (v) => parseEuro(v as string) || Number(v) || 0 },
    { sourceColumn: 'Salesperson', targetField: 'salesperson_name' },
    { sourceColumn: 'Verkoper', targetField: 'salesperson_name' },
    { sourceColumn: 'Category', targetField: 'category' },
    { sourceColumn: 'Categorie', targetField: 'category' },
  ],
  payroll: [],
  bi: [],
  other: [],
  formitabele: [],
  pasy: [],
  coming_soon: [],
}

/**
 * Collection names for each document type
 */
const COLLECTION_NAMES: Record<DocumentType, string> = {
  hours: 'test-eitje-hours',
  contracts: 'test-eitje-contracts',
  finance: 'test-eitje-finance',
  sales: 'bork_sales',
  payroll: 'payroll',
  bi: 'power_bi_exports',
  other: 'other_documents',
  formitabele: 'formitabele',
  pasy: 'pasy',
  coming_soon: 'coming_soon',
}

/**
 * Parse date from various formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  // Try DD/MM/YYYY format (Eitje format)
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
  }

  // Try ISO format
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    return date
  }

  return null
}

/**
 * Parse time string (HH:MM) to decimal hours
 */
function parseTimeToHours(timeStr: string): number {
  if (!timeStr || timeStr.trim() === '') return 0

  // Handle "HH:MM" format
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const [, hours, minutes] = timeMatch
    return parseInt(hours, 10) + parseInt(minutes, 10) / 60
  }

  // Try to parse as number
  const num = Number(timeStr)
  return isNaN(num) ? 0 : num
}

/**
 * Parse Euro currency string (€123,45 or €123.45) to number.
 * Strips € (U+20AC), replacement char (U+FFFD), and Windows-1252 euro (U+0080).
 * Accepts string or number (CSV parser may pass numbers).
 */
function parseEuro(euroStr: string | number | null | undefined): number {
  if (euroStr == null) return 0
  if (typeof euroStr === 'number') return isNaN(euroStr) ? 0 : euroStr
  const str = String(euroStr)
  if (!str || str.trim() === '') return 0

  // Remove € and common export variants (unknown icon / broken encoding)
  let cleaned = str.replace(/[\u20AC\uFFFD\u0080]/g, '').replace(/\s/g, '').trim()

  // Handle "n.v.t." or empty values
  if (cleaned.toLowerCase().includes('n.v.t') || cleaned === '') return 0

  // Replace comma with dot for decimal
  cleaned = cleaned.replace(',', '.')

  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
}

/** Get value from row by key, with case-insensitive fallback (BOM stripped by CSV parser, so headers like "datum" match both "Datum" and "datum"). */
function getRowValue(row: Record<string, unknown>, sourceColumn: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, sourceColumn)) return row[sourceColumn]
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === sourceColumn.trim().toLowerCase())
  return key !== undefined ? row[key] : undefined
}

class DataMappingService {
  /**
   * Map parsed data to MongoDB collection.
   * @param db - Optional DB instance (e.g. mongoose.connection.db) so the collection is created in the same DB as the rest of the app.
   */
  async mapToCollection(
    parsedData: CreateParsedDataDto,
    documentType: DocumentType,
    db?: Db
  ): Promise<MappingResult> {
    // Handle "coming soon" types
    if (documentType === 'formitabele' || documentType === 'pasy' || documentType === 'coming_soon') {
      return {
        success: false,
        mappedToCollection: COLLECTION_NAMES[documentType],
        matchedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: parsedData.rowsProcessed,
        errors: [
          {
            row: 0,
            error: `Document type "${documentType}" is not yet supported (coming soon)`,
          },
        ],
      }
    }

    const collectionName = COLLECTION_NAMES[documentType]
    const fieldMappings = FIELD_MAPPINGS[documentType]

    if (fieldMappings.length === 0) {
      return {
        success: false,
        mappedToCollection: collectionName,
        matchedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: parsedData.rowsProcessed,
        errors: [{ row: 0, error: `No field mappings defined for document type: ${documentType}` }],
      }
    }

    try {
      const database = db ?? (await getDatabase())
      const collection = database.collection(collectionName)

      const mappedRows: Record<string, unknown>[] = []
      const errors: Array<{ row: number; error: string }> = []

      // Map each row
      parsedData.data.rows.forEach((row, index) => {
        try {
          const mappedRow: Record<string, unknown> = {
            _id: new ObjectId(),
            source: 'inbox',
            importedAt: new Date(),
          }

          // Apply field mappings (case-insensitive column match for CSV headers)
          let hasRequiredFields = true
          for (const mapping of fieldMappings) {
            const sourceValue = getRowValue(row, mapping.sourceColumn)

            // Check required fields
            if (mapping.required && (sourceValue === null || sourceValue === undefined || sourceValue === '')) {
              errors.push({
                row: index + 1,
                error: `Missing required field: ${mapping.sourceColumn}`,
              })
              hasRequiredFields = false
              break
            }

            // Apply transformation if provided
            if (sourceValue !== null && sourceValue !== undefined && sourceValue !== '') {
              mappedRow[mapping.targetField] = mapping.transform
                ? mapping.transform(sourceValue)
                : sourceValue
            }
          }

          if (hasRequiredFields) {
            mappedRows.push(mappedRow)
          }
        } catch (error) {
          errors.push({
            row: index + 1,
            error: error instanceof Error ? error.message : 'Unknown mapping error',
          })
        }
      })

      // Insert mapped rows
      let createdRecords = 0
      let updatedRecords = 0
      let matchedRecords = 0

      if (mappedRows.length > 0) {
        // Use bulk insert with upsert logic
        const operations = mappedRows.map((row) => ({
          updateOne: {
            filter: this.getUniqueFilter(row, documentType),
            update: { $set: row },
            upsert: true,
          },
        }))

        const result = await collection.bulkWrite(operations)
        createdRecords = result.upsertedCount || 0
        updatedRecords = result.modifiedCount || 0
        matchedRecords = result.matchedCount || 0
      }

      return {
        success: errors.length < parsedData.rowsProcessed,
        mappedToCollection: collectionName,
        matchedRecords,
        createdRecords,
        updatedRecords,
        failedRecords: errors.length,
        errors,
      }
    } catch (error) {
      return {
        success: false,
        mappedToCollection: collectionName,
        matchedRecords: 0,
        createdRecords: 0,
        updatedRecords: 0,
        failedRecords: parsedData.rowsProcessed,
        errors: [
          {
            row: 0,
            error: error instanceof Error ? error.message : 'Unknown database error',
          },
        ],
      }
    }
  }

  /**
   * Get unique filter for upsert operations (document-type specific)
   */
  private getUniqueFilter(row: Record<string, unknown>, documentType: DocumentType): Record<string, unknown> {
    switch (documentType) {
      case 'hours':
        // Unique by date + employee_name + location_name + shift_type (Eitje format)
        return {
          date: row.date,
          employee_name: row.employee_name,
          location_name: row.location_name,
          shift_type: row.shift_type || 'gewerkte uren',
        }
      case 'contracts':
        // Unique by employee_name + support_id (Eitje format)
        return {
          employee_name: row.employee_name,
          support_id: row.support_id,
        }
      case 'sales':
        // Unique by date + product_name (Bork format - to be confirmed)
        return {
          date: row.date,
          product_name: row.product_name,
        }
      case 'finance':
        // Unique by date + location_name + support_id (Eitje finance)
        return {
          date: row.date,
          location_name: row.location_name,
          support_id: row.support_id,
        }
      default:
        // Default: use _id if available, otherwise all fields
        return row._id ? { _id: row._id } : row
    }
  }

  /**
   * Validate mapped data before storing
   */
  validateMappedData(
    mappedRow: Record<string, unknown>,
    documentType: DocumentType
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    switch (documentType) {
      case 'hours':
        if (!mappedRow.date) errors.push('Missing date')
        if (!mappedRow.employee_name) errors.push('Missing employee_name')
        if (mappedRow.hours && typeof mappedRow.hours !== 'number') {
          errors.push('Hours must be a number')
        }
        break
      case 'contracts':
        if (!mappedRow.employee_name) errors.push('Missing employee_name')
        break
      case 'sales':
        if (!mappedRow.date) errors.push('Missing date')
        if (mappedRow.revenue && typeof mappedRow.revenue !== 'number') {
          errors.push('Revenue must be a number')
        }
        break
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

export const dataMappingService = new DataMappingService()
