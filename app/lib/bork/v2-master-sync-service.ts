/**
 * Run Bork master sync for one location and one endpoint.
 * Used by API route and cron so we don't rely on self-HTTP.
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/master-sync/route.ts
 *   ✓ app/lib/bork/v2-cron-manager.ts
 */

import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb/v2-connection';
import {
  fetchBorkProductGroups,
  fetchBorkPaymentMethods,
  fetchBorkCostCenters,
  fetchBorkUsers,
} from '@/lib/bork/v2-master-data-client';
import { ensureBorkCollections } from '@/lib/bork/v2-ensure-collections';

const ENDPOINTS = ['product_groups', 'payment_methods', 'cost_centers', 'users'] as const;
export type MasterSyncEndpoint = (typeof ENDPOINTS)[number];

export type MasterSyncResult = { success: boolean; recordsSaved: number; error?: string };

export async function runMasterSyncEndpoint(
  locationId: string | null,
  endpoint: MasterSyncEndpoint,
  baseUrl: string,
  apiKey: string
): Promise<MasterSyncResult> {
  try {
    await ensureBorkCollections();
    const db = await getDatabase();
    let locationObjectId: ObjectId | null = null;
    if (locationId) {
      try {
        locationObjectId = new ObjectId(locationId);
      } catch {
        const loc = await db.collection('locations').findOne({
          'systemMappings.externalId': locationId,
          'systemMappings.system': 'bork',
        });
        if (loc) locationObjectId = loc._id;
      }
    }

    let apiData: unknown[] = [];
    switch (endpoint) {
      case 'product_groups':
        apiData = await fetchBorkProductGroups(baseUrl, apiKey);
        break;
      case 'payment_methods':
        apiData = await fetchBorkPaymentMethods(baseUrl, apiKey);
        break;
      case 'cost_centers':
        apiData = await fetchBorkCostCenters(baseUrl, apiKey);
        break;
      case 'users':
        apiData = await fetchBorkUsers(baseUrl, apiKey);
        break;
      default:
        return { success: false, recordsSaved: 0, error: `Unknown endpoint: ${endpoint}` };
    }

    if (!Array.isArray(apiData)) apiData = [];

    let recordsSaved = 0;

    if (endpoint === 'users' && apiData.length > 0) {
      for (const item of apiData as Record<string, unknown>[]) {
        const borkUserId = item.Key ?? item.key;
        if (borkUserId == null) continue;
        const userName = (item.Name ?? item.name) as string | undefined;
        const email = (item.Email ?? item.email) as string | undefined;
        const nameParts = userName ? String(userName).trim().split(/\s+/) : [];
        const firstName = nameParts[0] ?? null;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

        const existing = await db.collection('unified_users').findOne({
          systemMappings: { $elemMatch: { system: 'bork', externalId: String(borkUserId) } },
        });

        const now = new Date();
        if (!existing) {
          await db.collection('unified_users').insertOne({
            firstName,
            lastName,
            email: email ?? null,
            employeeNumber: (item.PersonelId ?? item.NationalId) ?? null,
            isActive: item.IsActive !== false,
            locationIds: locationObjectId ? [locationObjectId] : [],
            teamIds: [],
            systemMappings: [{ system: 'bork', externalId: String(borkUserId), rawData: item }],
            createdAt: now,
            updatedAt: now,
          });
          recordsSaved++;
        } else {
          const updates: Record<string, unknown> = { updatedAt: now };
          if (firstName != null) updates.firstName = firstName;
          if (lastName != null) updates.lastName = lastName;
          if (email != null) updates.email = email;
          const locationIds = (existing.locationIds as ObjectId[]) ?? [];
          if (locationObjectId && !locationIds.some((id) => id.toString() === locationObjectId!.toString())) {
            updates.locationIds = [...locationIds, locationObjectId];
          }
          type Mapping = { system: string; externalId: string; rawData?: unknown };
          const mappings: Mapping[] = (existing.systemMappings as Mapping[]) ?? [];
          const idx = mappings.findIndex((m) => m.system === 'bork' && m.externalId === String(borkUserId));
          if (idx >= 0) {
            mappings[idx] = { system: 'bork', externalId: String(borkUserId), rawData: item };
          } else {
            mappings.push({ system: 'bork', externalId: String(borkUserId), rawData: item });
          }
          updates.systemMappings = mappings;
          await db.collection('unified_users').updateOne({ _id: existing._id }, { $set: updates });
          recordsSaved++;
        }
      }
    } else if (endpoint === 'cost_centers' && apiData.length > 0) {
      const coll = 'bork_cost_centers';
      if (locationObjectId) await db.collection(coll).deleteMany({ locationId: locationObjectId });
      const docs = (apiData as Record<string, unknown>[]).map((item) => ({
        locationId: locationObjectId ?? null,
        rawApiResponse: item,
        centerId: item.Key ?? null,
        name: item.Name ?? null,
        centerNr: item.CenterNr ?? null,
        lastSyncDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      if (docs.length > 0) {
        const result = await db.collection(coll).insertMany(docs);
        recordsSaved = result.insertedCount;
      }
    } else if ((endpoint === 'product_groups' || endpoint === 'payment_methods') && apiData.length > 0) {
      const coll = endpoint === 'product_groups' ? 'bork_product_groups' : 'bork_payment_methods';
      if (locationObjectId) await db.collection(coll).deleteMany({ locationId: locationObjectId });
      const docs = (apiData as Record<string, unknown>[]).map((item) => ({
        locationId: locationObjectId ?? null,
        rawApiResponse: item,
        key: item.Key ?? null,
        name: item.Name ?? null,
        lastSyncDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      if (docs.length > 0) {
        const result = await db.collection(coll).insertMany(docs);
        recordsSaved = result.insertedCount;
      }
    }

    return { success: true, recordsSaved };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, recordsSaved: 0, error: message };
  }
}
