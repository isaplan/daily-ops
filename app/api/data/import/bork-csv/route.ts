/**
 * @registry-id: borkCsvImportRoute
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: POST - import Bork sales CSV into test-bork-sales-unified
 * @last-fix: [2026-01-30] Initial implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { importBorkSalesCSV } from '@/lib/services/data-sources/borkCSVImportService';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const csvText = body?.csvData ?? body?.csv ?? body?.data;
    if (typeof csvText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing csvData (string)' },
        { status: 400 }
      );
    }
    const options = {
      locationId: body?.locationId,
      locationName: body?.locationName,
    };
    const result = await importBorkSalesCSV(csvText, options);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
