# Todo Management Guide

## Overview

The project management system allows you to:
- ✅ Create todo lists
- ✅ Add todos to lists
- ✅ Add todos to notes
- ✅ Convert chat messages to todos
- ✅ Connect lists to teams/locations
- ✅ Manager visibility for all public todos

---

## API Endpoints

### 1. Create a Todo

**POST** `/api/todos`

```json
{
  "title": "Fix login bug",
  "description": "Users can't log in on mobile",
  "status": "pending",
  "priority": "high",
  "assigned_to": "member_id_here",
  "created_by": "member_id_here",
  "location_id": "location_id_here",  // optional
  "team_id": "team_id_here",          // optional
  "member_id": "member_id_here",      // optional
  "list_id": "list_id_here",          // optional - add to a list
  "linked_note": "note_id_here",      // optional - link to a note
  "linked_chat": "message_id_here",   // optional - link to a message
  "is_public": true,                  // optional - default: false
  "due_date": "2026-01-20T10:00:00Z" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "todo_id",
    "title": "Fix login bug",
    "status": "pending",
    "priority": "high",
    ...
  }
}
```

---

### 2. Get Todos (with filtering)

**GET** `/api/todos`

**Query Parameters:**
- `status` - Filter by status (pending, in_progress, completed, cancelled)
- `list_id` - Filter by todo list
- `location_id` - Filter by location
- `team_id` - Filter by team
- `linked_note` - Filter by linked note
- `linked_chat` - Filter by linked message
- `is_public` - Filter public todos (true/false)
- `current_user_id` - Required for manager role filtering

**Examples:**
```
GET /api/todos?status=pending
GET /api/todos?list_id=123&status=in_progress
GET /api/todos?location_id=456&is_public=true&current_user_id=789
GET /api/todos?linked_note=note_123
```

**Manager Role:**
If `current_user_id` has `overall_manager` role with `company` scope, they can see ALL public todos connected to locations, teams, notes, or chats.

---

### 3. Create a Todo List

**POST** `/api/todo-lists`

```json
{
  "name": "Q1 2026 Sprint",
  "description": "Tasks for Q1 sprint planning",
  "created_by": "member_id_here",
  "location_id": "location_id_here",  // optional
  "team_id": "team_id_here",          // optional
  "is_public": true                   // optional - default: false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "list_id",
    "name": "Q1 2026 Sprint",
    "todos": [],
    ...
  }
}
```

---

### 4. Get Todo Lists

**GET** `/api/todo-lists`

**Query Parameters:**
- `location_id` - Filter by location
- `team_id` - Filter by team
- `is_archived` - Filter archived lists (true/false)

**Examples:**
```
GET /api/todo-lists?location_id=123
GET /api/todo-lists?team_id=456
GET /api/todo-lists?is_archived=false
```

---

### 5. Add Todo to List

**POST** `/api/todo-lists/[list_id]/todos`

```json
{
  "todo_id": "todo_id_here"
}
```

This will:
- Add the todo to the list's `todos` array
- Set the todo's `list_id` field

---

### 6. Remove Todo from List

**DELETE** `/api/todo-lists/[list_id]/todos?todo_id=todo_id_here`

This will:
- Remove the todo from the list's `todos` array
- Clear the todo's `list_id` field

---

### 7. Add Todo to Note

**POST** `/api/notes/[note_id]/todos`

```json
{
  "todo_id": "todo_id_here"
}
```

This will:
- Add the todo to the note's `linked_todos` array
- Set the todo's `linked_note` field

---

### 8. Remove Todo from Note

**DELETE** `/api/notes/[note_id]/todos?todo_id=todo_id_here`

This will:
- Remove the todo from the note's `linked_todos` array
- Clear the todo's `linked_note` field

---

### 9. Convert Message to Todo

**POST** `/api/messages/[message_id]/convert-to-todo`

```json
{
  "title": "Custom title",           // optional - defaults to message text
  "description": "Custom desc",      // optional - defaults to message text
  "status": "pending",               // optional
  "priority": "medium",              // optional
  "assigned_to": "member_id",        // optional - defaults to message author
  "created_by": "member_id",         // optional - defaults to message author
  "location_id": "location_id",      // optional - defaults to channel location
  "team_id": "team_id",              // optional - defaults to channel team
  "list_id": "list_id",              // optional - add to a list
  "is_public": false,                // optional
  "due_date": "2026-01-20T10:00:00Z" // optional
}
```

This will:
- Create a new todo from the message
- Link the todo to the message via `linked_chat`
- Link the message to the todo via `linked_todo`

---

## Usage Examples

### Example 1: Create a Todo List and Add Todos

```javascript
// 1. Create a list
const listResponse = await fetch('/api/todo-lists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Kitchen Tasks',
    description: 'Daily kitchen maintenance tasks',
    created_by: 'member_123',
    team_id: 'team_456',
    is_public: true
  })
});
const { data: list } = await listResponse.json();

// 2. Create todos
const todo1 = await fetch('/api/todos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Clean grills',
    description: 'Deep clean all grill surfaces',
    assigned_to: 'member_789',
    created_by: 'member_123',
    team_id: 'team_456',
    list_id: list._id,
    priority: 'high',
    is_public: true
  })
});

// 3. Or add existing todo to list
await fetch(`/api/todo-lists/${list._id}/todos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    todo_id: 'existing_todo_id'
  })
});
```

### Example 2: Manager Viewing All Public Todos

```javascript
// Get all public todos across all locations/teams
const response = await fetch(
  `/api/todos?is_public=true&current_user_id=${managerId}`
);
const { data: todos } = await response.json();

// Filter by location
const locationTodos = await fetch(
  `/api/todos?location_id=${locationId}&is_public=true&current_user_id=${managerId}`
);
```

### Example 3: Convert Chat Message to Todo

```javascript
// User clicks "Convert to Todo" on a message
const response = await fetch(`/api/messages/${messageId}/convert-to-todo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Follow up on customer complaint',
    assigned_to: 'member_123',
    priority: 'urgent',
    list_id: 'list_456',
    is_public: true
  })
});
```

### Example 4: Link Todo to Note

```javascript
// Add todo to a note
await fetch(`/api/notes/${noteId}/todos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    todo_id: 'todo_123'
  })
});

// Get all todos linked to a note
const todos = await fetch(`/api/todos?linked_note=${noteId}`);
```

---

## Frontend Components

The todos page at `/app/todos/page.tsx` provides basic viewing. You can enhance it with:

1. **Create Todo Form** - Form to create new todos
2. **Todo List Manager** - Create and manage todo lists
3. **Todo Filters** - Filter by status, priority, list, location, team
4. **Manager Dashboard** - View all public todos (for managers)
5. **Quick Actions** - Convert message to todo, add to list, link to note

---

## Best Practices

1. **Use Lists for Organization**: Group related todos into lists (e.g., "Sprint Tasks", "Daily Maintenance")

2. **Public vs Private**: 
   - Set `is_public: true` for todos that managers should see
   - Private todos are only visible to assigned user and creator

3. **Link Context**: Use `linked_note` and `linked_chat` to maintain context about where the todo came from

4. **Team/Location Connections**: Always set `location_id` or `team_id` for better filtering and manager visibility

5. **Priority Levels**: Use priority wisely:
   - `urgent` - Needs immediate attention
   - `high` - Important, should be done soon
   - `medium` - Normal priority (default)
   - `low` - Can wait

---

## Manager Role Permissions

Users with `overall_manager` role and `company` scope can:
- ✅ See ALL public todos across all locations/teams
- ✅ Filter by location, team, note, or chat
- ✅ View todos connected to any note or message

Regular users can only see:
- ✅ Todos assigned to them
- ✅ Todos they created
- ✅ Public todos in their location/team
- ✅ Todos connected to their member profile
