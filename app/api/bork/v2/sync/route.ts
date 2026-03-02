/**
 * @registry-id: borkV2SyncRoute
 * @created: 2026-01-15T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: POST /api/bork/v2/sync - sync sales data from Bork API to MongoDB
 * @last-fix: [2026-03-02] Added metadata header for registry tracking
 * 
 * Sync sales data from Bork API to MongoDB (bork_raw_data).
 * V2 flow: locationId required (single location); credentials from MongoDB per location.
 *
 * Body: locationId (required), startDate, endDate, locationName?, baseUrl?, apiKey?, fullRewrite?
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import { syncSalesData } from '@/lib/services/salesSyncService';

export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      locationId,
      startDate,
      endDate,
      locationName,
      baseUrl: bodyBaseUrl,
      apiKey: bodyApiKey,
      fullRewrite = false,
    } = body;

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'locationId is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const requestedLocationId = typeof locationId === 'string' ? locationId.trim() : String(locationId);

    let location: { _id: ObjectId; name?: string; systemMappings?: { system: string; externalId: string }[] } | null = null;
    let locationObjectId: ObjectId | null = null;

    try {
      locationObjectId = new ObjectId(requestedLocationId);
      location = await db.collection('locations').findOne({ _id: locationObjectId });
    } catch {
      // not ObjectId
    }

    if (!location && !locationObjectId) {
      location = await db.collection('locations').findOne({
        'systemMappings.externalId': requestedLocationId,
        'systemMappings.system': 'bork',
      });
      if (location) locationObjectId = location._id;
    }

    if (!location && locationName) {
      location = await db.collection('locations').findOne({
        name: locationName,
        isActive: true,
      });
      if (!location) {
        location = await db.collection('locations').findOne({
          name: { $regex: new RegExp(`^${String(locationName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          isActive: true,
        });
      }
      if (location) {
        locationObjectId = location._id;
        if (
          location.systemMappings &&
          !location.systemMappings.some((m) => m.system === 'bork' && m.externalId === requestedLocationId)
        ) {
          await db.collection('locations').updateOne(
            { _id: location._id },
            { $push: { systemMappings: { system: 'bork', externalId: requestedLocationId } } }
          );
        }
      }
    }

    const commonNames = ["Bar Bea", "Van Kinsbergen", "L'Amour Toujours", "l'Amour Toujours", "LAmour Toujours"];
    if (!location && !locationObjectId) {
      for (const name of commonNames) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        location = await db.collection('locations').findOne({
          name: { $regex: new RegExp(`^${escaped}$`, 'i') },
          isActive: true,
        });
        if (location) {
          locationObjectId = location._id;
          break;
        }
      }
    }

    if (!location || !locationObjectId) {
      const newLocation = {
        name: locationName ?? `Location ${requestedLocationId.slice(0, 8)}`,
        code: requestedLocationId.slice(0, 8).toUpperCase(),
        isActive: true,
        systemMappings: [{ system: 'bork', externalId: requestedLocationId }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      try {
        const insertResult = await db.collection('locations').insertOne(newLocation);
        locationObjectId = insertResult.insertedId;
        location = { ...newLocation, _id: locationObjectId };
      } catch (insertErr) {
        const found = await db.collection('locations').findOne({
          'systemMappings.externalId': requestedLocationId,
          'systemMappings.system': 'bork',
        });
        if (found) {
          location = found;
          locationObjectId = found._id;
        } else {
          return NextResponse.json(
            {
              success: false,
              error: `Unable to create or find location: ${requestedLocationId}. ${insertErr instanceof Error ? insertErr.message : ''}`,
            },
            { status: 500 }
          );
        }
      }
    }

    let baseUrl = bodyBaseUrl;
    let apiKey = bodyApiKey;
    if (!baseUrl || !apiKey) {
      const cred = await db.collection('api_credentials').findOne({
        provider: 'bork',
        locationId: locationObjectId,
        isActive: true,
      });
      if (cred) {
        baseUrl = cred.baseUrl ?? (cred as { config?: { baseUrl?: string } }).config?.baseUrl ?? '';
        apiKey = cred.apiKey ?? (cred as { config?: { apiKey?: string } }).config?.apiKey ?? '';
      }
    }

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing baseUrl or apiKey. Set Bork credential for this location in MongoDB or pass in body.' },
        { status: 400 }
      );
    }

    const result = await syncSalesData(
      locationObjectId.toString(),
      startDate,
      endDate,
      baseUrl,
      apiKey,
      fullRewrite
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, recordsSaved: 0, ticketsProcessed: 0, ticketsSkipped: 0 },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordsSaved: result.recordsSaved,
      ticketsProcessed: result.ticketsProcessed,
      ticketsSkipped: result.ticketsSkipped,
      message: `Synced ${result.recordsSaved} date(s), ${result.ticketsProcessed} tickets (${result.ticketsSkipped} skipped).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message, recordsSaved: 0, ticketsProcessed: 0, ticketsSkipped: 0 },
      { status: 500 }
    );
  }
}
