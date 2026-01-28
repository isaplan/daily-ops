import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { getDatabase } from '../app/lib/mongodb/v2-connection';

async function cleanDuplicates() {
  const db = await getDatabase();
  
  // Find duplicates for time_registration_shifts
  const duplicates = await db.collection('eitje_raw_data').aggregate([
    {
      $match: {
        endpoint: 'time_registration_shifts'
      }
    },
    {
      $group: {
        _id: {
          endpoint: '$endpoint',
          date: '$date',
          supportId: {
            $ifNull: [
              '$extracted.supportId',
              {
                $ifNull: [
                  '$rawApiResponse.support_id',
                  {
                    $ifNull: [
                      '$rawApiResponse.id',
                      '$extracted.id'
                    ]
                  }
                ]
              }
            ]
          },
          userId: {
            $ifNull: [
              '$extracted.userId',
              '$rawApiResponse.user_id'
            ]
          }
        },
        docs: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  console.log(`Found ${duplicates.length} duplicate groups`);
  
  let totalDeleted = 0;
  for (const dup of duplicates) {
    // Keep the first one (oldest), delete the rest
    const docsToDelete = dup.docs.slice(1);
    const result = await db.collection('eitje_raw_data').deleteMany({
      _id: { $in: docsToDelete }
    });
    totalDeleted += result.deletedCount;
    console.log(`Deleted ${result.deletedCount} duplicates for date ${dup._id.date}, supportId ${dup._id.supportId}`);
  }
  
  console.log(`\nTotal duplicates deleted: ${totalDeleted}`);
  
  // Verify
  const remaining = await db.collection('eitje_raw_data').countDocuments({
    endpoint: 'time_registration_shifts'
  });
  console.log(`Remaining time_registration_shifts records: ${remaining}`);
}

cleanDuplicates().catch(console.error);
