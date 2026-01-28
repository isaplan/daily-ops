import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function checkDuplicates() {
  const db = await getDatabase();
  
  // Check for duplicates in time_registration_aggregation
  const duplicates = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $group: {
        _id: {
          period: '$period',
          period_type: '$period_type',
          locationId: '$locationId',
          userId: '$userId',
          teamId: '$teamId',
        },
        count: { $sum: 1 },
        docs: { $push: '$_id' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $limit: 10
    }
  ]).toArray();
  
  console.log(`Found ${duplicates.length} duplicate groups`);
  duplicates.forEach((dup, idx) => {
    console.log(`\nDuplicate ${idx + 1}:`);
    console.log(`  Period: ${dup._id.period}, Type: ${dup._id.period_type}`);
    console.log(`  LocationId: ${dup._id.locationId}, UserId: ${dup._id.userId}, TeamId: ${dup._id.teamId}`);
    console.log(`  Count: ${dup.count}`);
    console.log(`  Document IDs: ${dup.docs.slice(0, 3).join(', ')}${dup.docs.length > 3 ? '...' : ''}`);
  });
  
  // Count by period_type
  const byPeriodType = await db.collection('eitje_time_registration_aggregation').aggregate([
    {
      $group: {
        _id: '$period_type',
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  console.log('\n\nCount by period_type:');
  byPeriodType.forEach(pt => {
    console.log(`  ${pt._id}: ${pt.count} documents`);
  });
  
  // Count raw data
  const rawCount = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts'
  });
  
  console.log(`\n\nRaw data records: ${rawCount}`);
  console.log(`Total aggregated documents: ${byPeriodType.reduce((sum, pt) => sum + pt.count, 0)}`);
  console.log(`Expected (raw * 4 periods): ${rawCount * 4}`);
}

checkDuplicates().catch(console.error);
