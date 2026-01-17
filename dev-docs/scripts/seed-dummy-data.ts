import mongoose from 'mongoose';
import dbConnect from '../app/lib/mongodb.js';
import Location from '../app/models/Location.js';
import Team from '../app/models/Team.js';
import Member from '../app/models/Member.js';
import MemberTeamAssociation from '../app/models/MemberTeamAssociation.js';
import MemberLocationAssociation from '../app/models/MemberLocationAssociation.js';

const dummyNames = [
  { name: 'Alice Johnson', email: 'alice.johnson@example.com', slack: 'alice.j' },
  { name: 'Bob Smith', email: 'bob.smith@example.com', slack: 'bob.s' },
  { name: 'Carol Williams', email: 'carol.williams@example.com', slack: 'carol.w' },
  { name: 'David Brown', email: 'david.brown@example.com', slack: 'david.b' },
  { name: 'Emma Davis', email: 'emma.davis@example.com', slack: 'emma.d' },
];

async function seedData() {
  try {
    await dbConnect();
    console.log('✅ Connected to MongoDB');

    const locations = await Location.find({ is_active: true });
    console.log(`Found ${locations.length} locations`);

    for (const location of locations) {
      let team = await Team.findOne({ 
        location_id: location._id, 
        name: 'Management' 
      });

      if (!team) {
        team = await Team.create({
          name: 'Management',
          location_id: location._id,
          description: 'Management team',
          is_active: true,
        });
        console.log(`✅ Created Management team for ${location.name}`);
      } else {
        console.log(`ℹ️  Management team already exists for ${location.name}`);
      }

      // Check existing members via associations
      const existingAssociations = await MemberTeamAssociation.countDocuments({ 
        team_id: team._id, 
        is_active: true 
      });
      const membersToCreate = 3 - existingAssociations;

      if (membersToCreate > 0) {
        for (let i = 0; i < membersToCreate && i < dummyNames.length; i++) {
          const memberData = dummyNames[i];
          let member = await Member.findOne({ email: memberData.email });
          
          if (!member) {
            member = await Member.create({
              name: memberData.name,
              email: memberData.email,
              slack_username: memberData.slack,
              // Keep deprecated fields for backward compatibility
              location_id: location._id,
              team_id: team._id,
              roles: [{ role: 'manager', scope: 'location' }],
              is_active: true,
            });
            console.log(`  ✅ Created member: ${memberData.name}`);
          }

          // Create team association
          const existingTeamAssoc = await MemberTeamAssociation.findOne({
            member_id: member._id,
            team_id: team._id,
            is_active: true
          });
          
          if (!existingTeamAssoc) {
            await MemberTeamAssociation.create({
              member_id: member._id,
              team_id: team._id,
              is_active: true,
              assigned_at: new Date()
            });
          }

          // Create location association
          const existingLocationAssoc = await MemberLocationAssociation.findOne({
            member_id: member._id,
            location_id: location._id,
            is_active: true
          });
          
          if (!existingLocationAssoc) {
            await MemberLocationAssociation.create({
              member_id: member._id,
              location_id: location._id,
              is_active: true,
              assigned_at: new Date()
            });
          }

          console.log(`  ✅ Associated ${memberData.name} with ${location.name} Management team`);
        }
      } else {
        console.log(`  ℹ️  Already have members for ${location.name} Management team`);
      }
    }

    console.log('✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
