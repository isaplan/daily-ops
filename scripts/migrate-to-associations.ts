/**
 * Migration script: Move Member.team_id and Member.location_id to association tables
 * 
 * This script:
 * 1. Creates MemberTeamAssociation records from existing Member.team_id
 * 2. Creates MemberLocationAssociation records from existing Member.location_id
 * 3. Preserves all existing data
 * 
 * Run: npx tsx scripts/migrate-to-associations.ts
 */

import mongoose from 'mongoose';
import Member from '../app/models/Member';
import Team from '../app/models/Team';
import Location from '../app/models/Location';
import MemberTeamAssociation from '../app/models/MemberTeamAssociation';
import MemberLocationAssociation from '../app/models/MemberLocationAssociation';

async function migrate() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all members with team_id or location_id
    const members = await Member.find({
      $or: [
        { team_id: { $exists: true, $ne: null } },
        { location_id: { $exists: true, $ne: null } }
      ]
    });

    console.log(`\n📊 Found ${members.length} members to migrate\n`);

    let teamAssociationsCreated = 0;
    let locationAssociationsCreated = 0;
    let teamAssociationsSkipped = 0;
    let locationAssociationsSkipped = 0;

    for (const member of members) {
      // Migrate team_id to MemberTeamAssociation
      if (member.team_id) {
        const teamId = typeof member.team_id === 'object' 
          ? member.team_id._id || member.team_id 
          : member.team_id;

        // Check if association already exists
        const existingTeamAssoc = await MemberTeamAssociation.findOne({
          member_id: member._id,
          team_id: teamId,
          is_active: true
        });

        if (!existingTeamAssoc) {
          // Verify team exists
          const team = await Team.findById(teamId);
          if (team) {
            await MemberTeamAssociation.create({
              member_id: member._id,
              team_id: teamId,
              is_active: true,
              assigned_at: member.created_at || new Date()
            });
            teamAssociationsCreated++;
            console.log(`  ✓ Created team association: ${member.name} → ${team.name}`);
          } else {
            console.log(`  ⚠️  Team ${teamId} not found for member ${member.name}`);
          }
        } else {
          teamAssociationsSkipped++;
        }
      }

      // Migrate location_id to MemberLocationAssociation
      if (member.location_id) {
        const locationId = typeof member.location_id === 'object'
          ? member.location_id._id || member.location_id
          : member.location_id;

        // Check if association already exists
        const existingLocationAssoc = await MemberLocationAssociation.findOne({
          member_id: member._id,
          location_id: locationId,
          is_active: true
        });

        if (!existingLocationAssoc) {
          // Verify location exists
          const location = await Location.findById(locationId);
          if (location) {
            await MemberLocationAssociation.create({
              member_id: member._id,
              location_id: locationId,
              is_active: true,
              assigned_at: member.created_at || new Date()
            });
            locationAssociationsCreated++;
            console.log(`  ✓ Created location association: ${member.name} → ${location.name}`);
          } else {
            console.log(`  ⚠️  Location ${locationId} not found for member ${member.name}`);
          }
        } else {
          locationAssociationsSkipped++;
        }
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  Team associations created: ${teamAssociationsCreated}`);
    console.log(`  Team associations skipped (already exist): ${teamAssociationsSkipped}`);
    console.log(`  Location associations created: ${locationAssociationsCreated}`);
    console.log(`  Location associations skipped (already exist): ${locationAssociationsSkipped}`);
    console.log('\n✅ Migration completed successfully!');
    console.log('\n⚠️  Note: Member.team_id and Member.location_id fields are kept for backward compatibility.');
    console.log('   They will be deprecated in a future update.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrate();
