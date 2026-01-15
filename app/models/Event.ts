/**
 * @registry-id: EventModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Event schema and model for event management
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/events/** => Event CRUD operations
 * ✓ app/components/events/** => Event display components
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  name: string;
  client_name: string;
  guest_count: number;
  date: Date;
  
  location_id: mongoose.Types.ObjectId;
  channel_id?: mongoose.Types.ObjectId;
  
  assigned_to?: mongoose.Types.ObjectId;
  
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  
  pdf_pasy_plan?: {
    filename: string;
    url: string;
    uploaded_at: Date;
    extracted_data?: any;
  };
  
  sections: Array<{
    title: string;
    items: Array<{
      name: string;
      portion_count: number;
      prep_time_minutes?: number;
      dietary_restrictions?: string[];
    }>;
  }>;
  
  timeline: Array<{
    time: string;
    activity: string;
    assigned_to?: mongoose.Types.ObjectId;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  
  inventory?: Array<{
    item_name: string;
    quantity: number;
    unit: string;
    status: 'ordered' | 'received' | 'prepared';
  }>;
  
  staffing?: Array<{
    member_id: mongoose.Types.ObjectId;
    role: string;
    start_time: Date;
    end_time: Date;
    confirmed: boolean;
  }>;
  
  estimated_labor_cost?: number;
  actual_labor_cost?: number;
  revenue?: number;
  estimated_profit?: number;
  
  created_by: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    name: { type: String, required: true },
    client_name: { type: String, required: true },
    guest_count: { type: Number, required: true },
    date: { type: Date, required: true },
    
    location_id: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    channel_id: { type: Schema.Types.ObjectId, ref: 'Channel' },
    
    assigned_to: { type: Schema.Types.ObjectId, ref: 'Member' },
    
    status: {
      type: String,
      enum: ['planning', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'planning',
    },
    
    pdf_pasy_plan: {
      filename: { type: String },
      url: { type: String },
      uploaded_at: { type: Date },
      extracted_data: { type: Schema.Types.Mixed },
    },
    
    sections: [{
      title: { type: String, required: true },
      items: [{
        name: { type: String, required: true },
        portion_count: { type: Number, required: true },
        prep_time_minutes: { type: Number },
        dietary_restrictions: [{ type: String }],
      }],
    }],
    
    timeline: [{
      time: { type: String, required: true },
      activity: { type: String, required: true },
      assigned_to: { type: Schema.Types.ObjectId, ref: 'Member' },
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending',
      },
    }],
    
    inventory: [{
      item_name: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit: { type: String, required: true },
      status: {
        type: String,
        enum: ['ordered', 'received', 'prepared'],
        default: 'ordered',
      },
    }],
    
    staffing: [{
      member_id: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
      role: { type: String, required: true },
      start_time: { type: Date, required: true },
      end_time: { type: Date, required: true },
      confirmed: { type: Boolean, default: false },
    }],
    
    estimated_labor_cost: { type: Number },
    actual_labor_cost: { type: Number },
    revenue: { type: Number },
    estimated_profit: { type: Number },
    
    created_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

EventSchema.index({ location_id: 1 });
EventSchema.index({ channel_id: 1 });
EventSchema.index({ assigned_to: 1 });
EventSchema.index({ date: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ created_by: 1 });

const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;
