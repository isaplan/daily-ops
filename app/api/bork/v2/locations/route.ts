/**
 * @registry-id: borkV2LocationsRoute
 * @created: 2026-01-15T00:00:00.000Z
 * @last-modified: 2026-03-02T00:00:00.000Z
 * @description: GET /api/bork/v2/locations - list active locations for credential selection
 * @last-fix: [2026-03-02] Added metadata header for registry tracking
 * 
 * GET: list locations (for Bork credential dropdown).
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/v2-connection';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = await getDatabase();
    const locations = await db
      .collection('locations')
      .find({ isActive: true })
      .sort({ name: 1 })
      .project({ _id: 1, name: 1 })
      .toArray();

    const list = locations.map((loc) => ({
      _id: loc._id.toString(),
      name: loc.name ?? '',
    }));

    return NextResponse.json({ success: true, locations: list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
