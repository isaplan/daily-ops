/**
 * @registry-id: unifiedCollectionsService
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Service to create unified collections that merge IDs and names from all sources (Eitje, internal models, etc.)
 * @last-fix: [2026-01-25] Initial implementation
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
  
  // All known IDs across sources
  allIds: {
    source: 'internal' | 'eitje' | 'slack';
    id: string | number | ObjectId;
    name?: string;
    email?: string;
  }[];
  
  // Unified canonical name
  canonicalName: string;
  canonicalEmail?: string;
  
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
    
    if (!unifiedMap.has(locId)) {
      unifiedMap.set(locId, {
        primaryId: loc._id,
        primaryName: loc.name || 'Unknown',
        eitjeIds: [],
        eitjeNames: [],
        allIds: [{
          source: 'internal',
          id: loc._id,
          name: loc.name,
        }],
        canonicalName: loc.name || 'Unknown',
        isActive: loc.is_active !== false, // Default to true if not explicitly false
        lastSeen: new Date(),
        updatedAt: new Date(),
      });
    }
    
    const unified = unifiedMap.get(locId)!;
    
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
          unified.eitjeNames.push(eitjeName);
          unified.allIds.push({
            source: 'eitje',
            id: eitjeId,
            name: eitjeName,
          });
        }
      }
    } else {
      // Unmapped Eitje environment - create new unified entry
      const key = `eitje_${eitjeId}`;
      if (!unifiedMap.has(key)) {
        unifiedMap.set(key, {
          primaryId: new ObjectId(), // Generate new ObjectId for unmapped
          primaryName: eitjeName,
          eitjeIds: [eitjeId],
          eitjeNames: [eitjeName],
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
  
  // Upsert all unified locations
  const operations = Array.from(unifiedMap.values()).map((unified) => ({
    updateOne: {
      filter: { primaryId: unified.primaryId },
      update: { $set: unified },
      upsert: true,
    }
  }));
  
  const result = await db.collection('location_unified').bulkWrite(operations);
  
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
  
  const result = await db.collection('team_unified').bulkWrite(operations);
  
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
  
  // Get all Eitje user data from eitje_raw_data
  const eitjeUsers = await db.collection('eitje_raw_data')
    .find({ endpoint: 'users' })
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
  
  // Process Eitje users
  for (const user of eitjeUsers) {
    const eitjeId = user.extracted?.id || user.rawApiResponse?.id;
    const eitjeName = user.extracted?.name || user.rawApiResponse?.name || 'Unknown';
    const eitjeEmail = user.extracted?.email || user.rawApiResponse?.email;
    
    if (!eitjeId) continue;
    
    if (eitjeEmail) {
      const email = eitjeEmail.toLowerCase();
      
      if (unifiedMap.has(email)) {
        // Match by email
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
        }
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
          isActive: true,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
  
  // Upsert all unified users
  const operations = Array.from(unifiedMap.values()).map((unified) => {
    // Use primaryId if available, otherwise use canonicalEmail or eitjeId
    const filterKey = unified.primaryId 
      ? { primaryId: unified.primaryId }
      : unified.canonicalEmail
      ? { canonicalEmail: unified.canonicalEmail }
      : { eitjeIds: unified.eitjeIds[0] };
    
    return {
      updateOne: {
        filter: filterKey,
        update: { $set: unified },
        upsert: true,
      }
    };
  });
  
  const result = await db.collection('user_unified').bulkWrite(operations);
  
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
