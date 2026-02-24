/**
 * @registry-id: enrichmentTest
 * @created: 2026-02-22T00:00:00.000Z
 * @last-modified: 2026-02-22T00:00:00.000Z
 *
 * Unit tests for enrichment logic (enrichLaborRecord, enrichSalesRecord).
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { enrichLaborRecord } from '../laborEnrichmentService';
import { enrichSalesRecord } from '../salesEnrichmentService';
import * as masterDataCache from '@/lib/services/cache/masterDataCacheService';

const locId = new ObjectId();
const teamId = new ObjectId();
const productId = new ObjectId();
const categoryId = new ObjectId();
const memberId = new ObjectId();

describe('enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrichLaborRecord', () => {
    it('returns enriched record when cache has member, location, team', () => {
      vi.spyOn(masterDataCache, 'getMember').mockReturnValue({
        _id: memberId,
        name: 'Alice',
        roles: [{ role: 'barista' }],
      });
      vi.spyOn(masterDataCache, 'getLocation').mockReturnValue({
        _id: locId,
        name: 'Store A',
      });
      vi.spyOn(masterDataCache, 'getTeam').mockReturnValue({
        _id: teamId,
        name: 'Front',
        location_id: locId,
      });

      const raw = {
        date: new Date('2026-01-15'),
        member_id: memberId,
        location_id: locId,
        team_id: teamId,
        hours: 8,
        cost: 160,
        hourly_rate: 20,
        contract_type: 'full',
        source: 'eitje-csv' as const,
        imported_at: new Date(),
      };
      const result = enrichLaborRecord(raw);
      expect(result).not.toBeNull();
      expect(result!.member_name).toBe('Alice');
      expect(result!.location_name).toBe('Store A');
      expect(result!.team_name).toBe('Front');
      expect(result!.hours).toBe(8);
      expect(result!.cost).toBe(160);
    });

    it('returns null when member is missing from cache', () => {
      vi.spyOn(masterDataCache, 'getMember').mockReturnValue(undefined);
      vi.spyOn(masterDataCache, 'getLocation').mockReturnValue({ _id: locId, name: 'Store A' });
      vi.spyOn(masterDataCache, 'getTeam').mockReturnValue({ _id: teamId, name: 'Front', location_id: locId });

      const raw = {
        date: new Date('2026-01-15'),
        member_id: memberId,
        location_id: locId,
        team_id: teamId,
        hours: 8,
        cost: 160,
        hourly_rate: 20,
        contract_type: 'full',
        source: 'eitje-csv' as const,
        imported_at: new Date(),
      };
      const result = enrichLaborRecord(raw);
      expect(result).toBeNull();
    });
  });

  describe('enrichSalesRecord', () => {
    it('returns enriched record when cache has product, category, location', () => {
      vi.spyOn(masterDataCache, 'getProduct').mockReturnValue({
        _id: productId,
        name: 'Coffee',
        code: 'COF',
        category_id: categoryId,
        cogs: 0,
        margin: 0,
      });
      vi.spyOn(masterDataCache, 'getCategory').mockReturnValue({
        _id: categoryId,
        name: 'Beverages',
      });
      vi.spyOn(masterDataCache, 'getLocation').mockReturnValue({
        _id: locId,
        name: 'Store A',
      });
      vi.spyOn(masterDataCache, 'getTeam').mockReturnValue(undefined);

      const raw = {
        date: new Date('2026-01-15'),
        product_id: productId,
        category_id: categoryId,
        location_id: locId,
        quantity: 2,
        revenue: 10,
        cogs: 4,
        source: 'bork-csv' as const,
        imported_at: new Date(),
      };
      const result = enrichSalesRecord(raw);
      expect(result).not.toBeNull();
      expect(result!.product_name).toBe('Coffee');
      expect(result!.category_name).toBe('Beverages');
      expect(result!.location_name).toBe('Store A');
      expect(result!.quantity).toBe(2);
      expect(result!.revenue).toBe(10);
      expect(result!.margin).toBe(0.6);
    });

    it('returns null when product is missing from cache', () => {
      vi.spyOn(masterDataCache, 'getProduct').mockReturnValue(undefined);
      vi.spyOn(masterDataCache, 'getCategory').mockReturnValue({ _id: categoryId, name: 'Beverages' });
      vi.spyOn(masterDataCache, 'getLocation').mockReturnValue({ _id: locId, name: 'Store A' });

      const raw = {
        date: new Date('2026-01-15'),
        product_id: productId,
        category_id: categoryId,
        location_id: locId,
        quantity: 2,
        revenue: 10,
        cogs: 4,
        source: 'bork-csv' as const,
        imported_at: new Date(),
      };
      const result = enrichSalesRecord(raw);
      expect(result).toBeNull();
    });
  });
});
