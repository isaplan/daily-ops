/**
 * Import worker data from Eitje CSV
 * 
 * This script:
 * 1. Creates members collection if it doesn't exist
 * 2. Parses the CSV file with complete worker information
 * 3. Creates/updates each member with email, contract type, start/end dates, rates, etc.
 * 4. Marks workers as active/inactive based on contract end dates
 * 5. Generates a comprehensive import report
 */
import { MongoClient } from 'mongodb'
import Papa from 'papaparse'
import fs from 'fs'

interface WorkerRow {
  naam: string
  'e-mailadres': string
  contracttype: string
  'startdatum contract': string
  'einddatum contract': string
  uurloon: string
  'wekelijkse contracturen': string
  'maandelijkse contracturen': string
  leeftijd?: string
  telefoonnummer?: string
  verjaardag?: string
  postcode?: string
  stad?: string
  Straat?: string
  'Loonkosten per uur'?: string
  'Nmbrs ID'?: string
  'support ID'?: string
  voornaam?: string
  [key: string]: string | undefined
}

function parseDateDDMMYYYY(s: string): Date | null {
  if (!s || typeof s !== 'string') return null
  const parts = s.trim().split(/[/.-]/)
  if (parts.length !== 3) return null
  
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  
  const d = new Date(year, month, day)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseCurrency(s: string | undefined): number {
  if (!s) return 0
  const str = String(s).replace(/[^\d,.-]/g, '').replace(',', '.')
  const n = parseFloat(str)
  return Number.isNaN(n) ? 0 : n
}

function parseHours(s: string | undefined): number {
  if (!s) return 0
  const str = String(s).replace(/[^\d:]/g, '')
  const [h, m] = str.split(':').map(x => parseInt(x, 10) || 0)
  return h + m / 60
}

function normalizeWorkerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

interface ImportReport {
  totalWorkers: number
  created: number
  updated: number
  skipped: number
  activeCount: number
  inactiveCount: number
  withEmailCount: number
  errors: Array<{ name: string; email: string; reason: string }>
}

async function run() {
  console.log('🚀 Starting worker data import from CSV...\n')

  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)
  
  const report: ImportReport = {
    totalWorkers: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    activeCount: 0,
    inactiveCount: 0,
    withEmailCount: 0,
    errors: [],
  }

  try {
    await client.connect()
    const db = client.db('daily-ops-db')

    // Ensure members collection exists with indexes
    const membersColl = db.collection('members')
    await membersColl.createIndex({ name: 1 })
    await membersColl.createIndex({ email: 1 })
    await membersColl.createIndex({ is_active: 1 })

    // Read CSV file
    const csvPath = '/Users/alviniomolina/Downloads/personeels-lijst-haagse-nieuwe - 2026-03-30-08-49-59 (55564).csv'

    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at: ${csvPath}`)
    }

    const csvText = fs.readFileSync(csvPath, 'utf-8')
    // Remove BOM if present
    const cleanedText = csvText.startsWith('\ufeff') ? csvText.slice(1) : csvText
    const parseResult = Papa.parse(cleanedText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
    })

    if (!parseResult.data || parseResult.data.length === 0) {
      throw new Error('CSV parse failed or empty')
    }

    const csvRows = parseResult.data as WorkerRow[]
    report.totalWorkers = csvRows.length

    console.log(`📄 CSV loaded: ${csvRows.length} workers\n`)
    console.log('📊 Processing workers...\n')

    // Process each worker from CSV
    let debugCount = 0
    for (const row of csvRows) {
      // Handle BOM in first column name
      let naam = row.naam
      if (!naam && row['▲ naam']) {
        naam = row['▲ naam']
      }
      naam = naam?.trim()
      
      const email = row['e-mailadres']?.trim()
      
      if (debugCount < 3) {
        console.log(`Row ${debugCount}: naam="${naam}" | email="${email}"`)
      }
      debugCount++

      if (!naam || naam.length === 0) {
        report.skipped++
        continue
      }

      // Parse dates
      const startDate = parseDateDDMMYYYY(row['startdatum contract'])
      const endDate = parseDateDDMMYYYY(row['einddatum contract'])

      // Determine if active: has valid email AND contract end date is in future
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const isActive = !!email && email.length > 0 && endDate && endDate > today

      if (email) {
        report.withEmailCount++
      }
      if (isActive) {
        report.activeCount++
      } else {
        report.inactiveCount++
      }

      // Build document object
      const workerData: Record<string, any> = {
        name: naam,
        created_at: new Date(),
        source: 'eitje-csv',
        is_active: isActive,
      }

      if (email) {
        workerData.email = email.toLowerCase()
      }

      if (row.contracttype) {
        workerData.contract_type = row.contracttype
      }

      if (startDate) {
        workerData.contract_start_date = startDate
      }

      if (endDate) {
        workerData.contract_end_date = endDate
      }

      const hourlyRate = parseCurrency(row.uurloon || row['Loonkosten per uur'])
      if (hourlyRate > 0) {
        workerData.hourly_rate = hourlyRate
      }

      const weeklyHours = parseHours(row['wekelijkse contracturen'])
      if (weeklyHours > 0) {
        workerData.weekly_hours = weeklyHours
      }

      const monthlyHours = parseHours(row['maandelijkse contracturen'])
      if (monthlyHours > 0) {
        workerData.monthly_hours = monthlyHours
      }

      // Additional fields
      if (row.leeftijd) {
        const age = parseInt(row.leeftijd, 10)
        if (!Number.isNaN(age) && age > 0) {
          workerData.age = age
        }
      }

      if (row.telefoonnummer) {
        workerData.phone = row.telefoonnummer
      }

      if (row.verjaardag) {
        workerData.birthday = row.verjaardag
      }

      if (row.postcode) {
        workerData.postcode = row.postcode
      }

      if (row.stad) {
        workerData.city = row.stad
      }

      if (row.Straat) {
        workerData.street = row.Straat
      }

      if (row['Nmbrs ID']) {
        workerData.nmbrs_id = row['Nmbrs ID']
      }

      if (row['support ID']) {
        workerData.support_id = row['support ID']
      }

      // Upsert: find existing by name and email, or create new
      try {
        const existingMember = await membersColl.findOne({
          $or: [
            { name: naam },
            email ? { email: email.toLowerCase() } : null,
          ].filter(Boolean),
        })

        if (existingMember) {
          // Update existing
          workerData.updated_at = new Date()
          await membersColl.updateOne(
            { _id: existingMember._id },
            { $set: workerData }
          )
          report.updated++
        } else {
          // Create new
          await membersColl.insertOne(workerData)
          report.created++
        }

        const statusEmoji = isActive ? '✅' : '⏸️'
        console.log(
          `${statusEmoji} ${naam.padEnd(35)} | ${(email || 'no-email').padEnd(35)} | ${row.contracttype || 'n/a'}`
        )
      } catch (err) {
        report.errors.push({
          name: naam,
          email: email || 'N/A',
          reason: err instanceof Error ? err.message : 'Database operation failed',
        })
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(100))
    console.log('\n📋 IMPORT SUMMARY\n')
    console.log(`Total workers in CSV:     ${report.totalWorkers}`)
    console.log(`✨ Successfully created:  ${report.created}`)
    console.log(`🔄 Successfully updated:  ${report.updated}`)
    console.log(`⏭️  Skipped:               ${report.skipped}`)
    console.log(`❌ Errors:                ${report.errors.length}`)

    console.log('\n👥 WORKER STATUS')
    console.log(`✅ Active workers:        ${report.activeCount}`)
    console.log(`⏸️  Inactive workers:      ${report.inactiveCount}`)
    console.log(`📧 With email:            ${report.withEmailCount}`)
    console.log(`❌ Without email:         ${report.totalWorkers - report.withEmailCount}`)

    if (report.errors.length > 0) {
      console.log('\n⚠️  ERRORS (showing first 20):')
      report.errors.slice(0, 20).forEach((err) => {
        console.log(`   • ${err.name} (${err.email})`)
        console.log(`     └─ ${err.reason}`)
      })
      if (report.errors.length > 20) {
        console.log(`   ... and ${report.errors.length - 20} more`)
      }
    }

    // Get final stats
    const totalMembers = await membersColl.countDocuments()
    const activeMembers = await membersColl.countDocuments({ is_active: true })
    const membersWithEmail = await membersColl.countDocuments({
      email: { $exists: true, $ne: '' },
    })

    console.log('\n📊 FINAL DATABASE STATUS')
    console.log(`Total members:            ${totalMembers}`)
    console.log(`Active members:           ${activeMembers}`)
    console.log(`Inactive members:         ${totalMembers - activeMembers}`)
    console.log(`Members with email:       ${membersWithEmail}`)

    console.log('\n✨ Import complete!')
    console.log('\n💡 Next steps:')
    console.log('   • Review the active workers and their emails')
    console.log('   • Use the active workers list to send invitations')
    console.log('   • Check for any workers missing emails or contract dates')
  } finally {
    await client.close()
  }
}

run().catch(err => {
  console.error('\n❌ FATAL ERROR:', err.message)
  process.exit(1)
})
