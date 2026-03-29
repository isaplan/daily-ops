import { ObjectId } from 'mongodb'
import { getMenuItemsCollection } from '../../utils/db'
import { parseMenuFileToRows } from '../../utils/parseMenuFile'
import {
  extractDumpRows,
  productGroupFromFilename,
} from '../../utils/parseMenuDump'
import type { MenuItem, MenuImportResult } from '../../../types/menuItem'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

async function processOneFile(
  file: { data: Buffer; filename: string },
  coll: Awaited<ReturnType<typeof getMenuItemsCollection>>,
  now: Date,
  acc: { imported: number; updated: number; errors: Array<{ row: number; error: string }> }
): Promise<void> {
  const lower = file.filename.toLowerCase()
  const isCsv = lower.endsWith('.csv')
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls')
  const isPdf = lower.endsWith('.pdf')

  let rows: string[][]
  const parseResult = await parseMenuFileToRows(file.data, file.filename)
  if (!parseResult.success) {
    acc.errors.push({ row: 0, error: `${file.filename}: ${parseResult.error}` })
    return
  }
  rows = parseResult.rows

  const productGroup = productGroupFromFilename(file.filename)
  const dumpRows = extractDumpRows(rows, file.filename, productGroup)

  for (const row of dumpRows) {
    try {
      const doc: Omit<MenuItem, '_id'> = {
        productGroup: row.productGroup,
        sourceFile: row.sourceFile,
        rowIndex: row.rowIndex,
        data: row.data,
        createdAt: now,
        updatedAt: now,
      }
      const key = { productGroup: row.productGroup, sourceFile: row.sourceFile, rowIndex: row.rowIndex }
      const existing = await coll.findOne(key)
      if (existing) {
        await coll.updateOne(
          { _id: existing._id },
          { $set: { data: row.data, updatedAt: now } }
        )
        acc.updated++
      } else {
        await coll.insertOne({
          ...doc,
          _id: new ObjectId(),
        })
        acc.imported++
      }
    } catch (e) {
      acc.errors.push({
        row: row.rowIndex,
        error: e instanceof Error ? e.message : 'Insert/update failed',
      })
    }
  }
}

export default defineEventHandler(async (event): Promise<MenuImportResult> => {
  const form = await readMultipartFormData(event)
  if (!form || form.length === 0) {
    return { success: false, imported: 0, updated: 0, failed: 0, errors: [{ row: 0, error: 'No file uploaded' }] }
  }

  const files = form.filter((f) => f.name === 'file' && f.data && f.filename) as Array<{ name: string; data: Buffer; filename: string }>
  if (files.length === 0) {
    return { success: false, imported: 0, updated: 0, failed: 0, errors: [{ row: 0, error: 'Missing file or filename' }] }
  }

  for (const file of files) {
    if (file.data.length > MAX_FILE_SIZE) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [{ row: 0, error: `${file.filename} too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` }],
      }
    }
  }

  const now = new Date()
  const coll = await getMenuItemsCollection()
  const acc = { imported: 0, updated: 0, errors: [] as Array<{ row: number; error: string }> }

  for (const file of files) {
    await processOneFile(file, coll, now, acc)
  }

  return {
    success: acc.errors.length === 0,
    imported: acc.imported,
    updated: acc.updated,
    failed: acc.errors.length,
    errors: acc.errors,
  }
})
