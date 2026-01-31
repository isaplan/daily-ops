/**
 * @registry-id: rawDataTypes
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Layer 1 raw records - IDs only, preserved for enrichment
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/data-sources/eitjeCSVImportService.ts
 *   ✓ app/lib/services/data-sources/eitjeAPIImportService.ts
 *   ✓ app/lib/services/data-sources/borkCSVImportService.ts
 *   ✓ app/lib/services/data-sources/borkAPIImportService.ts
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 */

import type { ObjectId } from 'mongodb';

export interface RawLaborRecord {
  date: Date;
  member_id: ObjectId;
  location_id: ObjectId;
  team_id: ObjectId;
  hours: number;
  cost: number;
  hourly_rate: number;
  cost_per_hour?: number;
  contract_type: string;
  work_type?: string;
  source: 'eitje-csv' | 'eitje-api';
  external_id?: string;
  support_id?: string;
  raw_csv?: Record<string, unknown>;
  raw_api?: Record<string, unknown>;
  imported_at: Date;
}

export interface RawSalesRecord {
  date: Date;
  product_id: ObjectId;
  category_id: ObjectId;
  location_id: ObjectId;
  team_id?: ObjectId;
  quantity: number;
  revenue: number;
  cogs: number;
  source: 'bork-csv' | 'bork-api';
  transaction_id?: string;
  external_id?: string;
  support_id?: string;
  raw_csv?: Record<string, unknown>;
  raw_api?: Record<string, unknown>;
  imported_at: Date;
}
