import { getDb } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const db = await getDb()
    
    const count = await db.collection('bork_raw_data').countDocuments()
    
    if (count === 0) {
      return { error: 'No documents in bork_raw_data' }
    }
    
    const sample = await db.collection('bork_raw_data').findOne({})
    
    // Check structure
    const firstRecord = Array.isArray(sample?.rawApiResponse) 
      ? sample?.rawApiResponse[0] 
      : sample?.rawApiResponse
    
    return {
      totalCount: count,
      documentStructure: {
        topLevelKeys: Object.keys(sample || {}),
        syncDedupKey: sample?.syncDedupKey,
        endpoint: sample?.endpoint,
        locationId: sample?.locationId,
        date: sample?.date,
        rawApiResponseType: Array.isArray(sample?.rawApiResponse) ? 'ARRAY' : typeof sample?.rawApiResponse,
        rawApiResponseLength: Array.isArray(sample?.rawApiResponse) ? sample.rawApiResponse.length : 'N/A',
      },
      firstRecord: firstRecord ? {
        keys: Object.keys(firstRecord),
        sample: firstRecord,
      } : null,
    }
  } catch (error) {
    return { 
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
