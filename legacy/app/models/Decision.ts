/**
 * @registry-id: DecisionModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Decision schema and model
 * @last-fix: [2026-01-15] Initial POC setup
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDecision extends Document {
  title: string;
  description: string;
  decision: string;
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  
  created_by: mongoose.Types.ObjectId;
  approved_by?: mongoose.Types.ObjectId;
  involved_members: mongoose.Types.ObjectId[];
  
  connected_to: {
    location_id?: mongoose.Types.ObjectId;
    team_id?: mongoose.Types.ObjectId;
    member_id?: mongoose.Types.ObjectId;
  };
  
  created_at: Date;
  updated_at: Date;
  decided_at?: Date;
}

const DecisionSchema = new Schema<IDecision>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    decision: { type: String, required: true },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected', 'implemented'],
      default: 'proposed',
    },
    
    created_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    approved_by: { type: Schema.Types.ObjectId, ref: 'Member' },
    involved_members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
    
    connected_to: {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
      member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
    },
    
    decided_at: { type: Date },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

DecisionSchema.index({ created_by: 1 });
DecisionSchema.index({ 'connected_to.location_id': 1 });
DecisionSchema.index({ 'connected_to.team_id': 1 });
DecisionSchema.index({ 'connected_to.member_id': 1 });
DecisionSchema.index({ status: 1 });

const Decision: Model<IDecision> = mongoose.models.Decision || mongoose.model<IDecision>('Decision', DecisionSchema);

export default Decision;
