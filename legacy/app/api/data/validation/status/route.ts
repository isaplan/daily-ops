/**
 * @registry-id: validationStatusRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: GET - validation status for a date and optional location
 * @last-fix: [2026-01-30] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateEitjeTotals } from '@/lib/services/validation/eitjeValidationService';
import { validateBorkTotals } from '@/lib/services/validation/borkValidationService';
import Location from '@/models/Location';
import dbConnect from '@/lib/mongodb';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
    const locationId = searchParams.get('locationId');

    await dbConnect();
    const locations = locationId
      ? await Location.find({ _id: locationId, is_active: true }).lean()
      : await Location.find({ is_active: true }).lean();

    const eitje: Array<{ locationId: string; result: Awaited<ReturnType<typeof validateEitjeTotals>> }> = [];
    const bork: Array<{ locationId: string; result: Awaited<ReturnType<typeof validateBorkTotals>> }> = [];

    for (const loc of locations) {
      const id = loc._id.toString();
      eitje.push({ locationId: id, result: await validateEitjeTotals(date, id) });
      bork.push({ locationId: id, result: await validateBorkTotals(date, id) });
    }

    return NextResponse.json({
      success: true,
      date,
      eitje,
      bork,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
