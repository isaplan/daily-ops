/**
 * For each `Unspecified` basis report, dump:
 *  - email subject + from/to + raw filename
 *  - XLSX parsed sheet list (metadata.sheets)
 *  - first 30 rows of parsed cells
 *  - any text matching venue keywords anywhere in the parsed rows
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'

function loadDotEnv() {
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

const VENUE_HINT = /kinsbergen|barbea|bar\s*bea|amour|toujours|vkb|lat|bea/i

async function main() {
  loadDotEnv()
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB_NAME
  const client = new MongoClient(uri.trim())
  await client.connect()
  const db = client.db(dbName)

  const reports = await db
    .collection('inbox-bork-basis-report')
    .find({ location: 'Unspecified' })
    .toArray()

  console.log(`Inspecting ${reports.length} Unspecified rows`)

  for (const r of reports) {
    const attId = r.metadata?.source_attachment_id
    console.log('\n=== report ===')
    console.log({
      _id: String(r._id),
      date: r.date,
      revenue: r.final_revenue_incl_vat,
      subject: r.metadata?.email_subject,
      file: r.metadata?.attachment_filename,
      source_attachment_id: attId,
      source_email_id: r.metadata?.source_email_id,
    })

    // Email lookup
    const emailId = r.metadata?.source_email_id
    if (emailId) {
      try {
        const email = await db.collection('inboxemails').findOne({ _id: new ObjectId(String(emailId)) })
        if (email) {
          console.log('  email:', {
            subject: email.subject,
            from: email.from,
            to: email.to,
          })
        }
      } catch (err) {
        // ignore
      }
    }

    if (!attId) {
      console.log('  (no source_attachment_id — legacy row)')
      continue
    }
    let attOid
    try {
      attOid = new ObjectId(String(attId))
    } catch {
      continue
    }

    const att = await db.collection('emailattachments').findOne({ _id: attOid })
    if (att) {
      console.log('  attachment:', { fileName: att.fileName, contentType: att.contentType, size: att.size })
    }

    const parsed = await db.collection('parseddatas').findOne({ attachmentId: attOid })
    if (!parsed) {
      console.log('  (no parseddatas)')
      continue
    }
    const md = parsed.data?.metadata ?? {}
    console.log('  parsed.metadata.sheets:', md.sheets)
    const rows = parsed.data?.rows ?? []
    console.log(`  Rows: ${rows.length}`)

    let venueHits = []
    for (let i = 0; i < rows.length; i++) {
      const vals = Object.values(rows[i] ?? {})
        .map((v) => String(v ?? '').trim())
        .filter(Boolean)
      const joined = vals.join(' | ')
      if (VENUE_HINT.test(joined)) venueHits.push(`[${i}] ${joined}`)
    }
    if (venueHits.length > 0) {
      console.log('  venue keyword hits in rows:')
      for (const h of venueHits.slice(0, 6)) console.log('   ', h)
    } else {
      console.log('  (no venue keyword in rows)')
      console.log('  First 8 rows:')
      for (let i = 0; i < Math.min(8, rows.length); i++) {
        const vals = Object.values(rows[i] ?? {}).map((v) => String(v ?? '').trim()).filter(Boolean)
        if (vals.length > 0) console.log(`    [${i}] ${vals.join(' | ')}`)
      }
    }
  }

  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
