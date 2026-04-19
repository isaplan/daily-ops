import { Buffer } from 'node:buffer'
import { documentParserService } from '../../services/documentParserService'

const MAX = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file' && f.data && f.filename)
  if (!file?.data || !file.filename) {
    return { success: false, error: 'No file provided' }
  }
  if (file.data.length > MAX) {
    return { success: false, error: 'File size exceeds 10MB limit' }
  }

  const buffer = Buffer.from(file.data)
  const mime = file.type || 'application/octet-stream'

  const parseResult = await documentParserService.parseDocument({
    fileName: file.filename,
    mimeType: mime,
    data: mime.includes('csv') || file.filename.toLowerCase().endsWith('.csv')
      ? buffer.toString('utf-8')
      : buffer,
    autoDetectType: true,
  })

  return { success: parseResult.success, data: parseResult }
})
