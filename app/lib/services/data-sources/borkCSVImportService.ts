/**
 * @registry-id: borkCSVImportService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Transform Bork CSV (sales/basis) to Layer 1 raw records and store in test-bork-sales-unified
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/data/import/bork-csv/route.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts (reads test-bork-sales-unified)
 */

import mongoose from 'mongoose';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import ProductMaster from '@/models/ProductMaster';
import CategoryMaster from '@/models/CategoryMaster';
import { ensureDailyOpsCollections } from '@/lib/daily-ops/ensure-collections';
import { parseCSV } from '@/lib/utils/csv-parser';
import type { RawSalesRecord } from '@/lib/types/raw-data.types';

const COLLECTION = 'test-bork-sales-unified';

function parseNum(s: string | number): number {
  if (typeof s === 'number' && !Number.isNaN(s)) return s;
  if (!s) return 0;
  const str = String(s).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(str);
  return Number.isNaN(n) ? 0 : n;
}

function parseDate(s: string): Date {
  if (!s) return new Date(NaN);
  const parts = String(s).trim().split(/[/.-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

export interface BorkCSVImportOptions {
  locationId?: string;
  locationName?: string;
}

export interface BorkCSVImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Import Bork sales/basis CSV into test-bork-sales-unified.
 * Expects columns: date/datum, product/productName/code, category, quantity, revenue/total.
 * Optional: location, team. Resolves product by code, category by name, location by name or id.
 */
export async function importBorkSalesCSV(
  csvText: string,
  options: BorkCSVImportOptions = {}
): Promise<BorkCSVImportResult> {
  await dbConnect();
  await ensureDailyOpsCollections();
  const db = await getDatabase();

  const parseResult = await parseCSV(csvText, { autoDetectDelimiter: true });
  if (!parseResult.success || !parseResult.rows?.length) {
    return { success: false, imported: 0, failed: 0, errors: [{ row: 0, error: parseResult.error || 'Parse failed' }] };
  }

  let locationId: mongoose.Types.ObjectId | null = null;
  if (options.locationId) {
    try {
      locationId = new mongoose.Types.ObjectId(options.locationId);
    } catch {
      const loc = await Location.findOne({ name: options.locationName || options.locationId }).lean();
      if (loc) locationId = loc._id as mongoose.Types.ObjectId;
    }
  }
  if (!locationId && options.locationName) {
    const loc = await Location.findOne({ name: options.locationName }).lean();
    if (loc) locationId = loc._id as mongoose.Types.ObjectId;
  }
  if (!locationId) {
    const loc = await Location.findOne({ is_active: true }).lean();
    if (loc) locationId = loc._id as mongoose.Types.ObjectId;
  }
  if (!locationId) {
    return { success: false, imported: 0, failed: parseResult.rows.length, errors: [{ row: 0, error: 'No location found' }] };
  }

  const errors: Array<{ row: number; error: string }> = [];
  let imported = 0;

  for (let i = 0; i < parseResult.rows.length; i++) {
    const row = parseResult.rows[i] as Record<string, unknown>;
    const productCode = (row['code'] ?? row['Code'] ?? row['productCode'] ?? row['ProductCode'] ?? row['product_code']) as string | undefined;
    const productName = (row['product'] ?? row['Product'] ?? row['productName'] ?? row['ProductName'] ?? row['Groep1']) as string | undefined;
    const categoryName = (row['category'] ?? row['Category'] ?? row['categoryName'] ?? row['CategoryName']) as string | undefined;
    const quantity = parseNum((row['quantity'] ?? row['Quantity'] ?? row['Hoeveelheid'] ?? row['qty']) as string);
    const revenue = parseNum((row['revenue'] ?? row['Revenue'] ?? row['total'] ?? row['Total'] ?? row['Totale prijs'] ?? row['totalPrice']) as string);
    const cogs = parseNum((row['cogs'] ?? row['Cogs'] ?? row['cost'] ?? row['Cost']) as string);
    const dateStr = (row['date'] ?? row['Date'] ?? row['datum'] ?? row['Datum']) as string | undefined;
    const date = dateStr ? parseDate(dateStr) : new Date();
    if (Number.isNaN(date.getTime())) {
      errors.push({ row: i + 1, error: 'Invalid date' });
      continue;
    }

    const code = (productCode ?? productName ?? '').toString().trim();
    const name = (productName ?? productCode ?? '').toString().trim();
    if (!code && !name) {
      errors.push({ row: i + 1, error: 'Missing product code or name' });
      continue;
    }

    const product = await ProductMaster.findOne(
      code ? { code, is_active: true } : { name, is_active: true }
    ).lean();
    if (!product) {
      errors.push({ row: i + 1, error: `Product not found: ${code || name}` });
      continue;
    }

    const category = await CategoryMaster.findById(product.category_id).lean();
    if (!category) {
      errors.push({ row: i + 1, error: `Category not found for product: ${product.name}` });
      continue;
    }

    const doc: Omit<RawSalesRecord, 'raw_csv' | 'raw_api'> & { raw_csv?: Record<string, unknown>; raw_api?: undefined } = {
      date,
      product_id: product._id as mongoose.Types.ObjectId,
      category_id: category._id as mongoose.Types.ObjectId,
      location_id: locationId,
      quantity,
      revenue,
      cogs: (cogs || product.cogs) ?? 0,
      source: 'bork-csv',
      imported_at: new Date(),
    };

    try {
      await db.collection(COLLECTION).insertOne(doc);
      imported++;
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Insert failed' });
    }
  }

  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    errors,
  };
}
