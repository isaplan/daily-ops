/**
 * @registry-id: unifiedCollectionsService
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-26T00:00:00.000Z
 * @description: Service to create unified collections that merge IDs and names from all sources (Eitje, internal models, etc.)
 * @last-fix: [2026-01-26] CRITICAL FIX: Now extracts user names from time_registration_shifts and planning_shifts endpoints (extracted.user_name, rawApiResponse.user.name) in addition to users endpoint. This fixes "Unknown" user names in unified_user collection.
 * 
 * @imports-from:
 *   - app/lib/mongodb/v2-connection.ts => getDatabase
 *   - app/lib/mongodb.ts => dbConnect
 *   - app/models/Location.ts => Location model
 *   - app/models/Team.ts => Team model
 *   - app/models/Member.ts => Member model
 * 
 * @exports-to:
 *   ✓ app/api/aggregations/sync/route.ts => triggers unified collection updates
 *   ✓ app/lib/cron/v2-cron-manager.ts => scheduled unified collection updates
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import dbConnect from '@/lib/mongodb';
import Location from '@/models/Location';
import Team from '@/models/Team';
import Member from '@/models/Member';
import { ObjectId } from 'mongodb';

/**
 * Get location abbreviation from name
 */
function getLocationAbbreviation(name: string): string | undefined {
  if (!name) return undefined;
  
  const nameLower = name.toLowerCase().trim();
  
  // Known abbreviations - check exact matches first, then normalized
  const knownAbbrevs: Record<string, string> = {
    'van kinsbergen': 'VKB',
    'kinsbergen': 'VKB',
    "l'amour toujours": 'LAT',
    "lamour toujours": 'LAT',
    'lamour': 'LAT',
    'bar bea': 'BEA',
    'barbea': 'BEA',
  };
  
  // Try exact match first
  if (knownAbbrevs[nameLower]) {
    return knownAbbrevs[nameLower];
  }
  
  // Try normalized match
  const normalized = normalizeLocationName(name);
  return knownAbbrevs[normalized] || undefined;
}

/**
 * Normalize location name for matching (remove special chars, lowercase, trim)
 */
function normalizeLocationName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .trim();
}

/**
 * Check if two location names match (handles variations)
 */
function locationNamesMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeLocationName(name1);
  const norm2 = normalizeLocationName(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  if (norm1.length > 3 && norm2.length > 3) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  return false;
}

interface UnifiedLocation {
  _id?: ObjectId;
  // Primary ID (from internal Location model)
  primaryId: ObjectId;
  primaryName: string;
  
  // Eitje mappings
  eitjeIds: number[];
  eitjeNames: string[];
  
  // All known IDs across sources
  allIds: {
    source: 'internal' | 'eitje';
    id: string | number | ObjectId;
    name?: string;
  }[];
  
  // Unified canonical name (prefer internal, fallback to Eitje)
  canonicalName: string;
  
  // Abbreviation (e.g., VKB, BEA, LAT)
  abbreviation?: string;
  
  // Metadata
  isActive: boolean;
  lastSeen: Date;
  updatedAt: Date;
}

interface UnifiedTeam {
  _id?: ObjectId;
  // Primary ID (from internal Team model)
  primaryId?: ObjectId;
  primaryName?: string;
  
  // Eitje mappings
  eitjeIds: number[];
  eitjeNames: string[];
  
  // Location reference
  locationId?: ObjectId;
  
  // All known IDs across sources
  allIds: {
    source: 'internal' | 'eitje';
    id: string | number | ObjectId;
    name?: string;
  }[];
  
  // Unified canonical name
  canonicalName: string;
  
  // Metadata
  isActive: boolean;
  lastSeen: Date;
  updatedAt: Date;
}

interface UnifiedUser {
  _id?: ObjectId;
  // Primary ID (from internal Member model)
  primaryId?: ObjectId;
  primaryName?: string;
  primaryEmail?: string;
  
  // Eitje mappings
  eitjeIds: number[];
  eitjeNames: string[];
  eitjeEmails: string[];
  
  // Slack mappings
  slackId?: string;
  slackUsername?: string;
  
  // All known IDs across sources (detailed)
  allIds: {
    source: 'internal' | 'eitje' | 'slack';
    id: string | number | ObjectId;
    name?: string;
    email?: string;
  }[];
  
  // FLAT array of all IDs for easy lookup in aggregation $in operations
  allIdValues?: (string | number | ObjectId)[];
  
  // Unified canonical name
  canonicalName: string;
  canonicalEmail?: string;
  
  // Master data from Eitje users endpoint (for cost calculations and contract allocation)
  hourly_rate?: number;
  contract_type?: string;
  contract_info?: any; // Store full contract object if available
  team_id?: number; // Eitje team ID from users endpoint
  team_name?: string; // Team name from users endpoint
  // Add other master data fields as needed (phone, address, etc.)
  
  // Metadata
  isActive: boolean;
  lastSeen: Date;
  updatedAt: Date;
}

/**
 * Sync unified locations collection
 */
export async function syncUnifiedLocations(): Promise<{ created: number; updated: number }> {
  await dbConnect();
  const db = await getDatabase();
  
  // Get all existing unified locations first to prevent duplicates
  const existingUnified = await db.collection('unified_location').find({}).toArray();
  const existingByCanonicalName = new Map<string, UnifiedLocation>();
  const existingByEitjeId = new Map<number, UnifiedLocation>();
  const existingByPrimaryId = new Map<string, UnifiedLocation>();
  
  for (const existing of existingUnified) {
    const canonicalName = (existing.canonicalName || '').toLowerCase().trim();
    if (canonicalName) {
      existingByCanonicalName.set(canonicalName, existing as UnifiedLocation);
    }
    if (existing.eitjeIds && Array.isArray(existing.eitjeIds)) {
      for (const eitjeId of existing.eitjeIds) {
        existingByEitjeId.set(Number(eitjeId), existing as UnifiedLocation);
      }
    }
    if (existing.primaryId) {
      existingByPrimaryId.set(existing.primaryId.toString(), existing as UnifiedLocation);
    }
  }
  
  // Get all internal locations (use collection directly to access systemMappings)
  const internalLocations = await db.collection('locations').find({}).toArray();
  
  // Get all Eitje environment data from eitje_raw_data
  const eitjeEnvironments = await db.collection('eitje_raw_data')
    .find({ endpoint: 'environments' })
    .toArray();
  
  // Build mapping: locationId -> unified data
  const unifiedMap = new Map<string, UnifiedLocation>();
  
  // Process internal locations
  for (const loc of internalLocations) {
    const locId = loc._id.toString();
    
    // Check if we already have this in existing unified locations
    let unified: UnifiedLocation | undefined = existingByPrimaryId.get(locId);
    
    if (!unified) {
      const locName = loc.name || 'Unknown';
      unified = {
        primaryId: loc._id,
        primaryName: locName,
        eitjeIds: [],
        eitjeNames: [],
        allIds: [{
          source: 'internal',
          id: loc._id,
          name: loc.name,
        }],
        canonicalName: locName,
        abbreviation: getLocationAbbreviation(locName),
        isActive: loc.is_active !== false, // Default to true if not explicitly false
        lastSeen: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // Update existing
      unified.primaryName = loc.name || unified.primaryName;
      unified.isActive = loc.is_active !== false;
      unified.lastSeen = new Date();
      unified.updatedAt = new Date();
    }
    
    unifiedMap.set(locId, unified);
    
    // Check for Eitje mappings in systemMappings
    if (loc.systemMappings && Array.isArray(loc.systemMappings)) {
      const eitjeMapping = loc.systemMappings.find((m: any) => m.system === 'eitje');
      if (eitjeMapping) {
        const eitjeId = Number(eitjeMapping.externalId);
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
        }
      }
    }
  }
  
  // Process Eitje environments
  for (const env of eitjeEnvironments) {
    const eitjeId = env.extracted?.id || env.rawApiResponse?.id;
    const eitjeName = env.extracted?.name || env.rawApiResponse?.name || 'Unknown';
    const locationId = env.locationId;
    
    if (!eitjeId) continue;
    
    if (locationId) {
      // Already mapped to internal location
      const locId = locationId.toString();
      if (unifiedMap.has(locId)) {
        const unified = unifiedMap.get(locId)!;
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
          if (!unified.eitjeNames.includes(eitjeName)) {
            unified.eitjeNames.push(eitjeName);
          }
          unified.allIds.push({
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          });
        }
      }
    } else {
      // Unmapped Eitje environment - find existing by name or eitjeId, or create new
      const canonicalNameLower = eitjeName.toLowerCase().trim();
      let unified = existingByEitjeId.get(Number(eitjeId)) || 
                    existingByCanonicalName.get(canonicalNameLower);
      
      if (!unified) {
        // Create new unified entry with stable primaryId
        // Use the existing primaryId if found by name, otherwise generate new one
        const key = `eitje_${eitjeId}`;
        unified = {
          primaryId: new ObjectId(), // Will be stable once saved
          primaryName: eitjeName,
          eitjeIds: [eitjeId],
          eitjeNames: [eitjeName],
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          }],
          canonicalName: eitjeName,
          abbreviation: getLocationAbbreviation(eitjeName),
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        };
        unifiedMap.set(key, unified);
      } else {
        // Update existing
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
        }
        if (!unified.eitjeNames.includes(eitjeName)) {
          unified.eitjeNames.push(eitjeName);
        }
        unified.lastSeen = new Date();
        unified.updatedAt = new Date();
        // Use existing primaryId as key
        unifiedMap.set(unified.primaryId.toString(), unified);
      }
    }
  }
  
  // Upsert all unified locations - use canonicalName as fallback key to prevent duplicates
  const operations = Array.from(unifiedMap.values()).map((unified) => {
    // Use primaryId if available, otherwise use canonicalName for matching
    const filter = unified.primaryId 
      ? { primaryId: unified.primaryId }
      : { canonicalName: unified.canonicalName };
    
    return {
      updateOne: {
        filter: filter,
        update: { $set: unified },
        upsert: true,
      }
    };
  });
  
  const result = await db.collection('unified_location').bulkWrite(operations);
  
  // Clean up duplicates: merge locations with matching canonical names (handles variations)
  const allUnified = await db.collection('unified_location').find({}).toArray();
  const processed = new Set<string>();
  let mergedCount = 0;
  
  for (let i = 0; i < allUnified.length; i++) {
    const loc = allUnified[i];
    const locId = loc._id.toString();
    
    if (processed.has(locId)) continue;
    
    // Find all locations that match this one (by normalized name)
    const matches: any[] = [loc];
    const locName = loc.canonicalName || loc.primaryName || '';
    
    for (let j = i + 1; j < allUnified.length; j++) {
      const otherLoc = allUnified[j];
      const otherId = otherLoc._id.toString();
      
      if (processed.has(otherId)) continue;
      
      const otherName = otherLoc.canonicalName || otherLoc.primaryName || '';
      
      // Check if names match (handles variations)
      if (locationNamesMatch(locName, otherName)) {
        matches.push(otherLoc);
        processed.add(otherId);
      }
    }
    
    if (matches.length > 1) {
      // Merge duplicates - keep the best one
      matches.sort((a, b) => {
        // Prefer ones with primaryId from internal locations
        if (a.primaryId && !b.primaryId) return -1;
        if (!a.primaryId && b.primaryId) return 1;
        // Prefer ones with more eitjeIds (more complete)
        const aEitjeCount = (a.eitjeIds || []).length;
        const bEitjeCount = (b.eitjeIds || []).length;
        if (aEitjeCount !== bEitjeCount) return bEitjeCount - aEitjeCount;
        // Prefer older ones
        return new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      });
      
      const keep = matches[0];
      const merge = matches.slice(1);
      
      // Use the most complete canonical name (longest, most descriptive)
      const bestName = matches.reduce((best, curr) => {
        const currName = curr.canonicalName || curr.primaryName || '';
        const bestName = best.canonicalName || best.primaryName || '';
        return currName.length > bestName.length ? curr : best;
      }, keep);
      
      // Merge eitjeIds, eitjeNames, allIds
      const mergedEitjeIds = new Set(keep.eitjeIds || []);
      const mergedEitjeNames = new Set(keep.eitjeNames || []);
      const mergedAllIds = [...(keep.allIds || [])];
      
      for (const dup of merge) {
        if (dup.eitjeIds) {
          for (const id of dup.eitjeIds) mergedEitjeIds.add(id);
        }
        if (dup.eitjeNames) {
          for (const name of dup.eitjeNames) mergedEitjeNames.add(name);
        }
        if (dup.allIds) {
          for (const idObj of dup.allIds) {
            if (!mergedAllIds.find((e: any) => 
              e.source === idObj.source && 
              String(e.id) === String(idObj.id)
            )) {
              mergedAllIds.push(idObj);
            }
          }
        }
      }
      
      // Update the kept one with merged data and best canonical name
      await db.collection('unified_location').updateOne(
        { _id: keep._id },
        {
          $set: {
            canonicalName: bestName.canonicalName || bestName.primaryName,
            eitjeIds: Array.from(mergedEitjeIds),
            eitjeNames: Array.from(mergedEitjeNames),
            allIds: mergedAllIds,
            abbreviation: getLocationAbbreviation(bestName.canonicalName || bestName.primaryName),
            updatedAt: new Date(),
          }
        }
      );
      
      // Delete the duplicates
      const duplicateIds = merge.map((d: any) => d._id);
      await db.collection('unified_location').deleteMany({
        _id: { $in: duplicateIds }
      });
      
      mergedCount += merge.length;
      processed.add(locId);
    } else {
      processed.add(locId);
    }
  }
  
  if (mergedCount > 0) {
    console.log(`[syncUnifiedLocations] Merged ${mergedCount} duplicate locations`);
  }
  
  return {
    created: result.upsertedCount,
    updated: result.modifiedCount,
  };
}

/**
 * Sync unified teams collection
 */
export async function syncUnifiedTeams(): Promise<{ created: number; updated: number }> {
  await dbConnect();
  const db = await getDatabase();
  
  // Get all internal teams (use collection directly)
  const internalTeams = await db.collection('teams').find({}).toArray();
  
  // Get all Eitje team data from eitje_raw_data
  const eitjeTeams = await db.collection('eitje_raw_data')
    .find({ endpoint: 'teams' })
    .toArray();
  
  // Build mapping: teamId -> unified data
  const unifiedMap = new Map<string, UnifiedTeam>();
  
  // Process internal teams
  for (const team of internalTeams) {
    const teamId = team._id.toString();
    
    unifiedMap.set(teamId, {
      primaryId: team._id,
      primaryName: team.name || 'Unknown',
      eitjeIds: [],
      eitjeNames: [],
      locationId: team.location_id,
      allIds: [{
        source: 'internal',
        id: team._id,
        name: team.name || 'Unknown',
      }],
      canonicalName: team.name || 'Unknown',
      isActive: team.is_active !== false, // Default to true if not explicitly false
      lastSeen: new Date(),
      updatedAt: new Date(),
    });
  }
  
  // Process Eitje teams
  for (const team of eitjeTeams) {
    const eitjeId = team.extracted?.id || team.rawApiResponse?.id;
    const eitjeName = team.extracted?.name || team.rawApiResponse?.name || 'Unknown';
    const locationId = team.locationId;
    
    if (!eitjeId) continue;
    
    // Try to find matching internal team by name or location
    let matched = false;
    if (locationId) {
      const internalTeam = internalTeams.find(
        (t) => t.location_id?.toString() === locationId.toString() && 
               t.name.toLowerCase() === eitjeName.toLowerCase()
      );
      
      if (internalTeam) {
        const teamId = internalTeam._id.toString();
        const unified = unifiedMap.get(teamId)!;
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
          unified.eitjeNames.push(eitjeName);
          unified.allIds.push({
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          });
        }
        matched = true;
      }
    }
    
    if (!matched) {
      // Unmapped Eitje team
      const key = `eitje_${eitjeId}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          eitjeIds: [eitjeId],
          eitjeNames: [eitjeName],
          locationId: locationId,
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          }],
          canonicalName: eitjeName,
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
  
  // Upsert all unified teams
  const operations = Array.from(unifiedMap.values()).map((unified, index) => {
    // Use primaryId if available, otherwise use eitjeId as key
    const filterKey = unified.primaryId || 
                     (unified.eitjeIds.length > 0 ? { eitjeIds: unified.eitjeIds[0] } : { _temp: index });
    
    return {
      updateOne: {
        filter: unified.primaryId ? { primaryId: unified.primaryId } : { eitjeIds: unified.eitjeIds[0] },
        update: { $set: unified },
        upsert: true,
      }
    };
  });
  
  const result = await db.collection('unified_team').bulkWrite(operations);
  
  return {
    created: result.upsertedCount,
    updated: result.modifiedCount,
  };
}

/**
 * Sync unified users collection
 */
export async function syncUnifiedUsers(): Promise<{ created: number; updated: number }> {
  await dbConnect();
  const db = await getDatabase();
  
  // Get all internal members (use collection directly)
  const internalMembers = await db.collection('members').find({}).toArray();
  
  // Get all Eitje user data from eitje_raw_data (users endpoint)
  const eitjeUsers = await db.collection('eitje_raw_data')
    .find({ endpoint: 'users' })
    .toArray();
  
  // Also extract user names from time_registration_shifts and planning_shifts
  // These endpoints have user_name in extracted or rawApiResponse.user.name
  const shiftUsers = await db.collection('eitje_raw_data')
    .aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { endpoint: 'time_registration_shifts' },
                { endpoint: 'planning_shifts' }
              ]
            },
            {
              $or: [
                { 'extracted.userId': { $ne: null } },
                { 'rawApiResponse.user_id': { $ne: null } },
                { 'rawApiResponse.user.id': { $ne: null } }
              ]
            }
          ]
        }
      },
      {
        $group: {
          _id: {
            $ifNull: [
              '$extracted.userId',
              {
                $ifNull: [
                  '$rawApiResponse.user_id',
                  '$rawApiResponse.user.id'
                ]
              }
            ]
          },
          user_name: {
            $first: {
              $ifNull: [
                '$extracted.user_name',
                {
                  $ifNull: [
                    '$rawApiResponse.user_name',
                    {
                      $ifNull: [
                        '$rawApiResponse.user?.name',
                        'Unknown'
                      ]
                    }
                  ]
                }
              ]
            }
          },
          user_email: {
            $first: {
              $ifNull: [
                '$extracted.user_email',
                {
                  $ifNull: [
                    '$rawApiResponse.user_email',
                    '$rawApiResponse.user?.email'
                  ]
                }
              ]
            }
          }
        }
      }
    ])
    .toArray();
  
  // Build mapping: email -> unified data (email is most reliable identifier)
  const unifiedMap = new Map<string, UnifiedUser>();
  
  // Process internal members
  for (const member of internalMembers) {
    const email = (member.email || '').toLowerCase();
    if (!email) continue; // Skip members without email
    
    unifiedMap.set(email, {
      primaryId: member._id,
      primaryName: member.name || 'Unknown',
      primaryEmail: member.email,
      eitjeIds: [],
      eitjeNames: [],
      eitjeEmails: [],
      slackId: member.slack_id,
      slackUsername: member.slack_username,
      allIds: [{
        source: 'internal',
        id: member._id,
        name: member.name || 'Unknown',
        email: member.email,
      }],
      canonicalName: member.name || 'Unknown',
      canonicalEmail: member.email,
      // Include hourly_rate from Member if available (synced from Eitje)
      hourly_rate: (member as any).hourly_rate,
      isActive: member.is_active !== false, // Default to true if not explicitly false
      lastSeen: member.last_seen ? new Date(member.last_seen) : new Date(),
      updatedAt: new Date(),
    });
    
    // Add Slack ID if available
    if (member.slack_id) {
      const unified = unifiedMap.get(email)!;
      unified.allIds.push({
        source: 'slack',
        id: member.slack_id,
        name: member.slack_username,
      });
    }
  }
  
  // Process Eitje users - extract master data (hourly_rate, contract_type, etc.)
  for (const user of eitjeUsers) {
    const eitjeId = user.extracted?.id || user.rawApiResponse?.id;
    const eitjeName = user.extracted?.name || user.rawApiResponse?.name || 'Unknown';
    const eitjeEmail = user.extracted?.email || user.rawApiResponse?.email;
    
    // Extract master data fields
    const hourlyRate = user.extracted?.hourlyRate || user.rawApiResponse?.hourly_rate || user.rawApiResponse?.hourly_wage || user.rawApiResponse?.wage || user.rawApiResponse?.rate;
    const contractType = user.extracted?.contractType || user.rawApiResponse?.contract_type || user.rawApiResponse?.contractType;
    const contractInfo = user.extracted?.contractInfo || user.rawApiResponse?.contract_info || user.rawApiResponse?.contract;
    const teamId = user.extracted?.teamId || user.rawApiResponse?.team_id || user.rawApiResponse?.team?.id;
    const teamName = user.extracted?.teamName || user.rawApiResponse?.team_name || user.rawApiResponse?.team?.name;
    
    if (!eitjeId) continue;
    
    if (eitjeEmail) {
      const email = eitjeEmail.toLowerCase();
      
      if (unifiedMap.has(email)) {
        // Match by email - update master data
        const unified = unifiedMap.get(email)!;
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
          unified.eitjeNames.push(eitjeName);
          unified.eitjeEmails.push(eitjeEmail);
          unified.allIds.push({
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
            email: eitjeEmail,
          });
        } else {
          // Update existing eitje entry if name is better (not "Unknown")
          const eitjeIndex = unified.eitjeIds.indexOf(eitjeId);
          if (eitjeIndex >= 0 && eitjeName !== 'Unknown' && unified.eitjeNames[eitjeIndex] === 'Unknown') {
            unified.eitjeNames[eitjeIndex] = eitjeName;
            // Update allIds entry
            const allIdsIndex = unified.allIds.findIndex(a => a.source === 'eitje' && a.id === eitjeId);
            if (allIdsIndex >= 0) {
              unified.allIds[allIdsIndex].name = eitjeName;
            }
          }
        }
        // Update canonicalName if we have a better name from Eitje (not "Unknown")
        // Always prefer Eitje name if it's not "Unknown", even if we have a primaryId
        if (eitjeName !== 'Unknown') {
          unified.canonicalName = eitjeName;
        }
        // Update master data (prefer Eitje data over internal if available)
        // Only update hourly_rate if Eitje has it, otherwise keep existing from Member
        if (hourlyRate !== undefined && hourlyRate !== null) {
          unified.hourly_rate = typeof hourlyRate === 'number' ? hourlyRate : parseFloat(hourlyRate);
        } else if (unified.hourly_rate === undefined || unified.hourly_rate === null) {
          // If unified doesn't have hourly_rate yet, try to get from Member
          // (This happens when Eitje user exists but Member doesn't have hourly_rate synced)
        }
        if (contractType !== undefined && contractType !== null) {
          unified.contract_type = contractType;
        }
        if (contractInfo !== undefined && contractInfo !== null) {
          unified.contract_info = contractInfo;
        }
        if (teamId !== undefined && teamId !== null) {
          unified.team_id = typeof teamId === 'number' ? teamId : parseInt(teamId);
        }
        if (teamName !== undefined && teamName !== null) {
          unified.team_name = teamName;
        }
        unified.updatedAt = new Date();
      } else {
        // New Eitje user
        unifiedMap.set(email, {
          eitjeIds: [eitjeId],
          eitjeNames: [eitjeName],
          eitjeEmails: [eitjeEmail],
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
            email: eitjeEmail,
          }],
          canonicalName: eitjeName,
          canonicalEmail: eitjeEmail,
          hourly_rate: hourlyRate !== undefined && hourlyRate !== null 
            ? (typeof hourlyRate === 'number' ? hourlyRate : parseFloat(hourlyRate))
            : undefined,
          contract_type: contractType,
          contract_info: contractInfo,
          team_id: teamId !== undefined && teamId !== null ? (typeof teamId === 'number' ? teamId : parseInt(teamId)) : undefined,
          team_name: teamName,
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      }
    } else {
      // Eitje user without email - match by name or create new
      const key = `eitje_${eitjeId}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          eitjeIds: [eitjeId],
          eitjeNames: [eitjeName],
          eitjeEmails: [],
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          }],
          canonicalName: eitjeName,
          hourly_rate: hourlyRate !== undefined && hourlyRate !== null 
            ? (typeof hourlyRate === 'number' ? hourlyRate : parseFloat(hourlyRate))
            : undefined,
          contract_type: contractType,
          contract_info: contractInfo,
          team_id: teamId !== undefined && teamId !== null ? (typeof teamId === 'number' ? teamId : parseInt(teamId)) : undefined,
          team_name: teamName,
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Update existing user without email
        const unified = unifiedMap.get(key)!;
        // Update name if we have a better one (not "Unknown")
        if (eitjeName !== 'Unknown') {
          unified.canonicalName = eitjeName;
          const eitjeIndex = unified.eitjeIds.indexOf(eitjeId);
          if (eitjeIndex >= 0) {
            unified.eitjeNames[eitjeIndex] = eitjeName;
          }
          const allIdsIndex = unified.allIds.findIndex(a => a.source === 'eitje' && a.id === eitjeId);
          if (allIdsIndex >= 0) {
            unified.allIds[allIdsIndex].name = eitjeName;
          }
        }
        if (hourlyRate !== undefined && hourlyRate !== null) {
          unified.hourly_rate = typeof hourlyRate === 'number' ? hourlyRate : parseFloat(hourlyRate);
        }
        if (contractType !== undefined && contractType !== null) {
          unified.contract_type = contractType;
        }
        if (contractInfo !== undefined && contractInfo !== null) {
          unified.contract_info = contractInfo;
        }
        unified.updatedAt = new Date();
      }
    }
  }
  
  // Process user names from time_registration_shifts and planning_shifts
  // These have user_name in extracted or rawApiResponse.user.name
  for (const shiftUser of shiftUsers) {
    const eitjeId = shiftUser._id;
    const userName = shiftUser.user_name;
    const userEmail = shiftUser.user_email;
    
    if (!eitjeId || !userName || userName === 'Unknown') continue;
    
    // Try to find existing unified user by eitjeId
    let found = false;
    for (const [key, unified] of unifiedMap.entries()) {
      if (unified.eitjeIds.includes(eitjeId)) {
        found = true;
        // Update name if it's better (not "Unknown")
        if (userName !== 'Unknown') {
          const eitjeIndex = unified.eitjeIds.indexOf(eitjeId);
          if (eitjeIndex >= 0) {
            // Update eitjeNames if current is "Unknown"
            if (unified.eitjeNames[eitjeIndex] === 'Unknown') {
              unified.eitjeNames[eitjeIndex] = userName;
            }
            // Update canonicalName if current is "Unknown"
            if (unified.canonicalName === 'Unknown') {
              unified.canonicalName = userName;
            }
            // Update allIds entry
            const allIdsIndex = unified.allIds.findIndex(a => a.source === 'eitje' && a.id === eitjeId);
            if (allIdsIndex >= 0 && unified.allIds[allIdsIndex].name === 'Unknown') {
              unified.allIds[allIdsIndex].name = userName;
            }
          }
        }
        // Update email if we found one
        if (userEmail && !unified.eitjeEmails.includes(userEmail)) {
          unified.eitjeEmails.push(userEmail);
          if (!unified.canonicalEmail) {
            unified.canonicalEmail = userEmail;
          }
        }
        unified.updatedAt = new Date();
        break;
      }
    }
    
    // If not found and we have an email, try to match by email
    if (!found && userEmail) {
      const email = userEmail.toLowerCase();
      if (unifiedMap.has(email)) {
        const unified = unifiedMap.get(email)!;
        if (!unified.eitjeIds.includes(eitjeId)) {
          unified.eitjeIds.push(eitjeId);
          unified.eitjeNames.push(userName);
          unified.eitjeEmails.push(userEmail);
          unified.allIds.push({
            source: 'eitje',
            id: eitjeId,
            name: userName,
            email: userEmail,
          });
          // Update canonicalName if it's "Unknown"
          if (unified.canonicalName === 'Unknown') {
            unified.canonicalName = userName;
          }
          unified.updatedAt = new Date();
        }
      } else {
        // Create new unified user from shift data
        unifiedMap.set(email, {
          eitjeIds: [eitjeId],
          eitjeNames: [userName],
          eitjeEmails: [userEmail],
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: userName,
            email: userEmail,
          }],
          canonicalName: userName,
          canonicalEmail: userEmail,
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      }
    } else if (!found) {
      // Create new unified user without email (match by eitjeId only)
      const key = `eitje_${eitjeId}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          eitjeIds: [eitjeId],
          eitjeNames: [userName],
          eitjeEmails: [],
          allIds: [{
            source: 'eitje',
            id: eitjeId,
            name: userName,
          }],
          canonicalName: userName,
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      } else {
        // Update existing
        const unified = unifiedMap.get(key)!;
        if (unified.canonicalName === 'Unknown' && userName !== 'Unknown') {
          unified.canonicalName = userName;
          const eitjeIndex = unified.eitjeIds.indexOf(eitjeId);
          if (eitjeIndex >= 0) {
            unified.eitjeNames[eitjeIndex] = userName;
          }
          const allIdsIndex = unified.allIds.findIndex(a => a.source === 'eitje' && a.id === eitjeId);
          if (allIdsIndex >= 0) {
            unified.allIds[allIdsIndex].name = userName;
          }
          unified.updatedAt = new Date();
        }
      }
    }
  }
  
  // Upsert all unified users - use replaceOne to ensure full document replacement
  const operations = Array.from(unifiedMap.values()).map((unified) => {
    // Build flat array of all ID values for lookup
    const allIdValues: (string | number | ObjectId)[] = [];
    
    if (unified.primaryId) {
      allIdValues.push(unified.primaryId);
    }
    if (unified.eitjeIds && Array.isArray(unified.eitjeIds)) {
      allIdValues.push(...unified.eitjeIds);
    }
    if (unified.slackId) {
      allIdValues.push(unified.slackId);
    }
    
    const documentToUpsert = {
      ...unified,
      allIdValues: allIdValues, // Flat array for $in lookups
      updatedAt: new Date(), // Always update timestamp
    };
    
    // Build filter that tries multiple matching strategies
    // Priority: primaryId > canonicalEmail > eitjeIds (any match)
    let filter: any = {};
    
    if (unified.primaryId) {
      // Primary match - most reliable
      filter = { primaryId: unified.primaryId };
    } else if (unified.canonicalEmail) {
      // Email match - second most reliable
      filter = { canonicalEmail: unified.canonicalEmail };
    } else if (unified.eitjeIds && unified.eitjeIds.length > 0) {
      // Match by any eitjeId
      filter = { eitjeIds: { $in: unified.eitjeIds } };
    } else {
      // Fallback - use first eitjeId if available
      filter = { eitjeIds: unified.eitjeIds?.[0] };
    }
    
    // Use replaceOne to fully replace the document, ensuring all fields are updated
    return {
      replaceOne: {
        filter: filter,
        replacement: documentToUpsert,
        upsert: true,
      }
    };
  });
  
  const result = await db.collection('unified_user').bulkWrite(operations);
  
  return {
    created: result.upsertedCount,
    updated: result.modifiedCount,
  };
}

/**
 * Sync all unified collections
 */
export async function syncAllUnified(): Promise<{
  locations: { created: number; updated: number };
  teams: { created: number; updated: number };
  users: { created: number; updated: number };
}> {
  const [locations, teams, users] = await Promise.all([
    syncUnifiedLocations(),
    syncUnifiedTeams(),
    syncUnifiedUsers(),
  ]);
  
  return { locations, teams, users };
}
