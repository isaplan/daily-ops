/**
 * POST /api/bork/v2/master-sync
 * Sync Bork master data (product_groups, payment_methods, cost_centers, users) to MongoDB.
 *
 * Body: locationId?, endpoint, baseUrl?, apiKey?
 * Credentials from body or MongoDB api_credentials (provider: 'bork').
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBorkCredentials, getBorkCredentialsForLocation } from '@/lib/bork/v2-credentials';
import { runMasterSyncEndpoint } from '@/lib/bork/v2-master-sync-service';

export const maxDuration = 60;
export const runtime = 'nodejs';

const ENDPOINTS = ['product_groups', 'payment_methods', 'cost_centers', 'users'] as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { locationId, endpoint, baseUrl: bodyBaseUrl, apiKey: bodyApiKey } = body;

    if (!endpoint || !ENDPOINTS.includes(endpoint)) {
      return NextResponse.json(
        { success: false, error: `endpoint required: one of ${ENDPOINTS.join(', ')}` },
        { status: 400 }
      );
    }

    let baseUrl = bodyBaseUrl;
    let apiKey = bodyApiKey;
    let resolvedLocationId = locationId;

    if (!baseUrl || !apiKey) {
      const creds = locationId
        ? await getBorkCredentialsForLocation(locationId)
        : await getBorkCredentials();
      if (!creds) {
        return NextResponse.json(
          { success: false, error: 'No Bork credentials. Provide baseUrl/apiKey or set in MongoDB.' },
          { status: 400 }
        );
      }
      baseUrl = creds.baseUrl;
      apiKey = creds.apiKey;
      if (!resolvedLocationId && creds.locationId) resolvedLocationId = creds.locationId;
    }

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'baseUrl and apiKey required' },
        { status: 400 }
      );
    }

    const result = await runMasterSyncEndpoint(
      resolvedLocationId ?? null,
      endpoint,
      baseUrl,
      apiKey
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Master sync failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordsSaved: result.recordsSaved,
      endpoint,
      message: `Synced ${result.recordsSaved} ${endpoint} records`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
