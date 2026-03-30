/**
 * Export active workers for invitations
 * 
 * This script generates a CSV/list of active workers with their contact information
 * ready for sending invitations to use the app.
 */
import { MongoClient } from 'mongodb'
import fs from 'fs'
import path from 'path'

async function run() {
  console.log('📧 Exporting active workers...\n')

  const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true"
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db('daily-ops-db')

    // Get all active workers with emails
    const activeWorkers = await db
      .collection('members')
      .find({
        is_active: true,
        email: { $exists: true, $ne: '' },
      })
      .sort({ name: 1 })
      .toArray()

    console.log(`✅ Found ${activeWorkers.length} active workers with emails\n`)

    // Create CSV data
    const headers = [
      'Name',
      'Email',
      'Contract Type',
      'Contract Start',
      'Contract End',
      'Hourly Rate',
      'Status',
    ]

    const rows = activeWorkers.map((w: any) => [
      w.name || '',
      w.email || '',
      w.contract_type || '',
      w.contract_start_date ? new Date(w.contract_start_date).toLocaleDateString('en-NL') : '',
      w.contract_end_date ? new Date(w.contract_end_date).toLocaleDateString('en-NL') : '',
      w.hourly_rate ? `€${w.hourly_rate.toFixed(2)}` : '',
      'Active',
    ])

    // Generate CSV
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(r => r.map(c => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(',')),
    ].join('\n')

    // Save CSV
    const outputPath = path.join(
      process.cwd(),
      'exports',
      `active-workers-${new Date().toISOString().split('T')[0]}.csv`
    )

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), 'exports')
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true })
    }

    fs.writeFileSync(outputPath, csvContent)

    console.log(`📁 CSV exported to: ${outputPath}\n`)

    // Print console table
    console.log('📋 ACTIVE WORKERS TO INVITE\n')
    console.log('┌' + '─'.repeat(98) + '┐')
    console.log(
      '│ ' +
        ['Name', 'Email', 'Contract Type', 'End Date']
          .map(h => h.padEnd(22))
          .join('│ ') +
        ' │'
    )
    console.log('├' + '─'.repeat(98) + '┤')

    activeWorkers.forEach((w: any) => {
      const endDate = w.contract_end_date
        ? new Date(w.contract_end_date).toLocaleDateString('en-NL')
        : 'N/A'
      console.log(
        '│ ' +
          [
            (w.name || '').substring(0, 22).padEnd(22),
            (w.email || '').substring(0, 22).padEnd(22),
            (w.contract_type || 'N/A').substring(0, 22).padEnd(22),
            endDate.substring(0, 22).padEnd(22),
          ].join('│ ') +
          ' │'
      )
    })

    console.log('└' + '─'.repeat(98) + '┘')

    // Summary stats
    const contractTypes: Record<string, number> = {}
    activeWorkers.forEach((w: any) => {
      const type = w.contract_type || 'Unknown'
      contractTypes[type] = (contractTypes[type] || 0) + 1
    })

    console.log('\n📊 SUMMARY BY CONTRACT TYPE')
    Object.entries(contractTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   • ${type}: ${count}`)
      })

    console.log('\n✨ Export complete!')
    console.log(`\n💡 Tips:`)
    console.log(`   • Open the CSV in Excel/Sheets to view and sort`)
    console.log(`   • Use the email addresses to send invitations`)
    console.log(`   • Create mail merge templates for personalized invites`)
  } finally {
    await client.close()
  }
}

run().catch(err => {
  console.error('\n❌ ERROR:', err.message)
  process.exit(1)
})
