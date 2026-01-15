const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daily-ops';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'daily-ops';

const LocationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: String,
  city: String,
  country: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  description: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  slack_username: String,
  location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  roles: [{
    role: { type: String, enum: ['kitchen_staff', 'waitress', 'manager', 'overall_manager', 'finance_manager'], required: true },
    scope: { type: String, enum: ['self', 'team', 'location', 'company'], required: true },
    grantedAt: { type: Date, default: Date.now },
  }],
  is_active: { type: Boolean, default: true },
  last_seen: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  connected_to: {
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  tags: [{ type: String }],
  is_pinned: { type: Boolean, default: false },
  is_archived: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const TodoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  connected_to: {
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  due_date: Date,
  completed_at: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const DecisionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  decision: { type: String, required: true },
  status: { type: String, enum: ['proposed', 'approved', 'rejected', 'implemented'], default: 'proposed' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  involved_members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  connected_to: {
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  decided_at: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['location', 'team', 'member', 'general'], required: true },
  connected_to: {
    location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  is_archived: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);
const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
const Member = mongoose.models.Member || mongoose.model('Member', MemberSchema);
const Todo = mongoose.models.Todo || mongoose.model('Todo', TodoSchema);
const Decision = mongoose.models.Decision || mongoose.model('Decision', DecisionSchema);
const Channel = mongoose.models.Channel || mongoose.model('Channel', ChannelSchema);
const Note = mongoose.models.Note || mongoose.model('Note', NoteSchema);

const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Liam'];
const lastNames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson'];

function generateDummyMembers(locationName, count = 3) {
  const members = [];
  const usedNames = new Set();
  
  for (let i = 0; i < count; i++) {
    let firstName, lastName, name;
    do {
      firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      name = `${firstName} ${lastName}`;
    } while (usedNames.has(name));
    
    usedNames.add(name);
    const locationSlug = locationName.toLowerCase().replace(/\s+/g, '');
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${locationSlug}@example.com`;
    const slack = `${firstName.toLowerCase()}.${lastName.toLowerCase().charAt(0)}`;
    
    members.push({ name, email, slack });
  }
  
  return members;
}

async function seedData() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
    console.log('✅ Connected to MongoDB');

    const locations = await Location.find({ is_active: true });
    console.log(`Found ${locations.length} locations`);

    const teamNames = ['Bediening', 'Bar', 'Keuken'];

    for (const location of locations) {
      for (const teamName of teamNames) {
        let team = await Team.findOne({ 
          location_id: location._id, 
          name: teamName 
        });

        if (!team) {
          team = await Team.create({
            name: teamName,
            location_id: location._id,
            description: `${teamName} team`,
            is_active: true,
          });
          console.log(`✅ Created ${teamName} team for ${location.name}`);
        }

        const existingMembers = await Member.countDocuments({ team_id: team._id });
        const membersToCreate = 3 - existingMembers;

        if (membersToCreate > 0) {
          const dummyMembers = generateDummyMembers(`${location.name}-${teamName}`, membersToCreate);
          
          for (const memberData of dummyMembers) {
            const existingMember = await Member.findOne({ email: memberData.email });
            
            if (!existingMember) {
              await Member.create({
                name: memberData.name,
                email: memberData.email,
                slack_username: memberData.slack,
                location_id: location._id,
                team_id: team._id,
                roles: [{ role: teamName === 'Keuken' ? 'kitchen_staff' : 'waitress', scope: 'team' }],
                is_active: true,
              });
              console.log(`  ✅ Created member: ${memberData.name} in ${location.name} ${teamName}`);
            }
          }
        } else {
          console.log(`  ℹ️  Already have 3 members for ${location.name} ${teamName} team`);
        }
      }
    }

    // Create 12 dummy notes
    const existingNotes = await Note.countDocuments();
    const notesToCreate = 12 - existingNotes;

    if (notesToCreate > 0) {
      const allLocations = await Location.find({ is_active: true });
      const allTeams = await Team.find({ is_active: true }).populate('location_id');
      const allMembers = await Member.find({ is_active: true });

      const noteTemplates = [
        { title: 'Weekly Team Meeting Notes', content: 'Discussed upcoming events and staffing needs. Need to schedule training session for new hires.', tags: ['meeting', 'staffing'] },
        { title: 'Inventory Check Required', content: 'Kitchen inventory is running low on several items. Need to place order by Friday.', tags: ['inventory', 'urgent'] },
        { title: 'Customer Feedback Summary', content: 'Received positive feedback about new menu items. Some customers requested vegetarian options.', tags: ['feedback', 'menu'] },
        { title: 'Equipment Maintenance', content: 'Oven needs servicing. Scheduled for next Tuesday. Backup equipment available.', tags: ['maintenance', 'equipment'] },
        { title: 'Staff Schedule Updates', content: 'Updated schedule for next week. Two team members requested time off.', tags: ['schedule', 'staffing'] },
        { title: 'New Supplier Contact', content: 'Found new supplier for organic produce. Better prices and quality. Contact info saved.', tags: ['supplier', 'procurement'] },
        { title: 'Training Session Planned', content: 'Organizing training session for new POS system. All staff should attend.', tags: ['training', 'system'] },
        { title: 'Event Planning Notes', content: 'Large event booked for next month. Need to coordinate with kitchen and service teams.', tags: ['event', 'planning'] },
        { title: 'Quality Control Check', content: 'Conducted quality check on all stations. Everything looks good. Minor adjustments needed.', tags: ['quality', 'inspection'] },
        { title: 'Budget Review', content: 'Monthly budget review completed. On track for targets. Some areas need attention.', tags: ['budget', 'finance'] },
        { title: 'Health & Safety Inspection', content: 'Health inspector visit scheduled. All areas cleaned and prepared. Documentation ready.', tags: ['safety', 'compliance'] },
        { title: 'Marketing Campaign Ideas', content: 'Brainstorming session for next marketing campaign. Social media and local partnerships discussed.', tags: ['marketing', 'strategy'] },
      ];

      for (let i = 0; i < notesToCreate && i < noteTemplates.length; i++) {
        const template = noteTemplates[i];
        const randomLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        const locationTeams = allTeams.filter(t => {
          const teamLocId = typeof t.location_id === 'object' ? t.location_id._id.toString() : t.location_id?.toString();
          return teamLocId === randomLocation._id.toString();
        });
        const randomTeam = locationTeams.length > 0 ? locationTeams[Math.floor(Math.random() * locationTeams.length)] : null;
        const teamMembers = randomTeam ? allMembers.filter(m => m.team_id?.toString() === randomTeam._id.toString()) : [];
        const randomMember = teamMembers.length > 0 ? teamMembers[Math.floor(Math.random() * teamMembers.length)] : allMembers[0];
        const author = allMembers[Math.floor(Math.random() * allMembers.length)];

        await Note.create({
          title: template.title,
          content: template.content,
          author_id: author._id,
          connected_to: {
            location_id: randomLocation._id,
            team_id: randomTeam ? randomTeam._id : undefined,
            member_id: randomMember ? randomMember._id : undefined,
          },
          tags: template.tags,
          is_pinned: i < 2, // Pin first 2 notes
          is_archived: false,
        });
        console.log(`  ✅ Created note: ${template.title}`);
      }
    } else {
      console.log(`  ℹ️  Already have ${existingNotes} notes`);
    }

    // Create todos, decisions, and channels
    const allMembers = await Member.find({ is_active: true });
    const allTeams = await Team.find({ is_active: true });
    const allLocations = await Location.find({ is_active: true });

    // Create Todos
    const existingTodos = await Todo.countDocuments();
    const todosToCreate = 20 - existingTodos;
    if (todosToCreate > 0) {
      const todoTemplates = [
        { title: 'Review inventory levels', priority: 'high' },
        { title: 'Schedule team meeting', priority: 'medium' },
        { title: 'Update menu board', priority: 'low' },
        { title: 'Train new staff member', priority: 'high' },
        { title: 'Order supplies', priority: 'urgent' },
        { title: 'Clean equipment', priority: 'medium' },
        { title: 'Update schedule', priority: 'medium' },
        { title: 'Check quality standards', priority: 'high' },
        { title: 'Prepare for event', priority: 'urgent' },
        { title: 'Review customer feedback', priority: 'low' },
      ];

      for (let i = 0; i < todosToCreate && i < todoTemplates.length * 2; i++) {
        const template = todoTemplates[i % todoTemplates.length];
        const randomMember = allMembers[Math.floor(Math.random() * allMembers.length)];
        const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
        const randomLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        const statuses = ['pending', 'in_progress', 'completed'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        await Todo.create({
          title: `${template.title} - ${randomLocation.name}`,
          description: `Task for ${randomTeam.name} team`,
          status: status,
          priority: template.priority,
          assigned_to: randomMember._id,
          created_by: allMembers[Math.floor(Math.random() * allMembers.length)]._id,
          connected_to: {
            location_id: randomLocation._id,
            team_id: randomTeam._id,
            member_id: randomMember._id,
          },
        });
      }
      console.log(`  ✅ Created ${todosToCreate} todos`);
    }

    // Create Decisions
    const existingDecisions = await Decision.countDocuments();
    const decisionsToCreate = 15 - existingDecisions;
    if (decisionsToCreate > 0) {
      const decisionTemplates = [
        { title: 'New menu item approval', decision: 'Approved to add seasonal special' },
        { title: 'Staffing decision', decision: 'Hire 2 new team members' },
        { title: 'Equipment purchase', decision: 'Purchase new oven' },
        { title: 'Schedule change', decision: 'Extend weekend hours' },
        { title: 'Supplier selection', decision: 'Switch to new supplier' },
      ];

      for (let i = 0; i < decisionsToCreate && i < decisionTemplates.length * 3; i++) {
        const template = decisionTemplates[i % decisionTemplates.length];
        const randomMember = allMembers[Math.floor(Math.random() * allMembers.length)];
        const randomTeam = allTeams[Math.floor(Math.random() * allTeams.length)];
        const randomLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        const statuses = ['proposed', 'approved', 'implemented'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        await Decision.create({
          title: `${template.title} - ${randomLocation.name}`,
          description: `Decision for ${randomTeam.name}`,
          decision: template.decision,
          status: status,
          created_by: randomMember._id,
          involved_members: [randomMember._id, allMembers[Math.floor(Math.random() * allMembers.length)]._id],
          connected_to: {
            location_id: randomLocation._id,
            team_id: randomTeam._id,
          },
        });
      }
      console.log(`  ✅ Created ${decisionsToCreate} decisions`);
    }

    // Create Channels
    const existingChannels = await Channel.countDocuments();
    const channelsToCreate = 10 - existingChannels;
    if (channelsToCreate > 0) {
      for (let i = 0; i < channelsToCreate; i++) {
        const randomLocation = allLocations[Math.floor(Math.random() * allLocations.length)];
        const locationTeams = allTeams.filter(t => {
          const teamLocId = typeof t.location_id === 'object' ? t.location_id._id.toString() : t.location_id?.toString();
          return teamLocId === randomLocation._id.toString();
        });
        const randomTeam = locationTeams.length > 0 ? locationTeams[Math.floor(Math.random() * locationTeams.length)] : null;
        const teamMembers = randomTeam ? allMembers.filter(m => m.team_id?.toString() === randomTeam._id.toString()) : [];
        const channelMembers = teamMembers.slice(0, 3).map(m => m._id);
        const creator = allMembers[Math.floor(Math.random() * allMembers.length)];

        const channelTypes = ['location', 'team', 'general'];
        const channelType = channelTypes[Math.floor(Math.random() * channelTypes.length)];

        await Channel.create({
          name: channelType === 'location' ? `#${randomLocation.name}` : 
                channelType === 'team' && randomTeam ? `#${randomTeam.name}` : 
                `#general-${i + 1}`,
          description: `${channelType} channel`,
          type: channelType,
          connected_to: {
            location_id: channelType === 'location' ? randomLocation._id : undefined,
            team_id: channelType === 'team' && randomTeam ? randomTeam._id : undefined,
          },
          members: channelMembers.length > 0 ? channelMembers : [creator._id],
          created_by: creator._id,
        });
      }
      console.log(`  ✅ Created ${channelsToCreate} channels`);
    }

    console.log('✅ Seeding complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedData();
