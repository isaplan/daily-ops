/**
 * @registry-id: eitjeV2CredentialsRoute
 * @created: 2026-01-22T00:00:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: GET/POST route to fetch/store active Eitje credentials in MongoDB
 * @last-fix: [2026-01-24] Added metadata header for validation
 *
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - mongodb => ObjectId
 *
 * @exports-to:
 *   ✓ app/(authenticated)/settings/eitje-api/page.tsx => load/save credentials
 *   ✓ app/lib/eitje/v2-credentials.ts => reads active credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        success: true,
        credentials: null,
      });
    }

    return NextResponse.json({
      success: true,
      credentials: {
        _id: cred._id,
        baseUrl: cred.baseUrl || 'https://open-api.eitje.app/open_api',
        additionalConfig: cred.additionalConfig || {},
        isActive: cred.isActive,
        createdAt: cred.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API /eitje/v2/credentials] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch credentials',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, additionalConfig } = body;

    if (!additionalConfig || !additionalConfig.partner_username || !additionalConfig.partner_password ||
        !additionalConfig.api_username || !additionalConfig.api_password) {
      return NextResponse.json(
        { success: false, error: 'All credentials are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Deactivate all existing credentials
    await db.collection('api_credentials').updateMany(
      { provider: 'eitje' },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    // Create new active credentials
    const newCred = {
      provider: 'eitje',
      isActive: true,
      baseUrl: baseUrl || 'https://open-api.eitje.app/open_api',
      additionalConfig: {
        partner_username: additionalConfig.partner_username,
        partner_password: additionalConfig.partner_password,
        api_username: additionalConfig.api_username,
        api_password: additionalConfig.api_password,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('api_credentials').insertOne(newCred);

    return NextResponse.json({
      success: true,
      message: 'Credentials saved successfully',
      credentialId: result.insertedId,
    });
  } catch (error: any) {
    console.error('[API /eitje/v2/credentials] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to save credentials',
      },
      { status: 500 }
    );
  }
}
