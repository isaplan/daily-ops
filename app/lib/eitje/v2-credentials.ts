/**
 * @registry-id: eitjeV2CredentialsHelper
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Helper to fetch the active Eitje credentials from MongoDB
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/eitje/v2-types.ts => EitjeCredentials
 *
 * @exports-to:
 *   ✓ app/api/eitje/v2/sync/route.ts => uses active credentials to call Eitje API
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { EitjeCredentials } from './v2-types';

export async function getEitjeCredentials(): Promise<{
  baseUrl: string;
  credentials: EitjeCredentials;
} | null> {
  try {
    const db = await getDatabase();
    
    const cred = await db.collection('api_credentials')
      .findOne(
        { 
          provider: 'eitje',
          isActive: true 
        },
        { 
          sort: { createdAt: -1 } 
        }
      );

    if (!cred) {
      return null;
    }

    const additionalConfig = cred.additionalConfig || {};
    
    return {
      baseUrl: cred.baseUrl || 'https://open-api.eitje.app/open_api',
      credentials: {
        partner_username: additionalConfig.partner_username || '',
        partner_password: additionalConfig.partner_password || '',
        api_username: additionalConfig.api_username || '',
        api_password: additionalConfig.api_password || '',
      },
    };
  } catch (error) {
    console.error('[Eitje V2 Credentials] Error fetching credentials:', error);
    return null;
  }
}
