/**
 * @registry-id: borkV2CredentialsHelper
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Fetch active Bork credentials from MongoDB (api_credentials)
 * @last-fix: [2026-01-30] Initial Bork credentials from MongoDB
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/bork/v2-types.ts => BorkApiCredentials
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/sync/route.ts, app/api/bork/v2/master-sync/route.ts => getBorkCredentials
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import type { BorkApiCredentials } from './v2-types';

export type BorkCredentialResult = {
  baseUrl: string;
  apiKey: string;
  credentials: BorkApiCredentials;
  locationId?: string;
};

/**
 * Get active Bork credentials from MongoDB (api_credentials collection).
 * Expects document: { provider: 'bork', isActive: true, baseUrl, apiKey or config: { baseUrl, apiKey }, locationId? }
 */
export async function getBorkCredentials(): Promise<BorkCredentialResult | null> {
  try {
    const db = await getDatabase();
    const cred = await db.collection('api_credentials').findOne(
      { provider: 'bork', isActive: true },
      { sort: { createdAt: -1 } }
    );

    if (!cred) return null;

    const baseUrl = cred.baseUrl ?? cred.config?.baseUrl ?? '';
    const apiKey = cred.apiKey ?? cred.config?.apiKey ?? '';
    if (!baseUrl || !apiKey) return null;

    return {
      baseUrl,
      apiKey,
      credentials: { baseUrl, apiKey },
      locationId: cred.locationId?.toString(),
    };
  } catch (error) {
    console.error('[Bork V2 Credentials] Error fetching credentials:', error);
    return null;
  }
}

/**
 * Get all active Bork credentials (one per location) for cron jobs that run all locations.
 * Includes docs where isActive is true or not set (legacy credentials).
 */
export async function getAllBorkCredentials(): Promise<BorkCredentialResult[]> {
  try {
    const db = await getDatabase();
    const creds = await db.collection('api_credentials').find({
      provider: 'bork',
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).toArray();

    const results: BorkCredentialResult[] = [];
    for (const cred of creds) {
      const baseUrl = cred.baseUrl ?? cred.config?.baseUrl ?? '';
      const apiKey = cred.apiKey ?? cred.config?.apiKey ?? '';
      if (!baseUrl || !apiKey) continue;
      results.push({
        baseUrl,
        apiKey,
        credentials: { baseUrl, apiKey },
        locationId: cred.locationId?.toString(),
      });
    }
    return results;
  } catch (error) {
    console.error('[Bork V2 Credentials] Error fetching all credentials:', error);
    return [];
  }
}

/**
 * Get Bork credentials for a specific location (by locationId).
 */
export async function getBorkCredentialsForLocation(
  locationId: string
): Promise<BorkCredentialResult | null> {
  try {
    const db = await getDatabase();
    let locationObjectId: ObjectId;
    try {
      locationObjectId = new ObjectId(locationId);
    } catch {
      const loc = await db.collection('locations').findOne({
        'systemMappings.externalId': locationId,
        'systemMappings.system': 'bork',
      });
      if (!loc) return null;
      locationObjectId = loc._id;
    }

    const cred = await db.collection('api_credentials').findOne({
      provider: 'bork',
      locationId: locationObjectId,
      isActive: true,
    });

    if (!cred) return null;

    const baseUrl = cred.baseUrl ?? cred.config?.baseUrl ?? '';
    const apiKey = cred.apiKey ?? cred.config?.apiKey ?? '';
    if (!baseUrl || !apiKey) return null;

    return {
      baseUrl,
      apiKey,
      credentials: { baseUrl, apiKey },
      locationId: locationId,
    };
  } catch (error) {
    console.error('[Bork V2 Credentials] Error fetching credentials for location:', error);
    return null;
  }
}
