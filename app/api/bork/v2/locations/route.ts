/**
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
