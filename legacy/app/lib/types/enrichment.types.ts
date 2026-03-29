/**
 * @registry-id: enrichmentTypes
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Enriched records (Layer 2) - IDs + names for aggregation
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */

import type { ObjectId } from 'mongodb';

export interface EnrichedLaborRecord {
  date: Date;
  member_id: ObjectId;
  member_name: string;
  member_role: string;
  location_id: ObjectId;
  location_name: string;
  team_id: ObjectId;
  team_name: string;
  hours: number;
  cost: number;
  hourly_rate: number;
  cost_per_hour?: number;
  contract_type: string;
  work_type?: string;
  source: 'eitje-csv' | 'eitje-api';
  external_id?: string;
  support_id?: string;
}

export interface EnrichedSalesRecord {
  date: Date;
  product_id: ObjectId;
  product_name: string;
  product_code: string;
  category_id: ObjectId;
  category_name: string;
  location_id: ObjectId;
  location_name: string;
  team_id?: ObjectId;
  team_name?: string;
  quantity: number;
  revenue: number;
  cogs: number;
  margin: number;
  source: 'bork-csv' | 'bork-api';
  transaction_id?: string;
  external_id?: string;
  support_id?: string;
}
