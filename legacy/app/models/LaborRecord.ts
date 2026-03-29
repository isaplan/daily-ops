/**
 * @registry-id: LaborRecordModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Labor record schema for dual-verified labor data (Eitje API + Excel)
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/labor-records/** => Labor record operations
 * ✓ app/lib/services/EitjeSyncService.ts => Labor sync
 * ✓ app/components/admin/LaborVerificationDashboard.tsx => Verification UI
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILaborRecord extends Document {
  member_id: mongoose.Types.ObjectId;
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  date: Date;
  
  eitje_source?: {
    shift_id: number;
    shift_start: Date;
    shift_end: Date;
    shift_type?: string;
    hours_worked: number;
    break_minutes?: number;
    hourly_rate: number;
    total_cost: number;
    synced_at: Date;
  };
  
  excel_source?: {
    filename: string;
    hours_worked: number;
    hourly_rate: number;
    total_cost: number;
    uploaded_at: Date;
  };
  
  verification?: {
    has_eitje: boolean;
    has_excel: boolean;
    hours_match: boolean;
    hours_difference?: number;
    hours_accuracy?: number;
    cost_match: boolean;
    cost_difference?: number;
    cost_accuracy?: number;
    requires_review: boolean;
    verified_at?: Date;
  };
  
  hours_final: number;
  cost_final: number;
  status: 'pending_verification' | 'verified' | 'discrepancy' | 'resolved';
  
  resolved_by?: mongoose.Types.ObjectId;
  resolved_at?: Date;
  resolution_note?: string;
  
  created_at: Date;
  updated_at: Date;
}

const LaborRecordSchema = new Schema<ILaborRecord>(
  {
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    team_id: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    date: { type: Date, required: true },
    
    eitje_source: {
      shift_id: { type: Number },
      shift_start: { type: Date },
      shift_end: { type: Date },
      shift_type: { type: String },
      hours_worked: { type: Number },
      break_minutes: { type: Number },
      hourly_rate: { type: Number },
      total_cost: { type: Number },
      synced_at: { type: Date },
    },
    
    excel_source: {
      filename: { type: String },
      hours_worked: { type: Number },
      hourly_rate: { type: Number },
      total_cost: { type: Number },
      uploaded_at: { type: Date },
    },
    
    verification: {
      has_eitje: { type: Boolean, default: false },
      has_excel: { type: Boolean, default: false },
      hours_match: { type: Boolean, default: false },
      hours_difference: { type: Number },
      hours_accuracy: { type: Number },
      cost_match: { type: Boolean, default: false },
      cost_difference: { type: Number },
      cost_accuracy: { type: Number },
      requires_review: { type: Boolean, default: false },
      verified_at: { type: Date },
    },
    
    hours_final: { type: Number, required: true },
    cost_final: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending_verification', 'verified', 'discrepancy', 'resolved'],
      default: 'pending_verification',
    },
    
    resolved_by: { type: Schema.Types.ObjectId, ref: 'Member' },
    resolved_at: { type: Date },
    resolution_note: { type: String },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

LaborRecordSchema.index({ member_id: 1, date: 1 });
LaborRecordSchema.index({ location_id: 1, date: 1 });
LaborRecordSchema.index({ team_id: 1, date: 1 });
LaborRecordSchema.index({ date: 1 });
LaborRecordSchema.index({ status: 1 });
LaborRecordSchema.index({ 'eitje_source.shift_id': 1 }, { unique: true, sparse: true });

const LaborRecord: Model<ILaborRecord> = mongoose.models.LaborRecord || mongoose.model<ILaborRecord>('LaborRecord', LaborRecordSchema);

export default LaborRecord;
