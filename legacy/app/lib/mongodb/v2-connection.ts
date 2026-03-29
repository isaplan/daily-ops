/**
 * @registry-id: mongodbV2Connection
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Server-only MongoDB connection helper with pooled client + retry logic for serverless cold starts
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @exports-to:
 *   ✓ app/api/eitje/v2/credentials/route.ts => getDatabase() for credentials persistence
 *   ✓ app/api/eitje/v2/sync/route.ts => getDatabase() for ingest into `eitje_raw_data`
 *   ✓ app/api/eitje/v2/cron/route.ts => cron manager persistence
 *   ✓ app/api/hours/route.ts => reads `eitje_raw_data` for reporting
 *   ✓ app/lib/cron/v2-cron-manager.ts => cron job persistence + internal sync triggers
 */

// Prevent client-side usage
if (typeof window !== 'undefined') {
  throw new Error(
    'MongoDB connection cannot be used in client-side code. ' +
    'Use API routes or Server Components instead.'
  );
}

import { MongoClient, Db } from 'mongodb';

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please add your MONGODB_URI to .env.local');
  }
  return uri;
}

function getDbName(): string {
  return process.env.MONGODB_DB_NAME || 'daily-ops';
}

const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 180000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  maxStalenessSeconds: 120,
  serverMonitoringMode: 'auto',
};

// Global is used here to maintain a cached connection across hot reloads
// in development. This prevents connections growing exponentially
// during API Route usage.
let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

/**
 * Retry logic with exponential backoff
 * Handles transient connection failures on serverless cold starts
 */
async function connectWithRetry(
  uri: string,
  options: any,
  maxRetries: number = 3,
  initialDelayMs: number = 500
): Promise<MongoClient> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = new MongoClient(uri, options);
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(
          `[MongoDB] Connection attempt ${attempt + 1}/${maxRetries} failed. ` +
          `Retrying in ${delayMs}ms...`,
          error instanceof Error ? error.message : error
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(
    `[MongoDB] Failed to connect after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise;
  }

  const uri = getMongoUri();

  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = connectWithRetry(uri, options, 3, 500);
    }
    clientPromise = globalWithMongo._mongoClientPromise;
  } else {
    // In production mode, use retry logic for serverless cold starts
    clientPromise = connectWithRetry(uri, options, 3, 500);
  }

  return clientPromise;
}

/**
 * Get MongoDB database instance
 */
export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(getDbName());
}

/**
 * Get MongoDB client (for advanced operations)
 */
export async function getClient(): Promise<MongoClient> {
  return getClientPromise();
}

// Export a function to get the client promise (lazy initialization)
export default getClientPromise;
