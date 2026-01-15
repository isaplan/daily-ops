/**
 * @registry-id: TeamModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Team schema and model
 * @last-fix: [2026-01-15] Initial POC setup
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

const Team: Model<ITeam> = mongoose.models.Team || mongoose.model<ITeam>('Team', TeamSchema);

export default Team;
