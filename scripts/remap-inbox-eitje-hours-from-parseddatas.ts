/**
 * Re-run dataMappingService for every Eitje hours attachment already stored in `parseddatas`.
 * Use after fixing `parseTimeToHours` (comma decimals) so `inbox-eitje-hours` gets real hour values.
 *
 * Usage:
 *   npx tsx scripts/remap-inbox-eitje-hours-from-parseddatas.ts
 *   npx tsx scripts/remap-inbox-eitje-hours-from-parseddatas.ts --wipe
 *     (--wipe: delete all inbox-eitje-hours first — use after changing upsert keys)
 *   Sets sourceEmailReceivedAt from inboxemails + parsedDataCreatedAt so cron hour ≠ remap wall clock.
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (same as app — server/utils/db loads .env / .env.local)
 */
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { ObjectId } from 'mongodb'
import type { CreateParsedDataDto } from '../types/inbox'
import { dataMappingService } from '../server/services/dataMappingService'
import { updateParsedData } from '../server/services/inboxRepository'

function loadDotEnv () {
  for (const file of ['.env.local', '.env']) {
    const p = resolve(process.cwd(), file)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  }
}

loadDotEnv()

async function main () {
  const wipe = process.argv.includes('--wipe')
  const { getDb } = await import('../server/utils/db')
  const db = await getDb()

  if (wipe) {
    const r = await db.collection('inbox-eitje-hours').deleteMany({})
    console.log(`[remap-eitje-hours] --wipe: removed ${r.deletedCount} documents from inbox-eitje-hours`)
  }

  const parsedCol = db.collection('parseddatas')
  const cursor = parsedCol.find({ documentType: 'hours' }).sort({ extractedAt: 1, _id: 1 })
  const parsedDocs = await cursor.toArray()

  console.log(`[remap-eitje-hours] Found ${parsedDocs.length} parseddatas with documentType=hours`)

  let ok = 0
  let bad = 0
  let totalCreated = 0
  let totalUpdated = 0
  let totalMatched = 0

  for (const parsed of parsedDocs) {
    const id = String(parsed._id)
    const rows = (parsed.data as { rows?: Record<string, unknown>[] } | undefined)?.rows ?? []
    const headers =
      (parsed.data as { headers?: string[] } | undefined)?.headers ?? []

    if (rows.length === 0) {
      console.warn(`[remap-eitje-hours] Skip ${id}: no rows`)
      bad++
      continue
    }

    let sourceEmailReceivedAt: Date | null | undefined
    try {
      const emailDoc = await db.collection('inboxemails').findOne({
        _id: parsed.emailId instanceof ObjectId ? parsed.emailId : new ObjectId(String(parsed.emailId)),
      })
      const ra = emailDoc?.receivedAt
      sourceEmailReceivedAt =
        ra instanceof Date ? ra : ra != null ? new Date(String(ra)) : undefined
    } catch {
      sourceEmailReceivedAt = undefined
    }

    const pca = parsed.created_at
    const parsedDataCreatedAt =
      pca instanceof Date ? pca : pca != null ? new Date(String(pca)) : undefined

    const dto: CreateParsedDataDto = {
      attachmentId: String(parsed.attachmentId),
      emailId: String(parsed.emailId),
      documentType: 'hours',
      format: (parsed.format as CreateParsedDataDto['format']) ?? 'csv',
      rowsProcessed: Number(parsed.rowsProcessed ?? rows.length),
      rowsValid: Number(parsed.rowsValid ?? rows.length),
      rowsFailed: 0,
      sourceEmailReceivedAt: sourceEmailReceivedAt ?? null,
      parsedDataCreatedAt: parsedDataCreatedAt ?? null,
      data: {
        headers,
        rows,
        metadata: (parsed.data as { metadata?: Record<string, unknown> })?.metadata,
      },
    }

    try {
      const mappingResult = await dataMappingService.mapToCollection(dto, 'hours')
      totalCreated += mappingResult.createdRecords
      totalUpdated += mappingResult.updatedRecords
      totalMatched += mappingResult.matchedRecords

      await updateParsedData(id, {
        mapping: {
          mappedToCollection: mappingResult.mappedToCollection,
          matchedRecords: mappingResult.matchedRecords,
          createdRecords: mappingResult.createdRecords,
          updatedRecords: mappingResult.updatedRecords,
        },
        rowsValid: mappingResult.createdRecords + mappingResult.updatedRecords,
        rowsFailed: mappingResult.failedRecords,
        validationErrors: mappingResult.errors.map((e) => ({
          row: e.row,
          column: '',
          error: e.error,
        })),
      })

      if (!mappingResult.success || mappingResult.errors.length > 0) {
        console.warn(
          `[remap-eitje-hours] ${id}: success=${mappingResult.success} rowErrors=${mappingResult.errors.length} (first: ${mappingResult.errors[0]?.error ?? '—'})`,
        )
      }
      if (mappingResult.success) ok++
      else bad++
    } catch (e) {
      bad++
      console.error(`[remap-eitje-hours] ${id}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(
    `[remap-eitje-hours] Done. parsedDocs ok=${ok} failed=${bad} | bulkWrite created≈${totalCreated} modified/matched≈${totalUpdated + totalMatched} (see per-doc mapping in parseddatas)`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
