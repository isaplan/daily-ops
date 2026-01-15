/**
 * @registry-id: TodoListModel
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: TodoList schema - groups todos together, can be connected to teams/locations
 * @last-fix: [2026-01-15] Initial implementation
 * 
 * @exports-to:
 * ✓ app/api/todo-lists/** => TodoList CRUD operations
 * ✓ app/components/todos/** => TodoList display components
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITodoList extends Document {
  name: string;
  description?: string;
  
  created_by: mongoose.Types.ObjectId;
  
  connected_to: {
    location_id?: mongoose.Types.ObjectId;
    team_id?: mongoose.Types.ObjectId;
  };
  
  is_public: boolean;
  is_archived: boolean;
  
  todos: mongoose.Types.ObjectId[];
  
  created_at: Date;
  updated_at: Date;
}

const TodoListSchema = new Schema<ITodoList>(
  {
    name: { type: String, required: true },
    description: { type: String },
    
    created_by: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
    
    connected_to: {
      location_id: { type: Schema.Types.ObjectId, ref: 'Location' },
      team_id: { type: Schema.Types.ObjectId, ref: 'Team' },
    },
    
    is_public: { type: Boolean, default: false },
    is_archived: { type: Boolean, default: false },
    
    todos: [{ type: Schema.Types.ObjectId, ref: 'Todo' }],
    
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

TodoListSchema.index({ created_by: 1 });
TodoListSchema.index({ 'connected_to.location_id': 1 });
TodoListSchema.index({ 'connected_to.team_id': 1 });
TodoListSchema.index({ is_public: 1 });
TodoListSchema.index({ is_archived: 1 });

const TodoList: Model<ITodoList> = mongoose.models.TodoList || mongoose.model<ITodoList>('TodoList', TodoListSchema);

export default TodoList;
