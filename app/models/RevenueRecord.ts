/**
 * @registry-id: RevenueRecordModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Revenue record schema for tracking revenue by member
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/revenue-records/** => Revenue record operations
 * ✓ app/lib/services/RevenueService.ts => Revenue aggregation
 * ✓ app/components/dashboard/** => Revenue display
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRevenueRecord extends Document {
  member_id: mongoose.Types.ObjectId;
  location_id: mongoose.Types.ObjectId;
  team_id: mongoose.Types.ObjectId;
  date: Date;
  
  amount: number;
  currency: string;
  
  transaction_type: 'sale' | 'service' | 'event' | 'other';
  transaction_id?: string;
  
  source?: {
    bork_id?: string;
    excel_file?: string;
    manual_entry?: boolean;
    uploaded_at?: Date;
  };
  
  metadata?: {
    table_number?: number;
    guest_count?: number;
    service_type?: string;
    notes?: string;
  };
  
  created_at: Date;
  updated_at: Date;
}

const RevenueRecordSchema = new Schema<IRevenueRecord>(
  {
    member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    team_id: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    date: { type: Date, required: true },
    
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    
    transaction_type: {
      type: String,
      enum: ['sale', 'service', 'event', 'other'],
      default: 'sale',
    },
    transaction_id: { type: String },
    
    source: {
      bork_id: { type: String },
      excel_file: { type: String },
      manual_entry: { type: Boolean, default: false },
      uploaded_at: { type: Date },
    },
    
    metadata: {
      table_number: { type: Number },
      guest_count: { type: Number },
      service_type: { type: String },
      notes: { type: String },
    },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

RevenueRecordSchema.index({ member_id: 1, date: 1 });
RevenueRecordSchema.index({ location_id: 1, date: 1 });
RevenueRecordSchema.index({ team_id: 1, date: 1 });
RevenueRecordSchema.index({ date: 1 });
RevenueRecordSchema.index({ transaction_id: 1 }, { unique: true, sparse: true });

const RevenueRecord: Model<IRevenueRecord> = mongoose.models.RevenueRecord || mongoose.model<IRevenueRecord>('RevenueRecord', RevenueRecordSchema);

export default RevenueRecord;
