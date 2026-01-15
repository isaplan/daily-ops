/**
 * @registry-id: MemberModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Member schema and model
 * @last-fix: [2026-01-15] Initial POC setup
 * 
 * @exports-to:
 * ✓ app/api/members/** => Member CRUD operations
 * ✓ app/components/** => Member display components
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMember extends Document {
  name: string;
  email: string;
  slack_id?: string;
  slack_username?: string;
  slack_avatar?: string;
  
  location_id?: mongoose.Types.ObjectId;
  team_id?: mongoose.Types.ObjectId;
  
  roles: Array<{
    role: 'kitchen_staff' | 'waitress' | 'manager' | 'overall_manager' | 'finance_manager';
    scope: 'self' | 'team' | 'location' | 'company';
    grantedAt: Date;
  }>;
  
  is_active: boolean;
  last_seen?: Date;
  
  created_at: Date;
  updated_at: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    slack_id: { type: String, unique: true, sparse: true },
    slack_username: { type: String },
    slack_avatar: { type: String },
    
    location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
    team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
    
    roles: [{
      role: {
        type: String,
        enum: ['kitchen_staff', 'waitress', 'manager', 'overall_manager', 'finance_manager'],
        required: true,
      },
      scope: {
        type: String,
        enum: ['self', 'team', 'location', 'company'],
        required: true,
      },
      grantedAt: { type: Date, default: Date.now },
    }],
    
    is_active: { type: Boolean, default: true },
    last_seen: { type: Date },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// email and slack_id already have unique indexes from schema definition
MemberSchema.index({ location_id: 1 });
MemberSchema.index({ team_id: 1 });

const Member: Model<IMember> = mongoose.models.Member || mongoose.model<IMember>('Member', MemberSchema);

export default Member;
