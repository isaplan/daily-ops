/**
 * Compare Alvinio's hours from CSV export with database data
 * Period: Dec 27, 2025 to Jan 26, 2026
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { getDatabase } from '../app/lib/mongodb/v2-connection';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

interface CSVRow {
  datum: string;
  naam: string;
  'team naam': string;
  'naam van vestiging': string;
  uren: string;
  opmerking: string;
  'support ID': string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n');
  const header = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^▲\s*/, '').replace(/"/g, ''));
  
  const records: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith(',,,,')) continue; // Skip empty or total rows
    
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    const record: any = {};
    header.forEach((key, idx) => {
      record[key] = values[idx] || '';
    });
    
    if (record.datum && record.uren) {
      records.push(record as CSVRow);
    }
  }
  
  return records;
}

function parseHours(hoursStr: string): number {
  if (!hoursStr) return 0;
  // Handle "1,0" format (Dutch decimal comma)
  return parseFloat(hoursStr.replace(',', '.'));
}

function parseDate(dateStr: string): Date {
  // Format: "29/12/2025"
  const [day, month, year] = dateStr.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

async function main() {
  try {
    // Read CSV file
    const csvPath = '/Users/alviniomolina/Downloads/alvinio-maandelijkse-uren-export-inclusief-opmerkingen - 2026-01-26-21-16-42 (49023).csv';
    const csvContent = readFileSync(csvPath, 'utf-8');
    const csvRows = parseCSV(csvContent);
    
    // Filter for date range: Dec 27, 2025 to Jan 26, 2026
    const startDate = new Date(2025, 11, 27); // Dec 27, 2025
    const endDate = new Date(2026, 0, 26); // Jan 26, 2026
    
    const filteredRows = csvRows.filter(row => {
      const rowDate = parseDate(row.datum);
      return rowDate >= startDate && rowDate <= endDate;
    });
    
    // Calculate CSV totals
    const csvTotalHours = filteredRows.reduce((sum, row) => sum + parseHours(row.uren), 0);
    const csvRecordCount = filteredRows.length;
    
    console.log('📊 CSV Export Analysis (Dec 27, 2025 - Jan 26, 2026):');
    console.log(`  - Total records: ${csvRecordCount}`);
    console.log(`  - Total hours: ${csvTotalHours.toFixed(2)}`);
    console.log(`  - Date range: ${filteredRows[0]?.datum} to ${filteredRows[filteredRows.length - 1]?.datum}`);
    
    // Query database
    const db = await getDatabase();
    
    // Find Alvinio's user ID from unified_user
    const alvinioUser = await db.collection('unified_user').findOne({
      $or: [
        { canonicalEmail: 'alviniomolina@gmail.com' },
        { eitjeEmails: 'alviniomolina@gmail.com' },
        { canonicalName: { $regex: /alvinio/i } }
      ]
    });
    
    if (!alvinioUser) {
      console.error('❌ Could not find Alvinio in unified_user collection');
      process.exit(1);
    }
    
    console.log(`\n👤 Found user: ${alvinioUser.canonicalName} (ID: ${alvinioUser.primaryId || alvinioUser.eitjeIds?.[0]})`);
    
    // Get raw data for Alvinio
    const userId = alvinioUser.eitjeIds?.[0] || alvinioUser.primaryId;
    
    const rawDataQuery = {
      endpoint: 'time_registration_shifts',
      date: {
        $gte: startDate,
        $lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1) // End of day
      },
      $or: [
        { 'extracted.userId': userId },
        { 'rawApiResponse.user_id': userId },
        { 'extracted.userEmail': 'alviniomolina@gmail.com' },
        { 'rawApiResponse.user_email': 'alviniomolina@gmail.com' }
      ]
    };
    
    const rawDataRecords = await db.collection('eitje_raw_data').find(rawDataQuery).toArray();
    
    // Calculate hours from raw data using same logic as aggregation service
    let rawDataTotalHours = 0;
    for (const record of rawDataRecords) {
      let hours = 0;
      
      // Try extracted fields first
      if (record.extracted?.hours) {
        hours = typeof record.extracted.hours === 'number' ? record.extracted.hours : parseFloat(record.extracted.hours) || 0;
      } else if (record.extracted?.hoursWorked) {
        hours = typeof record.extracted.hoursWorked === 'number' ? record.extracted.hoursWorked : parseFloat(record.extracted.hoursWorked) || 0;
      } else if (record.rawApiResponse?.hours) {
        hours = typeof record.rawApiResponse.hours === 'number' ? record.rawApiResponse.hours : parseFloat(record.rawApiResponse.hours) || 0;
      } else if (record.rawApiResponse?.hours_worked) {
        hours = typeof record.rawApiResponse.hours_worked === 'number' ? record.rawApiResponse.hours_worked : parseFloat(record.rawApiResponse.hours_worked) || 0;
      } else if (record.rawApiResponse?.start && record.rawApiResponse?.end) {
        // Calculate from start/end times
        const start = new Date(record.rawApiResponse.start);
        const end = new Date(record.rawApiResponse.end);
        const breakMinutes = record.rawApiResponse.break_minutes || 0;
        hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60) - (breakMinutes / 60);
      }
      
      rawDataTotalHours += hours;
    }
    
    // Get aggregated data
    const aggregatedData = await db.collection('eitje_time_registration_aggregation').aggregate([
      {
        $match: {
          userId: userId,
          period: {
            $gte: '2025-12-27',
            $lte: '2026-01-26'
          }
        }
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$total_hours' },
          totalRecords: { $sum: '$record_count' }
        }
      }
    ]).toArray();
    
    const aggregatedHours = aggregatedData[0]?.totalHours || 0;
    const aggregatedRecords = aggregatedData[0]?.totalRecords || 0;
    
    console.log('\n📊 Database Analysis (Dec 27, 2025 - Jan 26, 2026):');
    console.log(`  - Raw data records: ${rawDataRecords.length}`);
    console.log(`  - Raw data total hours: ${rawDataTotalHours.toFixed(2)}`);
    console.log(`  - Aggregated records: ${aggregatedRecords}`);
    console.log(`  - Aggregated total hours: ${aggregatedHours.toFixed(2)}`);
    
    // Comparison
    console.log('\n🔍 Comparison:');
    console.log(`  CSV Export:     ${csvTotalHours.toFixed(2)} hours, ${csvRecordCount} records`);
    console.log(`  Raw Data:       ${rawDataTotalHours.toFixed(2)} hours, ${rawDataRecords.length} records`);
    console.log(`  Aggregated:     ${aggregatedHours.toFixed(2)} hours, ${aggregatedRecords} records`);
    
    const csvVsRawDiff = Math.abs(csvTotalHours - rawDataTotalHours);
    const csvVsAggDiff = Math.abs(csvTotalHours - aggregatedHours);
    const rawVsAggDiff = Math.abs(rawDataTotalHours - aggregatedHours);
    
    console.log('\n📈 Differences:');
    console.log(`  CSV vs Raw:     ${csvVsRawDiff.toFixed(2)} hours (${csvVsRawDiff > 0.1 ? '⚠️ MISMATCH' : '✅ OK'})`);
    console.log(`  CSV vs Agg:     ${csvVsAggDiff.toFixed(2)} hours (${csvVsAggDiff > 0.1 ? '⚠️ MISMATCH' : '✅ OK'})`);
    console.log(`  Raw vs Agg:     ${rawVsAggDiff.toFixed(2)} hours (${rawVsAggDiff > 0.1 ? '⚠️ MISMATCH' : '✅ OK'})`);
    
    // Check for duplicates in aggregated data
    const allAggregatedDocs = await db.collection('eitje_time_registration_aggregation').find({
      userId: userId,
      period: {
        $gte: '2025-12-27',
        $lte: '2026-01-26'
      }
    }).toArray();
    
    // Group by period, locationId, teamId to find duplicates
    const grouped = new Map<string, any[]>();
    allAggregatedDocs.forEach(doc => {
      const key = `${doc.period}_${doc.locationId}_${doc.userId}_${doc.teamId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(doc);
    });
    
    const duplicates = Array.from(grouped.values()).filter(group => group.length > 1);
    
    console.log('\n🔍 Duplicate Analysis:');
    console.log(`  - Total aggregated documents: ${allAggregatedDocs.length}`);
    console.log(`  - Unique combinations (period+location+user+team): ${grouped.size}`);
    console.log(`  - Duplicate groups found: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  DUPLICATES FOUND:');
      duplicates.slice(0, 5).forEach((dupGroup, idx) => {
        console.log(`  Duplicate group ${idx + 1}:`);
        dupGroup.forEach(doc => {
          console.log(`    - Period: ${doc.period}, Hours: ${doc.total_hours}, Records: ${doc.record_count}, _id: ${doc._id}`);
        });
      });
      if (duplicates.length > 5) {
        console.log(`  ... and ${duplicates.length - 5} more duplicate groups`);
      }
    }
    
    // Check for issues
    if (csvVsRawDiff > 0.1) {
      console.log('\n⚠️  WARNING: CSV export does not match raw data!');
    }
    if (csvVsAggDiff > 0.1) {
      console.log('\n⚠️  WARNING: CSV export does not match aggregated data!');
      console.log(`     Aggregated has ${aggregatedRecords} records but CSV has ${csvRecordCount} records`);
      console.log(`     This indicates ${aggregatedRecords - csvRecordCount} duplicate records!`);
    }
    if (rawVsAggDiff > 0.1) {
      console.log('\n⚠️  WARNING: Raw data does not match aggregated data!');
    }
    
    if (csvVsRawDiff <= 0.1 && csvVsAggDiff <= 0.1 && rawVsAggDiff <= 0.1 && duplicates.length === 0) {
      console.log('\n✅ All data matches!');
    }
    
    // Show sample records by date
    console.log('\n📅 Sample records by date (first 10):');
    const byDate = new Map<string, { hours: number; count: number }>();
    filteredRows.slice(0, 10).forEach(row => {
      const date = row.datum;
      const hours = parseHours(row.uren);
      if (!byDate.has(date)) {
        byDate.set(date, { hours: 0, count: 0 });
      }
      const entry = byDate.get(date)!;
      entry.hours += hours;
      entry.count += 1;
    });
    
    byDate.forEach((value, date) => {
      console.log(`  ${date}: ${value.hours.toFixed(2)} hours (${value.count} records)`);
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
