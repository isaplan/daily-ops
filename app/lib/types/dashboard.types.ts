/**
 * @registry-id: dashboardTypes
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Final view contract for Daily Ops dashboard - all names embedded, zero lookups
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 *   ✓ app/actions/daily-ops.ts
 *   ✓ app/lib/hooks/useDailyOpsDashboard.ts
 *   ✓ app/components/dashboard/*.tsx
 */

import type { ObjectId } from 'mongodb';

export interface DashboardTeamRevenue {
  team_id: ObjectId;
  team_name: string;
  location_id: ObjectId;
  location_name: string;
  revenue: number;
  staff_count?: number;
}

export interface DashboardProduct {
  product_id: ObjectId;
  product_name: string;
  product_code?: string;
  category_id: ObjectId;
  category_name: string;
  quantity: number;
  revenue: number;
  cogs: number;
  margin: number;
  source?: 'bork-csv' | 'bork-api';
}

export interface DashboardLaborMember {
  member_id: ObjectId;
  member_name: string;
  member_role: string;
  hours: number;
  cost: number;
  hourly_rate: number;
  cost_per_hour?: number;
  productivity?: number;
  contract_type?: string;
}

export interface DashboardLaborTeam {
  team_id: ObjectId;
  team_name: string;
  location_id: ObjectId;
  location_name: string;
  hours: number;
  cost: number;
  cost_percentage?: number;
  staff_count: number;
  revenue_per_hour?: number;
  productivity?: string;
  members: DashboardLaborMember[];
}

export interface DashboardRevenue {
  total: number;
  total_ex_vat?: number;
  total_inc_vat?: number;
  byProduct: DashboardProduct[];
  byCategory?: Array<{ category_id: ObjectId; category_name: string; revenue: number; qty: number }>;
  byTeam: DashboardTeamRevenue[];
  average_transaction_value?: number;
  transaction_count?: number;
  best_combination?: { products: string[]; frequency: number; total_revenue: number; profit_margin?: number };
  most_sold_product?: { name: string; quantity: number; revenue: number };
  most_profitable_product?: { name: string; margin: number; revenue: number };
}

export interface DashboardLabor {
  total_hours: number;
  total_cost: number;
  total_staff?: number;
  labor_cost_percentage?: number;
  revenue_per_hour?: number;
  cost_per_hour?: number;
  byTeam: DashboardLaborTeam[];
  source?: 'eitje-csv' | 'eitje-api';
  csv_verified?: boolean;
  api_verified?: boolean;
}

export interface DashboardProducts {
  top_sellers?: Array<{ product_id: ObjectId; product_name: string; quantity: number; revenue: number; percent_of_total?: number }>;
  top_profitable?: Array<{ product_id: ObjectId; product_name: string; margin: number; revenue: number; cogs?: number }>;
  best_combination?: { products: string[]; frequency: number; revenue: number; profit_margin?: number; recommendation?: string };
  by_product?: DashboardProduct[];
}

export interface DashboardKPIs {
  revenue: number;
  labor_cost: number;
  food_cost?: number;
  gross_profit?: number;
  profit_margin?: number;
  labor_cost_percentage: number;
  food_cost_percentage?: number;
  profit_percentage?: number;
  revenue_per_hour?: number;
  revenue_per_staff?: number;
  transactions?: number;
  average_ticket_size?: number;
  staff_count?: number;
  health?: Record<string, 'green' | 'yellow' | 'red'>;
  recommendations?: string[];
}

export interface DashboardSources {
  eitje?: { hours_records?: number; contract_records?: number; csv_verified?: boolean; api_verified?: boolean; last_sync?: string; sync_status?: string };
  bork?: { sales_records?: number; basis_report_records?: number; total_revenue?: number; csv_verified?: boolean; api_verified?: boolean; last_sync?: string; sync_status?: string };
  validation?: { eitje_vs_csv?: { matches: boolean; variance?: number }; bork_vs_csv?: { matches: boolean; variance?: number }; last_validated?: string };
}

export interface DailyOpsDashboard {
  _id: ObjectId;
  date: string;
  location_id: ObjectId;
  location?: { _id: ObjectId; name: string; address?: string; city?: string; country?: string };
  revenue: DashboardRevenue;
  labor: DashboardLabor;
  products: DashboardProducts;
  kpis: DashboardKPIs;
  sources: DashboardSources;
  metadata?: { createdAt: string; updatedAt: string; version?: number; data_quality?: string };
}
