/**
 * GET: list Bork credentials (per location).
 * POST: save/update Bork credential for a location.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDatabase();
    const creds = await db
      .collection('api_credentials')
      .find({ provider: 'bork' })
      .sort({ createdAt: -1 })
      .toArray();

    const list: { _id: string; locationId: string; locationName: string | null; baseUrl: string; hasApiKey: boolean }[] = [];
    for (const c of creds) {
      const locationId = c.locationId instanceof ObjectId ? c.locationId : new ObjectId(String(c.locationId));
      const loc = await db.collection('locations').findOne({ _id: locationId });
      const storedName = (c as { locationName?: string }).locationName;
      const locationName = storedName ?? (loc && typeof (loc as { name?: string }).name === 'string' ? (loc as { name: string }).name : null);
      list.push({
        _id: c._id.toString(),
        locationId: locationId.toString(),
        locationName,
        baseUrl: c.baseUrl ?? (c as { config?: { baseUrl?: string } }).config?.baseUrl ?? '',
        hasApiKey: !!(c.apiKey ?? (c as { config?: { apiKey?: string } }).config?.apiKey),
      });
    }

    return NextResponse.json({ success: true, credentials: list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { locationId, baseUrl, apiKey } = body;

    if (!locationId || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'locationId and baseUrl are required' },
        { status: 400 }
      );
    }
    const hasApiKey = typeof apiKey === 'string' && apiKey.trim() !== '';

    const db = await getDatabase();
    let locationObjectId: ObjectId;
    try {
      locationObjectId = new ObjectId(locationId);
    } catch {
      const loc = await db.collection('locations').findOne({
        'systemMappings.externalId': locationId,
        'systemMappings.system': 'bork',
      });
      if (!loc) {
        return NextResponse.json(
          { success: false, error: 'Location not found' },
          { status: 404 }
        );
      }
      locationObjectId = loc._id;
    }

    const existing = await db.collection('api_credentials').findOne({
      provider: 'bork',
      locationId: locationObjectId,
    });

    let locationName: string | null = null;
    const loc = await db.collection('locations').findOne({ _id: locationObjectId });
    if (loc && typeof (loc as { name?: string }).name === 'string') locationName = (loc as { name: string }).name;

    const update: Record<string, unknown> = {
      provider: 'bork',
      locationId: locationObjectId,
      baseUrl: baseUrl.trim(),
      isActive: true,
      updatedAt: new Date(),
    };
    if (locationName) update.locationName = locationName;
    if (hasApiKey) update.apiKey = (apiKey as string).trim();

    if (existing) {
      if (!hasApiKey && !existing.apiKey && !(existing as { config?: { apiKey?: string } }).config?.apiKey) {
        return NextResponse.json(
          { success: false, error: 'API key is required for new credentials' },
          { status: 400 }
        );
      }
      await db.collection('api_credentials').updateOne(
        { _id: existing._id },
        { $set: update }
      );
      return NextResponse.json({ success: true, message: 'Credentials updated', credentialId: existing._id.toString() });
    }

    if (!hasApiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required when adding a new location' },
        { status: 400 }
      );
    }
    const result = await db.collection('api_credentials').insertOne({
      ...update,
      locationName: locationName ?? undefined,
      apiKey: (apiKey as string).trim(),
      createdAt: new Date(),
    });
    return NextResponse.json({ success: true, message: 'Credentials saved', credentialId: result.insertedId.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
