import { getDb } from '../../../utils/db'

type RawField = {
  field: string
  sampleValue: string
}

const asPrintable = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const flattenFields = (value: Record<string, unknown>, prefix = '', out: RawField[] = []): RawField[] => {
  for (const [key, raw] of Object.entries(value)) {
    if (key.startsWith('_')) continue
    const fieldName = prefix ? `${prefix}.${key}` : key
    if (
      raw === null ||
      raw === undefined ||
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean' ||
      raw instanceof Date
    ) {
      out.push({ field: fieldName, sampleValue: asPrintable(raw) })
      continue
    }
    if (Array.isArray(raw)) {
      out.push({ field: fieldName, sampleValue: asPrintable(raw[0]) })
      continue
    }
    if (typeof raw === 'object') {
      flattenFields(raw as Record<string, unknown>, fieldName, out)
    }
  }
  return out
}

export default defineEventHandler(async (event) => {
  const dataSource = (event.context.params?.datasource || '').toLowerCase()
  if (dataSource !== 'eitje' && dataSource !== 'bork') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid datasource' })
  }

  const db = await getDb()
  const collectionName = dataSource === 'eitje' ? 'eitje_raw_data' : 'bork_raw_data'
  const sample = await db.collection(collectionName).find({}).sort({ _id: -1 }).limit(1).next()
  const fields = sample ? flattenFields(sample as Record<string, unknown>).slice(0, 80) : []

  return { success: true, fields }
})
