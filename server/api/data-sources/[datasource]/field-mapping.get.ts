import { getDb } from '../../../utils/db'

type MappingDoc = {
  dataSource: 'eitje' | 'bork'
  sourceField: string
  targetField: string
  dataType: 'string' | 'number' | 'boolean' | 'date'
  transformation: string | null
  isRequired: boolean
  createdAt: Date
  updatedAt: Date
}

export default defineEventHandler(async (event) => {
  const dataSource = (event.context.params?.datasource || '').toLowerCase()
  if (dataSource !== 'eitje' && dataSource !== 'bork') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid datasource' })
  }

  const db = await getDb()
  const rows = await db
    .collection<MappingDoc>('data_source_mappings')
    .find({ dataSource: dataSource as 'eitje' | 'bork' })
    .sort({ sourceField: 1 })
    .toArray()

  return {
    success: true,
    mappings: rows.map(row => ({
      sourceField: row.sourceField,
      targetField: row.targetField,
      dataType: row.dataType,
      transformation: row.transformation,
      isRequired: Boolean(row.isRequired),
    })),
  }
})
