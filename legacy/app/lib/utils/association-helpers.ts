/**
 * @registry-id: associationHelpers
 * @created: 2026-01-25T00:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Helper functions to populate denormalized fields in association models
 * @last-fix: [2026-01-25] Initial implementation
 *
 * @exports-to:
 *   ✓ app/api/members/** => Create/update associations with denormalized data
 *   ✓ app/lib/services/** => Service layer association creation
 */

import Team from '@/models/Team';
import Location from '@/models/Location';
import type { IMemberTeamAssociation } from '@/models/MemberTeamAssociation';
import type { IMemberLocationAssociation } from '@/models/MemberLocationAssociation';

/**
 * Get team data with location for denormalized fields
 */
export async function getTeamWithLocation(teamId: string | any) {
  const team = await Team.findById(teamId).populate('location_id', 'name _id').lean();
  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }
  
  const location = typeof team.location_id === 'object' ? team.location_id : null;
  
  return {
    team_id: team._id,
    team_name: team.name,
    location_id: location?._id || team.location_id,
    location_name: location?.name || 'Unknown Location'
  };
}

/**
 * Get location data for denormalized fields
 */
export async function getLocationData(locationId: string | any) {
  const location = await Location.findById(locationId).lean();
  if (!location) {
    throw new Error(`Location not found: ${locationId}`);
  }
  
  return {
    location_id: location._id,
    location_name: location.name
  };
}

/**
 * Prepare team association data with denormalized fields
 */
export async function prepareTeamAssociationData(
  memberId: string | any,
  teamId: string | any,
  role?: string
): Promise<Partial<IMemberTeamAssociation>> {
  const teamData = await getTeamWithLocation(teamId);
  
  return {
    member_id: memberId,
    team_id: teamData.team_id,
    team_name: teamData.team_name,
    location_id: teamData.location_id,
    location_name: teamData.location_name,
    role,
    is_active: true,
    assigned_at: new Date()
  };
}

/**
 * Prepare location association data with denormalized fields
 */
export async function prepareLocationAssociationData(
  memberId: string | any,
  locationId: string | any
): Promise<Partial<IMemberLocationAssociation>> {
  const locationData = await getLocationData(locationId);
  
  return {
    member_id: memberId,
    location_id: locationData.location_id,
    location_name: locationData.location_name,
    is_active: true,
    assigned_at: new Date()
  };
}
