/**
 * @registry-id: aggregationValidationService
 * @created: 2026-02-02T00:00:00.000Z
 * @last-modified: 2026-02-02T00:00:00.000Z
 * @description: Pre-aggregation validation - ensures raw data, locations, and mappings are correct before aggregation starts
 * @last-fix: [2026-02-02] Initial implementation with step-by-step validation
 *
 * @exports-to:
 *   ✓ scripts/full-aggregation.ts => validates before aggregation
 *   ✓ app/lib/services/aggregation/dailyOpsAggregationService.ts => could add optional validation
 */

import { getDatabase } from '@/lib/mongodb/v2-connection';
import { ObjectId } from 'mongodb';

export interface ValidationResult {
  success: boolean;
  stats: {
    totalLocations: number;
    totalRawRecords: number;
    recordsByLocation: Record<string, number>;
    missingLocationIds: number;
    validRecords: number;
    invalidRecords: InvalidRecord[];
  };
}

export interface InvalidRecord {
  collection: string;
  id?: string;
  reason: string;
}

/**
 * Step 1: Validate locations exist and have proper unified mappings
 */
export async function validateLocations(): Promise<{
  valid: boolean;
  count: number;
  locations: Array<{ _id: ObjectId; name: string; hasUnifiedEntry: boolean }>;
}> {
  const db = await getDatabase();

  const locations = await db.collection('locations').find({}).toArray();
  const unifiedLocs = await db.collection('unified_location').find({}).toArray();

  const unifiedIds = new Set(unifiedLocs.map((u: any) => u.primaryId.toString()));

  const results = locations.map((loc: any) => ({
    _id: loc._id,
    name: loc.name,
    hasUnifiedEntry: unifiedIds.has(loc._id.toString()),
  }));

  const allHaveUnified = results.every((r) => r.hasUnifiedEntry);

  console.log(`\n✅ Location Validation`);
  console.log(`   Locations in DB: ${locations.length}`);
  console.log(`   With unified mappings: ${results.filter((r) => r.hasUnifiedEntry).length}`);
  if (!allHaveUnified) {
    console.log(`   ⚠️  Missing unified entries:`, results.filter((r) => !r.hasUnifiedEntry).map((r) => r.name));
  }

  return { valid: allHaveUnified, count: locations.length, locations: results };
}

/**
 * Step 2: Validate raw data has location_ids and members
 */
export async function validateRawData(): Promise<{
  valid: boolean;
  eitje: { total: number; withLocationId: number; missing: number };
  bork: { total: number; withLocationId: number; missing: number };
}> {
  const db = await getDatabase();

  // Eitje validation
  const eitjeTotal = await db.collection('test-eitje-hours').countDocuments();
  const eitjeWithLocId = await db.collection('test-eitje-hours').countDocuments({ location_id: { $exists: true, $ne: null } });
  const eitjeMissing = eitjeTotal - eitjeWithLocId;

  // Bork validation
  const borkTotal = await db.collection('bork_raw_data').countDocuments();
  const borkWithLocId = await db.collection('bork_raw_data').countDocuments({ location_id: { $exists: true, $ne: null } });
  const borkMissing = borkTotal - borkWithLocId;

  console.log(`\n✅ Raw Data Validation`);
  console.log(`   Eitje hours: ${eitjeTotal} total, ${eitjeWithLocId} with location_id, ${eitjeMissing} missing`);
  console.log(`   Bork sales: ${borkTotal} total, ${borkWithLocId} with location_id, ${borkMissing} missing`);

  const valid = eitjeMissing === 0 && borkMissing === 0;
  if (!valid) {
    console.log(`   ⚠️  CRITICAL: Missing location_ids detected!`);
  }

  return {
    valid,
    eitje: { total: eitjeTotal, withLocationId: eitjeWithLocId, missing: eitjeMissing },
    bork: { total: borkTotal, withLocationId: borkWithLocId, missing: borkMissing },
  };
}

/**
 * Step 3: Validate unified location mappings are correct
 */
export async function validateUnifiedMappings(): Promise<{
  valid: boolean;
  count: number;
  unmappedEitje: number;
  unmappedBork: number;
}> {
  const db = await getDatabase();

  // Get all eitje location_ids
  const eitjeLocIds = await db.collection('test-eitje-hours').distinct('location_id');
  const borkLocIds = await db.collection('bork_raw_data').distinct('location_id');

  // Get all location IDs we should know about
  const locations = await db.collection('locations').find({}).toArray();
  const validIds = new Set(locations.map((l: any) => l._id.toString()));

  const unmappedEitje = eitjeLocIds.filter((id: ObjectId) => !validIds.has(id.toString())).length;
  const unmappedBork = borkLocIds.filter((id: ObjectId) => !validIds.has(id.toString())).length;

  console.log(`\n✅ Unified Mapping Validation`);
  console.log(`   Eitje distinct location_ids: ${eitjeLocIds.length}, all valid: ${unmappedEitje === 0}`);
  console.log(`   Bork distinct location_ids: ${borkLocIds.length}, all valid: ${unmappedBork === 0}`);

  const valid = unmappedEitje === 0 && unmappedBork === 0;
  if (!valid) {
    console.log(`   ⚠️  CRITICAL: Unmapped location_ids detected!`);
    if (unmappedEitje > 0) console.log(`      Eitje unmapped:`, eitjeLocIds.filter((id: ObjectId) => !validIds.has(id.toString())));
    if (unmappedBork > 0) console.log(`      Bork unmapped:`, borkLocIds.filter((id: ObjectId) => !validIds.has(id.toString())));
  }

  return { valid, count: eitjeLocIds.length + borkLocIds.length, unmappedEitje, unmappedBork };
}

/**
 * Step 4: Validate members and teams exist for raw data
 */
export async function validateMembersAndTeams(): Promise<{
  valid: boolean;
  missingMembers: number;
  missingTeams: number;
}> {
  const db = await getDatabase();

  // Get all member_ids and team_ids from raw data
  const eitjeMemberIds = await db.collection('test-eitje-hours').distinct('member_id');
  const eitjeTeamIds = await db.collection('test-eitje-hours').distinct('team_id');

  // Check if they exist
  const membersDb = await db.collection('members').find({ _id: { $in: eitjeMemberIds } }).toArray();
  const teamsDb = await db.collection('teams').find({ _id: { $in: eitjeTeamIds } }).toArray();

  const missingMembers = eitjeMemberIds.length - membersDb.length;
  const missingTeams = eitjeTeamIds.length - teamsDb.length;

  console.log(`\n✅ Members & Teams Validation`);
  console.log(`   Members referenced: ${eitjeMemberIds.length}, found: ${membersDb.length}, missing: ${missingMembers}`);
  console.log(`   Teams referenced: ${eitjeTeamIds.length}, found: ${teamsDb.length}, missing: ${missingTeams}`);

  const valid = missingMembers === 0 && missingTeams === 0;
  if (!valid) {
    console.log(`   ⚠️  CRITICAL: Missing members/teams detected!`);
  }

  return { valid, missingMembers, missingTeams };
}

/**
 * Step 5: Validate data distribution by date and location
 */
export async function validateDataDistribution(): Promise<{
  valid: boolean;
  dateRange: { from: string; to: string; count: number };
  locationDistribution: Record<string, number>;
}> {
  const db = await getDatabase();

  const locations = await db.collection('locations').find({}).toArray();
  const locNameMap: Record<string, string> = {};
  locations.forEach((l: any) => {
    locNameMap[l._id.toString()] = l.name;
  });

  // Get date range
  const dates = await db.collection('test-eitje-hours').distinct('date');
  const sortedDates = (dates as Date[]).sort((a, b) => a.getTime() - b.getTime());

  const distribution: Record<string, number> = {};
  for (const loc of locations) {
    const count = await db.collection('test-eitje-hours').countDocuments({ location_id: loc._id });
    distribution[loc.name] = count;
  }

  console.log(`\n✅ Data Distribution Validation`);
  console.log(`   Date range: ${sortedDates[0]?.toISOString().split('T')[0]} to ${sortedDates[sortedDates.length - 1]?.toISOString().split('T')[0]}`);
  console.log(`   Dates available: ${sortedDates.length}`);
  console.log(`   Records per location:`);
  Object.entries(distribution).forEach(([name, count]) => {
    console.log(`      ${name}: ${count}`);
  });

  return {
    valid: true,
    dateRange: {
      from: sortedDates[0]?.toISOString().split('T')[0] || 'N/A',
      to: sortedDates[sortedDates.length - 1]?.toISOString().split('T')[0] || 'N/A',
      count: sortedDates.length,
    },
    locationDistribution: distribution,
  };
}

/**
 * Run all validation steps
 */
export async function runFullValidation(): Promise<ValidationResult> {
  console.log('\n' + '='.repeat(60));
  console.log('📋 AGGREGATION PRE-VALIDATION');
  console.log('='.repeat(60));

  try {
    const locValidation = await validateLocations();
    const rawDataValidation = await validateRawData();
    const mappingValidation = await validateUnifiedMappings();
    const memberTeamValidation = await validateMembersAndTeams();
    const distributionValidation = await validateDataDistribution();

    const allValid =
      locValidation.valid &&
      rawDataValidation.valid &&
      mappingValidation.valid &&
      memberTeamValidation.valid;

    console.log('\n' + '='.repeat(60));
    if (allValid) {
      console.log('✅ ALL VALIDATIONS PASSED - Safe to aggregate');
    } else {
      console.log('❌ VALIDATION FAILED - Fix issues above before aggregating');
    }
    console.log('='.repeat(60) + '\n');

    return {
      success: allValid,
      stats: {
        totalLocations: locValidation.count,
        totalRawRecords: rawDataValidation.eitje.total + rawDataValidation.bork.total,
        recordsByLocation: distributionValidation.locationDistribution,
        missingLocationIds: rawDataValidation.eitje.missing + rawDataValidation.bork.missing,
        validRecords: rawDataValidation.eitje.withLocationId + rawDataValidation.bork.withLocationId,
        invalidRecords: [],
      },
    };
  } catch (error) {
    console.error('❌ Validation error:', error);
    return {
      success: false,
      stats: {
        totalLocations: 0,
        totalRawRecords: 0,
        recordsByLocation: {},
        missingLocationIds: 0,
        validRecords: 0,
        invalidRecords: [{ collection: 'unknown', reason: error instanceof Error ? error.message : 'Unknown error' }],
      },
    };
  }
}
