/**
 * @registry-id: masterDataCacheService
 * @created: 2026-01-30T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Cache service for master data (members, locations, teams, products, categories)
 * @last-fix: [2026-01-30] Initial implementation
 *
 * @exports-to:
 *   ✓ app/lib/services/enrichment/laborEnrichmentService.ts
 *   ✓ app/lib/services/enrichment/salesEnrichmentService.ts
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts
 */

import type { ObjectId } from 'mongodb';
import dbConnect from '@/lib/mongodb';
import Member from '@/models/Member';
import Location from '@/models/Location';
import Team from '@/models/Team';
import ProductMaster from '@/models/ProductMaster';
import CategoryMaster from '@/models/CategoryMaster';
import ContractTypeMaster from '@/models/ContractTypeMaster';

type MemberDoc = { _id: ObjectId; name: string; roles?: Array<{ role: string }> };
type LocationDoc = { _id: ObjectId; name: string };
type TeamDoc = { _id: ObjectId; name: string; location_id: ObjectId };
type ProductDoc = { _id: ObjectId; name: string; code: string; category_id: ObjectId; cogs: number; margin: number };
type CategoryDoc = { _id: ObjectId; name: string };
type ContractDoc = { _id: ObjectId; code: string; name: string; hourly_rate: number };

const memberCache = new Map<string, MemberDoc>();
const locationCache = new Map<string, LocationDoc>();
const teamCache = new Map<string, TeamDoc>();
const productCache = new Map<string, ProductDoc>();
const categoryCache = new Map<string, CategoryDoc>();
const contractCache = new Map<string, ContractDoc>();

let loaded = false;

export async function loadAllMasterData(): Promise<void> {
  if (loaded) return;
  await dbConnect();

  const [members, locations, teams, products, categories, contracts] = await Promise.all([
    Member.find({ is_active: true }).lean().exec(),
    Location.find({ is_active: true }).lean().exec(),
    Team.find({ is_active: true }).lean().exec(),
    ProductMaster.find({ is_active: true }).lean().exec(),
    CategoryMaster.find({ is_active: true }).lean().exec(),
    ContractTypeMaster.find({ is_active: true }).lean().exec(),
  ]);

  memberCache.clear();
  locationCache.clear();
  teamCache.clear();
  productCache.clear();
  categoryCache.clear();
  contractCache.clear();

  for (const m of members as MemberDoc[]) {
    memberCache.set(m._id.toString(), m);
  }
  for (const l of locations as LocationDoc[]) {
    locationCache.set(l._id.toString(), l);
  }
  for (const t of teams as TeamDoc[]) {
    teamCache.set(t._id.toString(), t);
  }
  for (const p of products as ProductDoc[]) {
    productCache.set(p._id.toString(), p);
  }
  for (const c of categories as CategoryDoc[]) {
    categoryCache.set(c._id.toString(), c);
  }
  for (const c of contracts as ContractDoc[]) {
    contractCache.set(c._id.toString(), c);
  }

  loaded = true;
}

export function getMember(id: ObjectId | null | undefined): MemberDoc | undefined {
  if (!id) return undefined;
  return memberCache.get(id.toString());
}

export function getLocation(id: ObjectId | null | undefined): LocationDoc | undefined {
  if (!id) return undefined;
  return locationCache.get(id.toString());
}

export function getTeam(id: ObjectId | null | undefined): TeamDoc | undefined {
  if (!id) return undefined;
  return teamCache.get(id.toString());
}

export function getProduct(id: ObjectId | null | undefined): ProductDoc | undefined {
  if (!id) return undefined;
  return productCache.get(id.toString());
}

export function getCategory(id: ObjectId | null | undefined): CategoryDoc | undefined {
  if (!id) return undefined;
  return categoryCache.get(id.toString());
}

export function getContractType(id: ObjectId | null | undefined): ContractDoc | undefined {
  if (!id) return undefined;
  return contractCache.get(id.toString());
}

export function clearMasterDataCache(): void {
  loaded = false;
  memberCache.clear();
  locationCache.clear();
  teamCache.clear();
  productCache.clear();
  categoryCache.clear();
  contractCache.clear();
}
