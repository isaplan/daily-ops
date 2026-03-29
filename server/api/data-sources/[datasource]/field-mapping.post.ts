import { getDb } from '../../../utils/db'

type MappingBody = {
  sourceField: string
  targetField?: string
  dataType?: 'string' | 'number' | 'boolean' | 'date'
  transformation?: string | null
  isRequired?: boolean
  delete?: boolean
}

export default defineEventHandler(async (event) => {
  const dataSource = (event.context.params?.datasource || '').toLowerCase()
  if (dataSource !== 'eitje' && dataSource !== 'bork') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid datasource' })
  }

  const body = await readBody<MappingBody>(event)
  if (!body?.sourceField?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'sourceField is required' })
  }

  const db = await getDb()
  const collection = db.collection('data_source_mappings')

  if (body.delete) {
    await collection.deleteOne({
      dataSource,
      sourceField: body.sourceField.trim(),
    })
    return { success: true, message: 'Mapping deleted' }
  }

  if (!body.targetField?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'targetField is required' })
  }

  const now = new Date()
  await collection.updateOne(
    {
      dataSource,
      sourceField: body.sourceField.trim(),
    },
    {
      $set: {
        targetField: body.targetField.trim(),
        dataType: body.dataType ?? 'string',
        transformation: body.transformation?.trim() || null,
        isRequired: Boolean(body.isRequired),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  )

  return { success: true, message: 'Mapping saved' }
})
