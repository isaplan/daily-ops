/**
 * Legacy route — prefer dedicated inbox APIs:
 * /api/inbox/eitje/hours | contracts | finance
 * /api/inbox/bork/sales | product-mix | food-beverage | basis-report | sales-per-hour
 * /api/inbox/power-bi/reports
 */
import { getInboxImportTablePayload, parseInboxImportTableQuery } from '../../../utils/inbox/inboxImportTableQuery'

type LegacyType =
  | 'sales'
  | 'product_mix'
  | 'food_beverage'
  | 'basis_report'
  | 'product_sales_per_hour'
  | 'hours'
  | 'contracts'
  | 'finance'
  | 'bi'

const VALID: LegacyType[] = [
  'sales',
  'product_mix',
  'food_beverage',
  'basis_report',
  'product_sales_per_hour',
  'hours',
  'contracts',
  'finance',
  'bi',
]

export default defineEventHandler(async (event) => {
  try {
    const type = getRouterParam(event, 'type') as LegacyType
    if (!VALID.includes(type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid data type. Valid types: ${VALID.join(', ')}`,
      })
    }
    const q = getQuery(event)
    const data = await getInboxImportTablePayload(type, parseInboxImportTableQuery(q))
    return { success: true as const, data }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to fetch test data',
    })
  }
})
