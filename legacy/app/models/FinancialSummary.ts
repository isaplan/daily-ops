/**
 * @registry-id: FinancialSummaryModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Financial summary schema for uploaded Excel files (labor, revenue, P&L)
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/financial-summaries/** => Financial summary operations
 * ✓ app/lib/services/ExcelParserService.ts => Excel parsing
 * ✓ app/components/admin/** => Financial dashboard
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFinancialSummary extends Document {
  location_id: mongoose.Types.ObjectId;
  month: number;
  year: number;
  
  hours_file_data?: {
    filename: string;
    uploaded_at: Date;
    data: Array<{
      member_id?: mongoose.Types.ObjectId;
      member_name?: string;
      date: Date;
      hours: number;
      cost: number;
    }>;
  };
  
  revenue_file_data?: {
    filename: string;
    uploaded_at: Date;
    data: Array<{
      date: Date;
      amount: number;
      transaction_count: number;
      source?: string;
    }>;
  };
  
  pnl_data?: {
    filename: string;
    uploaded_at: Date;
    revenue: number;
    labor_cost: number;
    other_costs: number;
    profit: number;
    profit_margin: number;
    breakdown?: Record<string, number>;
  };
  
  uploaded_by?: mongoose.Types.ObjectId;
  uploaded_at: Date;
  
  created_at: Date;
  updated_at: Date;
}

const FinancialSummarySchema = new Schema<IFinancialSummary>(
  {
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    
    hours_file_data: {
      filename: { type: String },
      uploaded_at: { type: Date },
      data: [{
        member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
        member_name: { type: String },
        date: { type: Date },
        hours: { type: Number },
        cost: { type: Number },
      }],
    },
    
    revenue_file_data: {
      filename: { type: String },
      uploaded_at: { type: Date },
      data: [{
        date: { type: Date },
        amount: { type: Number },
        transaction_count: { type: Number },
        source: { type: String },
      }],
    },
    
    pnl_data: {
      filename: { type: String },
      uploaded_at: { type: Date },
      revenue: { type: Number },
      labor_cost: { type: Number },
      other_costs: { type: Number },
      profit: { type: Number },
      profit_margin: { type: Number },
      breakdown: { type: Map, of: Number },
    },
    
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'Member' },
    uploaded_at: { type: Date, default: Date.now },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

FinancialSummarySchema.index({ location_id: 1, year: 1, month: 1 }, { unique: true });
FinancialSummarySchema.index({ year: 1, month: 1 });

const FinancialSummary: Model<IFinancialSummary> = mongoose.models.FinancialSummary || mongoose.model<IFinancialSummary>('FinancialSummary', FinancialSummarySchema);

export default FinancialSummary;
