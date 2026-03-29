/**
 * @registry-id: TeamModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Team schema and model
 * @last-fix: [2026-01-25] Added post-save hook to sync denormalized fields in associations
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  location_id: mongoose.Types.ObjectId;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true },
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    description: { type: String },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TeamSchema.index({ location_id: 1 });
TeamSchema.index({ name: 1 });

// Post-save hook: Update denormalized fields in MemberTeamAssociation when team name or location changes
TeamSchema.post('save', async function() {
  try {
    const MemberTeamAssociation = mongoose.models.MemberTeamAssociation;
    if (!MemberTeamAssociation) return;
    
    const team = this;
    const location = await mongoose.models.Location?.findById(team.location_id).lean();
    const locationName = location?.name || 'Unknown Location';
    
    // Update all active associations with this team
    await MemberTeamAssociation.updateMany(
      { team_id: team._id, is_active: true },
      {
        team_name: team.name,
        location_id: team.location_id,
        location_name: locationName
      }
    );
  } catch (error) {
    // Log but don't fail the save operation
    console.error('[Team post-save hook] Error updating denormalized fields:', error);
  }
});

const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);

export default Team;
