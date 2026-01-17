/**
 * @registry-id: TodoModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-16T20:50:00.000Z
 * @description: Todo schema and model
 * @last-fix: [2026-01-16] Fixed: Added safety check for mongoose.modelSchemas before deletion
 * 
 * @exports-to:
 * ✓ app/api/todos/** => Todo CRUD operations
 * ✓ app/api/todo-lists/** => Todo list management
 * ✓ app/api/notes/** => Note-todo linking
 * ✓ app/api/messages/** => Message-to-todo conversion
 * ✓ app/api/connections/** => Bi-directional entity linking
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  
  assigned_to: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  
  connected_to: {
    location_id?: mongoose.Types.ObjectId;
    team_id?: mongoose.Types.ObjectId;
    member_id?: mongoose.Types.ObjectId;
  };
  
  list_id?: mongoose.Types.ObjectId;
  linked_note?: mongoose.Types.ObjectId;
  linked_chat?: mongoose.Types.ObjectId;
  linked_event?: mongoose.Types.ObjectId;
  
  linked_entities?: Array<{
    type: 'note' | 'channel' | 'todo' | 'decision' | 'event';
    id: mongoose.Types.ObjectId;
  }>;
  
  is_public: boolean;
  
  due_date?: Date;
  completed_at?: Date;
  
  created_at: Date;
  updated_at: Date;
}

const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    
    assigned_to: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    connected_to: {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
      member_id: { type: Schema.Types.ObjectId, ref: 'Member' },
    },
    
    list_id: { type: Schema.Types.ObjectId, ref: 'TodoList' },
    linked_note: { type: Schema.Types.ObjectId, ref: 'Note' },
    linked_chat: { type: Schema.Types.ObjectId, ref: 'Message' },
    linked_event: { type: Schema.Types.ObjectId, ref: 'Event' },
    
    linked_entities: [{
      type: {
        type: String,
        enum: ['note', 'channel', 'todo', 'decision', 'event'],
        required: true,
      },
      id: { type: Schema.Types.ObjectId, required: true },
    }],
    
    is_public: { type: Boolean, default: false },
    
    due_date: { type: Date },
    completed_at: { type: Date },
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    strictPopulate: false,
    strict: false,
  }
);

TodoSchema.index({ assigned_to: 1 });
TodoSchema.index({ created_by: 1 });
TodoSchema.index({ 'connected_to.location_id': 1 });
TodoSchema.index({ 'connected_to.team_id': 1 });
TodoSchema.index({ 'connected_to.member_id': 1 });
TodoSchema.index({ list_id: 1 });
TodoSchema.index({ linked_note: 1 });
TodoSchema.index({ linked_chat: 1 });
TodoSchema.index({ linked_event: 1 });
TodoSchema.index({ 'linked_entities.id': 1 });
TodoSchema.index({ 'linked_entities.type': 1 });
TodoSchema.index({ is_public: 1 });
TodoSchema.index({ status: 1 });

// Force recompilation if model exists to ensure schema updates are applied
if (mongoose.models.Todo) {
  delete mongoose.models.Todo;
  if (mongoose.modelSchemas && mongoose.modelSchemas.Todo) {
    delete mongoose.modelSchemas.Todo;
  }
}

const Todo: Model<ITodo> = mongoose.model<ITodo>('Todo', TodoSchema);

export default Todo;
