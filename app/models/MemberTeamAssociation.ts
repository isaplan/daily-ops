/**
 * @registry-id: MemberTeamAssociationModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: M:M junction table for Member ↔ Team relationships
 * @last-fix: [2026-01-15] Initial M:M relationship implementation
 * 
 * @exports-to:
 * ✓ app/api/members/** => Query members by team
 * ✓ app/api/teams/** => Query teams by member
 * ✓ app/models/Member.ts => Helper methods
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMemberTeamAssociation extends Document {
  member_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  role?: string; // Optional role within this team
  is_active: boolean;
  assigned_at: Date;
  removed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const MemberTeamAssociationSchema = new Schema<IMemberTeamAssociation>(
  {
    member_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Member', 
      required: true 
    },
    team_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Team', 
      required: true 
    },
    role: { 
      type: String 
    },
    is_active: { 
      type: Boolean, 
      default: true 
    },
    assigned_at: { 
      type: Date, 
      default: Date.now 
    },
    removed_at: { 
      type: Date 
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound unique index to prevent duplicate active associations
MemberTeamAssociationSchema.index(
  { member_id: 1, team_id: 1, is_active: 1 },
  { 
    unique: true, 
    partialFilterExpression: { is_active: true } 
  }
);

// Indexes for efficient queries
MemberTeamAssociationSchema.index({ member_id: 1, is_active: 1 });
MemberTeamAssociationSchema.index({ team_id: 1, is_active: 1 });
MemberTeamAssociationSchema.index({ member_id: 1, team_id: 1 });

const MemberTeamAssociation: Model<IMemberTeamAssociation> = 
  mongoose.models.MemberTeamAssociation || 
  mongoose.model<IMemberTeamAssociation>('MemberTeamAssociation', MemberTeamAssociationSchema);

export default MemberTeamAssociation;
