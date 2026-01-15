/**
 * @registry-id: MemberLocationAssociationModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: M:M junction table for Member ↔ Location relationships
 * @last-fix: [2026-01-15] Initial M:M relationship implementation
 * 
 * @exports-to:
 * ✓ app/api/members/** => Query members by location
 * ✓ app/api/locations/** => Query locations by member
 * ✓ app/models/Member.ts => Helper methods
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMemberLocationAssociation extends Document {
  member_id: mongoose.Types.ObjectId;
  location_id: mongoose.Types.ObjectId;
  is_active: boolean;
  assigned_at: Date;
  removed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const MemberLocationAssociationSchema = new Schema<IMemberLocationAssociation>(
  {
    member_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Member', 
      required: true 
    },
    location_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Location', 
      required: true 
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
MemberLocationAssociationSchema.index(
  { member_id: 1, location_id: 1, is_active: 1 },
  { 
    unique: true, 
    partialFilterExpression: { is_active: true } 
  }
);

// Indexes for efficient queries
MemberLocationAssociationSchema.index({ member_id: 1, is_active: 1 });
MemberLocationAssociationSchema.index({ location_id: 1, is_active: 1 });
MemberLocationAssociationSchema.index({ member_id: 1, location_id: 1 });

const MemberLocationAssociation: Model<IMemberLocationAssociation> = 
  mongoose.models.MemberLocationAssociation || 
  mongoose.model<IMemberLocationAssociation>('MemberLocationAssociation', MemberLocationAssociationSchema);

export default MemberLocationAssociation;
