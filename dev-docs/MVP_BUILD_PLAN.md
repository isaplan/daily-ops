# MVP Build Plan: POC → V2 → MVP

**Status:** Building MVP from V2 Design  
**Last Updated:** 2026-01-16  
**Current Phase:** V2 → MVP (In Progress)

---

## 🎯 Where We Are

### ✅ Completed: POC (Proof of Concept)
- Basic CRUD operations for Notes, Todos, Teams, Members, Locations
- Classic V1 layout
- Basic API routes and services
- MongoDB models and schemas
- Connection system (backend) exists but not fully integrated

### ✅ Completed: V2 Design
- Modern Design V2 layout (workspace switcher, top nav, sidebar)
- Environment-based navigation (Collaboration, Chats, Daily Ops)
- Top nav with Notes/Actions/Projects/Events/Chats
- Sidebar with dynamic sections
- Channel grouping (Most Recent, Most Popular, Also You)

### 🚧 In Progress: MVP (Minimum Viable Product)
**Goal:** Fully functional V2 system with complete features

---

## 🔴 Critical Gaps Identified

### 1. **Many-to-Many Connections Not in Forms**
**Problem:** Connection system exists (`connectionService`, API routes) but:
- ❌ No UI in forms to link entities (Note → Todo, Note → Channel, etc.)
- ❌ Forms don't show existing connections
- ❌ No connection picker component

**Impact:** Users can't create relationships between entities during creation/editing

**Solution Needed:**
- [ ] Create `ConnectionPicker` component
- [ ] Add to `NoteForm`, `TodoForm`, `EventForm`, etc.
- [ ] Show existing connections in detail views
- [ ] Allow adding/removing connections inline

---

### 2. **Content Not Clearly Editable**
**Problem:** 
- ❌ Edit modes not obvious (no clear "Edit" buttons)
- ❌ Some forms work but don't indicate edit state
- ❌ Inline editing not consistent

**Impact:** Users don't know they can edit content

**Solution Needed:**
- [ ] Add clear "Edit" buttons to all detail pages
- [ ] Consistent edit mode UI (save/cancel buttons)
- [ ] Visual indicators for edit state
- [ ] Inline editing for simple fields

---

### 3. **Navigation Actions Incomplete**
**Problem:** V2 TopNav has buttons but:
- ❌ Create buttons don't always work
- ❌ Search is placeholder (no implementation)
- ❌ Notifications empty (no data)
- ❌ No feedback on action success/failure

**Impact:** Navigation looks good but doesn't function

**Solution Needed:**
- [ ] Wire up all create buttons to proper routes
- [ ] Implement search functionality
- [ ] Connect notifications to real data
- [ ] Add loading states and success/error feedback

---

### 4. **No Completion Indicators**
**Problem:** 
- ❌ Features delivered without "next step" indicators
- ❌ No way to know what's complete vs. what needs work
- ❌ No TODO markers in UI

**Impact:** Unclear what works and what doesn't

**Solution Needed:**
- [ ] Add feature status badges (✅ Complete, 🚧 In Progress, ⏳ TODO)
- [ ] Document what each feature does and what's next
- [ ] Add inline TODO comments in code
- [ ] Create feature completion checklist

---

## 📋 MVP Feature Checklist

### Core Features (Must Have for MVP)

#### Navigation & Layout
- [x] V2 Layout (workspace switcher, top nav, sidebar)
- [x] Environment switching (Collaboration, Chats, Daily Ops)
- [ ] **TODO:** Wire up all top nav create buttons
- [ ] **TODO:** Implement search functionality
- [ ] **TODO:** Connect notifications to real data

#### Notes
- [x] Create/Read/Update/Delete Notes
- [x] Note list with filtering
- [ ] **TODO:** Add connection picker to NoteForm
- [ ] **TODO:** Show connections in NoteDetailPage
- [ ] **TODO:** Make NoteDetailPage clearly editable

#### Todos (Actions)
- [x] Create/Read/Update/Delete Todos
- [x] Todo list with status filtering
- [ ] **TODO:** Add connection picker to TodoForm
- [ ] **TODO:** Link todos to notes/channels/events
- [ ] **TODO:** Make todos clearly editable

#### Decisions (Projects)
- [x] Create/Read/Update/Delete Decisions
- [ ] **TODO:** Add connection picker to DecisionForm
- [ ] **TODO:** Link decisions to notes/todos
- [ ] **TODO:** Make decisions clearly editable

#### Events
- [x] Create/Read/Update/Delete Events
- [ ] **TODO:** Add connection picker to EventForm
- [ ] **TODO:** Link events to todos/notes/channels
- [ ] **TODO:** Make events clearly editable

#### Channels (Chats)
- [x] Create/Read/Update/Delete Channels
- [x] Channel list with grouping
- [ ] **TODO:** Link channels to notes/todos/events
- [ ] **TODO:** Show linked entities in channel view

#### Connections (Many-to-Many)
- [x] Backend API for bi-directional links
- [x] `connectionService` with all methods
- [ ] **TODO:** `ConnectionPicker` component
- [ ] **TODO:** Add to all forms
- [ ] **TODO:** Display connections in detail views
- [ ] **TODO:** Allow removing connections

---

## 🎯 MVP Build Phases

### Phase 1: Complete Forms with Connections (Week 1)
**Goal:** All forms can create/edit entities AND link them

**Tasks:**
1. Create `ConnectionPicker` component
   - Multi-select for entities (notes, todos, channels, events)
   - Search/filter capability
   - Shows existing connections
   - Allows adding/removing

2. Integrate into all forms:
   - [ ] NoteForm
   - [ ] TodoForm  
   - [ ] EventForm
   - [ ] DecisionForm

3. Update detail pages to show connections:
   - [ ] NoteDetailPage
   - [ ] Todo detail pages
   - [ ] Event detail pages
   - [ ] Decision detail pages

**Deliverable:** Users can create entities and link them together

---

### Phase 2: Make Everything Editable (Week 1-2)
**Goal:** Clear edit modes for all content

**Tasks:**
1. Add edit buttons to all detail pages
2. Consistent edit mode UI:
   - [ ] Edit button → switches to edit mode
   - [ ] Save/Cancel buttons
   - [ ] Visual indicator (border, background change)
3. Inline editing for simple fields
4. Form validation and error handling

**Deliverable:** Users can clearly see and use edit functionality

---

### Phase 3: Complete Navigation Actions (Week 2)
**Goal:** All top nav buttons work properly

**Tasks:**
1. Wire up create buttons:
   - [ ] Notes create → opens NoteForm
   - [ ] Todos create → opens TodoForm
   - [ ] Decisions create → opens DecisionForm
   - [ ] Events create → opens EventForm

2. Implement search:
   - [ ] Search API endpoint
   - [ ] Search UI with results
   - [ ] Search across notes, todos, decisions, events

3. Connect notifications:
   - [ ] Notification API endpoint
   - [ ] Real-time notification updates
   - [ ] Notification list UI

**Deliverable:** Navigation is fully functional

---

### Phase 4: Polish & Completion Indicators (Week 2-3)
**Goal:** Clear status of what works and what doesn't

**Tasks:**
1. Add feature status indicators:
   - [ ] Status badges in UI (Complete/In Progress/TODO)
   - [ ] Feature completion checklist
   - [ ] Inline TODO comments

2. Documentation:
   - [ ] Update this plan as features complete
   - [ ] Document what each feature does
   - [ ] List next steps for incomplete features

**Deliverable:** Clear visibility into MVP status

---

## 🚀 Next Steps (Immediate)

### Step 1: Create ConnectionPicker Component
**File:** `app/components/ConnectionPicker.tsx`

**Features:**
- Multi-select dropdown
- Search/filter entities
- Shows existing connections
- Add/remove connections
- Visual connection badges

**Usage:**
```tsx
<ConnectionPicker
  entityType="note"
  entityId={noteId}
  onConnectionsChange={(connections) => {
    // Update connections
  }}
/>
```

---

### Step 2: Add to NoteForm
**File:** `app/components/NoteForm.tsx`

**Changes:**
- Import `ConnectionPicker`
- Add connections section to form
- Load existing connections
- Save connections on submit

---

### Step 3: Show Connections in NoteDetailPage
**File:** `app/components/NoteDetailPage.tsx`

**Changes:**
- Display linked entities (todos, channels, events)
- Show connection badges
- Allow removing connections
- Add "Link to..." button

---

## 📊 Progress Tracking

### Current Status: **30% Complete**

**Completed:**
- ✅ V2 Layout
- ✅ Basic CRUD for all entities
- ✅ Connection backend API
- ✅ Channel grouping

**In Progress:**
- 🚧 Connection UI integration
- 🚧 Edit mode improvements
- 🚧 Navigation actions

**TODO:**
- ⏳ ConnectionPicker component
- ⏳ Search implementation
- ⏳ Notifications
- ⏳ Feature status indicators

---

## 🎯 Success Criteria for MVP

1. **All forms can create/edit entities** ✅
2. **All forms can link entities together** ❌ (Next priority)
3. **All content is clearly editable** ❌ (Next priority)
4. **All navigation actions work** ❌ (Next priority)
5. **Clear status of what works** ❌ (Next priority)

---

## 📝 Notes

- **Breaking work into small pieces is fine** - but we need to:
  1. Show what's complete
  2. Show what's next
  3. Show what's TODO
  4. Make features fully functional before moving on

- **Many-to-many should be built in from the start** - not added later

- **Editable should be obvious** - users shouldn't have to guess

- **Navigation should work** - buttons should do something

---

**Next Review:** After Phase 1 completion (ConnectionPicker + Form Integration)
