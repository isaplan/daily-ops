/**
 * @registry-id: dailyOpsAggregationTest
 * @created: 2026-02-22T00:00:00.000Z
 * @last-modified: 2026-02-22T00:00:00.000Z
 *
 * Unit tests for Daily Ops aggregation logic (buildRevenue, buildLabor, buildProducts, buildKPIs).
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  buildRevenue,
  buildLabor,
  buildProducts,
  buildKPIs,
} from '../dailyOpsAggregationService';
import type { EnrichedLaborRecord } from '@/lib/types/enrichment.types';
import type { EnrichedSalesRecord } from '@/lib/types/enrichment.types';

const locId = new ObjectId();
const teamId = new ObjectId();
const productId = new ObjectId();
const categoryId = new ObjectId();
const memberId = new ObjectId();

describe('dailyOpsAggregationService', () => {
  describe('buildRevenue', () => {
    it('sums total revenue from enriched sales', () => {
      const sales: EnrichedSalesRecord[] = [
        {
          date: new Date('2026-01-15'),
          product_id: productId,
          product_name: 'Coffee',
          product_code: 'COF',
          category_id: categoryId,
          category_name: 'Beverages',
          location_id: locId,
          location_name: 'Store A',
          quantity: 2,
          revenue: 10,
          cogs: 4,
          margin: 0.6,
          source: 'bork-csv',
        },
        {
          date: new Date('2026-01-15'),
          product_id: productId,
          product_name: 'Coffee',
          product_code: 'COF',
          category_id: categoryId,
          category_name: 'Beverages',
          location_id: locId,
          location_name: 'Store A',
          quantity: 1,
          revenue: 5,
          cogs: 2,
          margin: 0.6,
          source: 'bork-csv',
        },
      ];
      const revenue = buildRevenue(sales);
      expect(revenue.total).toBe(15);
      expect(revenue.byProduct).toHaveLength(1);
      expect(revenue.byProduct[0].quantity).toBe(3);
      expect(revenue.byProduct[0].revenue).toBe(15);
    });

    it('returns zero total for empty sales', () => {
      const revenue = buildRevenue([]);
      expect(revenue.total).toBe(0);
      expect(revenue.byProduct).toHaveLength(0);
    });
  });

  describe('buildLabor', () => {
    it('sums hours and cost and groups by team and member', () => {
      const labor: EnrichedLaborRecord[] = [
        {
          date: new Date('2026-01-15'),
          member_id: memberId,
          member_name: 'Alice',
          member_role: 'staff',
          location_id: locId,
          location_name: 'Store A',
          team_id: teamId,
          team_name: 'Front',
          hours: 4,
          cost: 80,
          hourly_rate: 20,
          contract_type: 'full',
          source: 'eitje-csv',
        },
        {
          date: new Date('2026-01-15'),
          member_id: memberId,
          member_name: 'Alice',
          member_role: 'staff',
          location_id: locId,
          location_name: 'Store A',
          team_id: teamId,
          team_name: 'Front',
          hours: 2,
          cost: 40,
          hourly_rate: 20,
          contract_type: 'full',
          source: 'eitje-csv',
        },
      ];
      const result = buildLabor(labor);
      expect(result.total_hours).toBe(6);
      expect(result.total_cost).toBe(120);
      expect(result.byTeam).toHaveLength(1);
      expect(result.byTeam[0].team_name).toBe('Front');
      expect(result.byTeam[0].hours).toBe(6);
      expect(result.byTeam[0].cost).toBe(120);
      expect(result.byTeam[0].members).toHaveLength(1);
      expect(result.byTeam[0].members[0].hours).toBe(6);
      expect(result.byTeam[0].members[0].cost).toBe(120);
    });

    it('returns zero for empty labor', () => {
      const result = buildLabor([]);
      expect(result.total_hours).toBe(0);
      expect(result.total_cost).toBe(0);
      expect(result.byTeam).toHaveLength(0);
    });
  });

  describe('buildProducts', () => {
    it('builds top_sellers and top_profitable from enriched sales', () => {
      const sales: EnrichedSalesRecord[] = [
        {
          date: new Date('2026-01-15'),
          product_id: productId,
          product_name: 'Coffee',
          product_code: 'COF',
          category_id: categoryId,
          category_name: 'Beverages',
          location_id: locId,
          location_name: 'Store A',
          quantity: 10,
          revenue: 50,
          cogs: 20,
          margin: 0.6,
          source: 'bork-csv',
        },
      ];
      const products = buildProducts(sales);
      expect(products.top_sellers).toBeDefined();
      expect(products.top_sellers!.length).toBeGreaterThanOrEqual(1);
      expect(products.top_profitable).toBeDefined();
      expect(products.by_product).toBeDefined();
      expect(products.by_product!.length).toBe(1);
      expect(products.by_product![0].product_name).toBe('Coffee');
      expect(products.by_product![0].revenue).toBe(50);
    });
  });

  describe('buildKPIs', () => {
    it('computes labor cost percentage and revenue per hour', () => {
      const revenue = buildRevenue([]);
      revenue.total = 1000;
      const labor = buildLabor([]);
      labor.total_hours = 40;
      labor.total_cost = 400;
      labor.byTeam = [
        {
          team_id: teamId,
          team_name: 'Front',
          location_id: locId,
          location_name: 'Store A',
          hours: 40,
          cost: 400,
          staff_count: 2,
          members: [],
        },
      ];
      const kpis = buildKPIs(revenue, labor);
      expect(kpis.revenue).toBe(1000);
      expect(kpis.labor_cost).toBe(400);
      expect(kpis.labor_cost_percentage).toBe(40);
      expect(kpis.revenue_per_hour).toBe(25);
      expect(kpis.staff_count).toBe(2);
    });
  });
});
