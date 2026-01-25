/**
 * @registry-id: LocationModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-25T00:00:00.000Z
 * @description: Location schema and model
 * @last-fix: [2026-01-25] Added post-save hook to sync denormalized fields in associations
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// name already has unique index from schema definition

// Post-save hook: Update denormalized fields in associations when location name changes
LocationSchema.post('save', async function() {
  try {
    const MemberLocationAssociation = mongoose.models.MemberLocationAssociation;
    const MemberTeamAssociation = mongoose.models.MemberTeamAssociation;
    
    const location = this;
    
    // Update all active location associations
    if (MemberLocationAssociation) {
      await MemberLocationAssociation.updateMany(
        { location_id: location._id, is_active: true },
        { location_name: location.name }
      );
    }
    
    // Update all active team associations that reference this location
    if (MemberTeamAssociation) {
      await MemberTeamAssociation.updateMany(
        { location_id: location._id, is_active: true },
        { location_name: location.name }
      );
    }
  } catch (error) {
    // Log but don't fail the save operation
    console.error('[Location post-save hook] Error updating denormalized fields:', error);
  }
});

const Location: Model<ILocation> = mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema);

export default Location;
