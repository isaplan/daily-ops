---
name: MVP Build Plan with Full Stack Requirements
overview: Complete MVP build plan that integrates many-to-many connections, full CRUD operations, and follows all architectural requirements (MVVM, Next.js 15 SSR, TypeScript strict, Shadcn microcomponents, agent-rules compliance).
todos:
  - id: connection-picker
    content: Create ConnectionPicker component using Shadcn microcomponents, useConnectionViewModel, and connectionService. Must have metadata header, TypeScript strict, SSR compatible (client component).
    status: completed
  - id: note-form-connections
    content: Integrate ConnectionPicker into NoteForm. Update useNoteViewModel to handle connections. Add connections section using Card microcomponent. Full CRUD for connections.
    status: completed
    dependencies:
      - connection-picker
  - id: todo-form-connections
    content: Integrate ConnectionPicker into TodoForm (create if needed). Same pattern as NoteForm. Full CRUD for connections.
    status: completed
    dependencies:
      - connection-picker
  - id: event-form-connections
    content: Integrate ConnectionPicker into EventForm. Same pattern. Full CRUD for connections.
    status: completed
    dependencies:
      - connection-picker
  - id: decision-form-connections
    content: Integrate ConnectionPicker into DecisionForm (create if needed). Same pattern. Full CRUD for connections.
    status: completed
    dependencies:
      - connection-picker
  - id: note-detail-connections
    content: Update NoteDetailPage to display connections using Card/Badge microcomponents. Add Link to... button. Allow removing connections with Dialog confirmation. Use useConnectionViewModel.
    status: completed
    dependencies:
      - connection-picker
  - id: detail-pages-connections
    content: Update all other detail pages (Todo, Event, Decision) to show connections. Same pattern as NoteDetailPage.
    status: completed
    dependencies:
      - note-detail-connections
  - id: verify-api-crud
    content: Verify all API routes have GET/POST/PUT/DELETE with pagination (skip/limit), TypeScript strict (no any), SSR compatible, proper error handling.
    status: completed
  - id: verify-services-crud
    content: Verify all services extend ApiService and have getAll/getById/create/update/delete methods. Type-safe responses, metadata headers.
    status: completed
  - id: verify-viewmodels-crud
    content: Verify all ViewModels use base utilities and have load/create/update/delete methods. Client-side only, metadata headers.
    status: completed
  - id: edit-mode-component
    content: Create EditMode microcomponent (app/components/ui/edit-mode.tsx) using Shadcn components. Toggle view/edit, visual indicators, Save/Cancel buttons.
    status: completed
  - id: detail-pages-edit
    content: Add EditMode to all detail pages. Clear Edit buttons, consistent UI, form validation, error handling.
    status: completed
    dependencies:
      - edit-mode-component
  - id: topnav-create-buttons
    content: Wire up all create buttons in DesignV2TopNav. Use router.push(), add loading states, success/error feedback with Alert.
    status: completed
  - id: search-api
    content: Create search API route (app/api/search/route.ts). Server-side, search across notes/todos/decisions/events, pagination, TypeScript strict.
    status: completed
  - id: search-service
    content: Create searchService (app/lib/services/searchService.ts). Extend ApiService, type-safe, metadata header.
    status: completed
    dependencies:
      - search-api
  - id: search-ui
    content: Implement search UI in DesignV2TopNav Popover. Use searchService, display results with Card/Badge, loading with Skeleton.
    status: completed
    dependencies:
      - search-service
  - id: notifications-api
    content: Create/update notifications API route. GET with pagination, PUT for read, DELETE. TypeScript strict, SSR compatible.
    status: completed
  - id: notifications-service
    content: Create/update notificationService. Extend ApiService, type-safe, metadata header.
    status: completed
    dependencies:
      - notifications-api
  - id: notifications-ui
    content: Connect notifications in DesignV2TopNav. Load on mount, display in Popover, badge count, real-time if available.
    status: completed
    dependencies:
      - notifications-service
  - id: ssr-optimization
    content: Convert pages to Server Components where possible. Use Suspense boundaries. Ensure no DB fetches in UI components.
    status: pending
  - id: typescript-strict
    content: "Fix all any types. Replace useState<any> with proper types. Replace error: any with error: unknown. Use getErrorMessage helper."
    status: completed
---

# MVP Build Plan: Full Stack Requirements

## Overview

This plan builds the MVP from V2 Design, ensuring all features are complete, functional, and follow strict architectural requirements.

**Key Requirements:**

- Agent Rules compliance (metadata headers, registry checks, SSR first, pagination)
- MVVM pattern (View → ViewModel → Service → API)
- Next.js 15 (Server Components, Suspense, App Router)
- TypeScript strict mode (no `any`, proper error handling)
- SSR-first architecture (Server Components where possible)
- Shadcn microcomponents only (no raw HTML/Tailwind)
- Many-to-many connections in all forms
- Full CRUD operations (GET/PUT/POST/DELETE) for all entities

---

## 🔴 MANDATORY WORKFLOW (Before Every Phase)

**RULE #0: UNDERSTAND → CLARIFY → CONFIRM**

Before ANY action in ANY phase:

1. **Registry Check:** `grep '"file": "app/path"' function-registry.json`

                                                                                                                                                                                                - Check if file exists in registry
                                                                                                                                                                                                - Check if `touch_again: false` (protected file - ASK PERMISSION FIRST)
                                                                                                                                                                                                - Check current status

2. **Metadata Header Check:** Read existing metadata header if file exists

                                                                                                                                                                                                - Read `@exports-to` to see all dependent files
                                                                                                                                                                                                - Plan ALL updates together (don't modify in isolation)
                                                                                                                                                                                                - Update `@last-modified` → ISO timestamp
                                                                                                                                                                                                - Update `@last-fix` → `[YYYY-MM-DD] what was fixed`

3. **TypeScript Strict Check:** Verify no `any` types

                                                                                                                                                                                                - Replace `useState<any>` with proper types
                                                                                                                                                                                                - Replace `error: any` with `error: unknown`
                                                                                                                                                                                                - Use `getErrorMessage` helper

4. **SSR Decision:** Decide Server vs Client Component upfront

                                                                                                                                                                                                - Server Component by default (data fetching)
                                                                                                                                                                                                - Client Component only when needed (`'use client'`)
                                                                                                                                                                                                - Use Suspense boundaries for async data

5. **Show Full Plan:** List all files you'll touch (create/modify/delete)

                                                                                                                                                                                                - Get explicit approval: "Go ahead" / "Proceed"
                                                                                                                                                                                                - THEN execute (no more discussion)

6. **Commit Together:** If metadata says "exports-to X, Y, Z", commit all together

---

## Phase 1: ConnectionPicker Component (Foundation)

### 1.1 Create ConnectionPicker Component

**File:** `app/components/ConnectionPicker.tsx`

**Requirements:**

- Uses Shadcn microcomponents (Select, Popover, Badge, Button)
- Client component (`'use client'`)
- MVVM pattern: Uses `useConnectionViewModel`
- TypeScript strict: No `any`, proper types
- SSR compatible: Client-side only (form interaction)

**Features:**

- Multi-select for entities (notes, todos, channels, events, decisions)
- Search/filter capability
- Shows existing connections
- Add/remove connections
- Visual connection badges
- Loading states with Skeleton
- Error handling with Alert

**Metadata Header Required:**

```typescript
/**
 * @registry-id: ConnectionPicker
 * @created: [ISO_DATE]
 * @last-modified: [ISO_DATE]
 * @description: Connection picker component for many-to-many entity linking
 * @last-fix: [DATE] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/viewmodels/useConnectionViewModel.ts => Connection state management
 *   - app/lib/services/connectionService.ts => Connection API operations
 *   - app/components/ui/** => Shadcn microcomponents
 * 
 * @exports-to:
 *   ✓ app/components/NoteForm.tsx => Connection picker in note forms
 *   ✓ app/components/TodoForm.tsx => Connection picker in todo forms
 *   ✓ app/components/EventForm.tsx => Connection picker in event forms
 *   ✓ app/components/DecisionForm.tsx => Connection picker in decision forms
 */
```

**Implementation:**

- Use `useConnectionViewModel` for state management
- Use `connectionService` for API calls
- Use Shadcn Select for multi-select
- Use Shadcn Badge for connection display
- Use Shadcn Skeleton for loading
- Use Shadcn Alert for errors

---

## Phase 2: Integrate Connections into Forms

### 🔴 MANDATORY PRE-PHASE WORKFLOW

1. **Registry Check:**
   ```bash
   grep '"file": "app/components/NoteForm"' function-registry.json
   grep '"file": "app/components/TodoForm"' function-registry.json
   grep '"file": "app/components/EventForm"' function-registry.json
   grep '"file": "app/components/DecisionForm"' function-registry.json
   ```


                                                                                                                                                                                                - Check each file for `touch_again: false` → ASK PERMISSION if protected

2. **Metadata Header Check:** Read existing headers

                                                                                                                                                                                                - Read `@exports-to` for each file
                                                                                                                                                                                                - Plan updates to all dependent files together
                                                                                                                                                                                                - Update `@last-modified` and `@last-fix` together

3. **TypeScript Strict:** Verify no new `any` types introduced

4. **SSR Decision:** Client Components (forms require interactivity)

5. **Show Plan:** List all forms to update → Get approval

### 2.1 Update NoteForm

**File:** `app/components/NoteForm.tsx`

**Pre-Update Steps:**

1. Read existing metadata header
2. Check `@exports-to` dependencies
3. Plan updates together

**Changes:**

- Import `ConnectionPicker` component
- Add connections section to form (using Card microcomponent)
- Load existing connections via `useConnectionViewModel`
- Save connections on form submit
- Update `useNoteViewModel` to handle connection data

**Metadata Header Update:**

- Update `@last-modified` timestamp (ISO format)
- Update `@last-fix` with connection integration: `[YYYY-MM-DD] Added ConnectionPicker integration`
- Update `@exports-to` if needed
- Commit together with any dependent files listed in `@exports-to`

**CRUD Operations:**

- GET: Load existing connections when editing
- POST: Create connections on note creation
- PUT: Update connections on note update
- DELETE: Remove connections when unlinked

### 2.2 Update TodoForm

**File:** `app/components/TodoForm.tsx` (or create if doesn't exist)

**Same pattern as NoteForm:**

- Add ConnectionPicker
- Integrate with `useTodoViewModel`
- Full CRUD for connections

### 2.3 Update EventForm

**File:** `app/components/EventForm.tsx`

**Same pattern:**

- Add ConnectionPicker
- Integrate with `useEventViewModel`
- Full CRUD for connections

### 2.4 Update DecisionForm

**File:** `app/components/DecisionForm.tsx` (or create if doesn't exist)

**Same pattern:**

- Add ConnectionPicker
- Integrate with ViewModel
- Full CRUD for connections

---

## Phase 3: Display Connections in Detail Pages

### 3.1 Update NoteDetailPage

**File:** `app/components/NoteDetailPage.tsx`

**Changes:**

- Display linked entities section (using Card microcomponent)
- Show connection badges (using Badge microcomponent)
- Add "Link to..." button (using Button microcomponent)
- Allow removing connections (with confirmation Dialog)
- Use `useConnectionViewModel` for connection management

**CRUD Operations:**

- GET: Fetch connections on page load
- DELETE: Remove connection with confirmation

**Edit Mode:**

- Add clear "Edit" button (using Button microcomponent)
- Toggle edit mode with visual indicator
- Save/Cancel buttons
- Form validation

### 3.2 Update Todo Detail Pages

**Same pattern as NoteDetailPage**

### 3.3 Update Event Detail Pages

**Same pattern**

### 3.4 Update Decision Detail Pages

**Same pattern**

---

## Phase 4: Ensure Full CRUD Operations

### 🔴 MANDATORY PRE-PHASE WORKFLOW

1. **Registry Check:** Check all API routes, services, ViewModels
   ```bash
   grep '"type": "api"' function-registry.json
   grep '"type": "service"' function-registry.json
   grep '"type": "viewmodel"' function-registry.json
   ```

2. **Audit Existing:** Don't just verify - FIX gaps

                                                                                                                                                                                                - List all entities (notes, todos, events, decisions, channels)
                                                                                                                                                                                                - Check each API route for all CRUD methods
                                                                                                                                                                                                - Check each service for all CRUD methods
                                                                                                                                                                                                - Check each ViewModel for all CRUD methods
                                                                                                                                                                                                - Check pagination on ALL list endpoints

3. **Metadata Headers:** Read and update headers for all modified files

4. **TypeScript Strict:** Fix any `any` types found during audit

5. **Show Plan:** List all files to audit/fix → Get approval

### 4.1 Verify AND Fix API Routes

**Files:** `app/api/**/route.ts`

**Audit Process:**

1. **List all entities:**

                                                                                                                                                                                                - notes, todos, events, decisions, channels, connections, notifications, search

2. **For each entity, verify AND FIX:**

                                                                                                                                                                                                - GET (list): `/api/[entity]/route.ts` with pagination (skip/limit) - **FIX IF MISSING**
                                                                                                                                                                                                - GET (single): `/api/[entity]/[id]/route.ts` - **CREATE IF MISSING**
                                                                                                                                                                                                - POST (create): `/api/[entity]/route.ts` - **CREATE IF MISSING**
                                                                                                                                                                                                - PUT (update): `/api/[entity]/[id]/route.ts` - **CREATE IF MISSING**
                                                                                                                                                                                                - DELETE: `/api/[entity]/[id]/route.ts` - **CREATE IF MISSING**

**Requirements:**

- TypeScript strict: No `any`, use `getErrorMessage` from `@/lib/types/errors`
- SSR compatible: Server-side only (no client-side DB access)
- Pagination: Always use skip/limit - **ADD IF MISSING**
- Error handling: Proper try/catch with typed errors (`error: unknown`)

### 4.2 Verify Services

**Files:** `app/lib/services/*.ts`

**Check all services have:**

- `getAll(filters?, skip?, limit?)` method
- `getById(id)` method
- `create(data)` method
- `update(id, data)` method
- `delete(id)` method

**Requirements:**

- Extend `ApiService` base class
- Type-safe responses: `ApiResponse<T>`
- Proper error handling
- Metadata headers

### 4.3 Verify ViewModels

**Files:** `app/lib/viewmodels/*.ts`

**Check all ViewModels have:**

- `load[Entity]s()` method
- `get[Entity]ById(id)` method
- `create[Entity](data)` method
- `update[Entity](id, data)` method
- `delete[Entity](id)` method

**Requirements:**

- Use `useViewModelState` from base
- Use `useFormState` for forms
- Client-side only (`'use client'`)
- Metadata headers

---

## Phase 5: Navigation Actions Implementation

### 5.1 Wire Up Create Buttons

**File:** `app/components/layouts/DesignV2TopNav.tsx`

**Changes:**

- Connect create buttons to proper routes
- Use router.push() for navigation
- Add loading states
- Add success/error feedback (using Alert microcomponent)

**Routes:**

- Notes create → `/notes?create=true`
- Todos create → `/todos?create=true`
- Decisions create → `/decisions?create=true`
- Events create → `/events?create=true`

### 5.2 Implement Search

**File:** `app/api/search/route.ts` (new)

**Requirements:**

- Server-side route handler
- Search across notes, todos, decisions, events
- Pagination (skip/limit)
- TypeScript strict
- SSR compatible

**File:** `app/lib/services/searchService.ts` (new)

**Requirements:**

- Extend `ApiService`
- Type-safe search results
- Metadata header

**File:** `app/components/layouts/DesignV2TopNav.tsx`

**Changes:**

- Implement search UI in Popover
- Use `searchService` for API calls
- Display results (using Card, Badge microcomponents)
- Loading states (using Skeleton)

### 5.3 Connect Notifications

**File:** `app/api/notifications/route.ts` (new or update existing)

**Requirements:**

- GET: Fetch notifications with pagination
- PUT: Mark as read
- DELETE: Remove notification
- TypeScript strict
- SSR compatible

**File:** `app/lib/services/notificationService.ts` (new or update)

**File:** `app/components/layouts/DesignV2TopNav.tsx`

**Changes:**

- Load notifications on mount
- Display notification list in Popover
- Real-time updates (if Socket.io available)
- Badge count indicator

---

## Phase 6: Edit Mode Improvements

### 6.1 Create EditMode Component

**File:** `app/components/ui/edit-mode.tsx` (new microcomponent)

**Features:**

- Toggle between view/edit modes
- Visual indicators (border, background)
- Save/Cancel buttons
- Loading states

**Requirements:**

- Shadcn microcomponents only
- TypeScript strict
- Reusable across all detail pages

### 6.2 Update All Detail Pages

**Files:** All detail page components

**Changes:**

- Use EditMode component
- Clear "Edit" button
- Consistent edit UI
- Form validation
- Error handling

---

## Phase 7: SSR Optimization (MOVED TO PHASE 1 CONSIDERATIONS)

**NOTE:** SSR decisions should be made from Phase 1, not deferred to Phase 7.

### 7.1 Convert Pages to Server Components

**Files:** `app/**/page.tsx`

**Pre-Update Steps:**

1. Registry check for all page files
2. Read metadata headers
3. Plan Server Component conversion
4. Get approval

**Requirements:**

- Remove `'use client'` where possible
- Use Server Components for data fetching
- Use Suspense boundaries for async data
- Pass data as props to Client Components

**Decision Matrix (Use from Phase 1):**

- Server Component: Data fetching, static content, SEO pages
- Client Component: Forms, interactivity, state management, hooks

**Pattern:**

```typescript
// app/notes/page.tsx (Server Component)
import { Suspense } from 'react'
import NoteList from '@/components/NoteList'
import { Skeleton } from '@/components/ui/skeleton'

export default async function NotesPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NoteList />
    </Suspense>
  )
}
```

### 7.2 Ensure No DB Fetches in UI

**Check all components:**

- No direct MongoDB imports in components
- All data fetching via API routes
- Services handle all API calls
- ViewModels handle client-side state

---

## Phase 8: TypeScript Strict Compliance (ENFORCED FROM PHASE 1)

**NOTE:** TypeScript strict should be enforced from Phase 1, not fixed in Phase 8.

### 8.1 Fix All `any` Types (Should be done in each phase)

**Files:** All TypeScript files

**Process:**

1. Before modifying any file, check for `any` types
2. Fix immediately, don't defer
3. Use proper types from the start

**Requirements:**

- Replace `useState<any>` with proper types
- Replace `error: any` with `error: unknown`
- Use `getErrorMessage` helper
- Proper type definitions for all state

**Audit Command:**

```bash
grep -r "any\[" app/
grep -r ": any" app/
grep -r "useState<any>" app/
```

### 8.2 Add Missing Types

**Files:** `app/lib/types/*.ts`

**Create types for:**

- Connection picker props
- Search results
- Notification data
- Edit mode state

---

## Phase 9: Testing & Validation

### 9.1 Verify All Features

- [ ] All forms can create entities
- [ ] All forms can link entities (many-to-many)
- [ ] All detail pages show connections
- [ ] All content is editable
- [ ] All navigation actions work
- [ ] Search works across all entities
- [ ] Notifications load and display
- [ ] Full CRUD works for all entities

### 9.2 Verify Architecture

- [ ] All components use Shadcn microcomponents
- [ ] All components use ViewModels (no direct API calls)
- [ ] All API routes are SSR compatible
- [ ] All services extend ApiService
- [ ] All ViewModels use base utilities
- [ ] All files have metadata headers
- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] Pagination on all list endpoints

---

## File Structure

```
app/
├── components/
│   ├── ui/
│   │   ├── connection-picker.tsx        # NEW: ConnectionPicker
│   │   └── edit-mode.tsx                # NEW: EditMode component
│   ├── NoteForm.tsx                     # UPDATE: Add ConnectionPicker
│   ├── TodoForm.tsx                     # UPDATE: Add ConnectionPicker
│   ├── EventForm.tsx                    # UPDATE: Add ConnectionPicker
│   ├── DecisionForm.tsx                 # UPDATE: Add ConnectionPicker
│   ├── NoteDetailPage.tsx               # UPDATE: Show connections, edit mode
│   └── ... (other detail pages)
│
├── lib/
│   ├── services/
│   │   ├── searchService.ts             # NEW: Search service
│   │   ├── notificationService.ts       # NEW/UPDATE: Notification service
│   │   └── connectionService.ts         # EXISTS: Verify full CRUD
│   ├── viewmodels/
│   │   ├── useConnectionViewModel.ts    # EXISTS: Verify methods
│   │   └── useSearchViewModel.ts        # NEW: Search ViewModel
│   └── types/
│       ├── search.types.ts              # NEW: Search types
│       └── notification.types.ts        # NEW: Notification types
│
└── api/
    ├── search/
    │   └── route.ts                     # NEW: Search endpoint
    └── notifications/
        └── route.ts                     # NEW/UPDATE: Notification endpoint
```

---

## Success Criteria

1. **Many-to-Many Connections:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ ConnectionPicker component created
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All forms can link entities
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All detail pages show connections
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Connections can be added/removed

2. **Full CRUD Operations:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All entities have GET/POST/PUT/DELETE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All services have CRUD methods
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All ViewModels have CRUD methods
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Pagination on all list endpoints

3. **Edit Functionality:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All detail pages have edit mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Clear edit buttons
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Consistent edit UI
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Form validation

4. **Navigation Actions:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ All create buttons work
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Search implemented
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Notifications connected

5. **Architecture Compliance:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ MVVM pattern throughout
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Shadcn microcomponents only
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ SSR-first architecture
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ TypeScript strict mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Agent rules compliance
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - ✅ Metadata headers on all files

---

## Implementation Order

**CRITICAL:** Each phase must follow the mandatory workflow above.

1. **Phase 1:** ConnectionPicker component (foundation)

                                                                                                                                                                                                - Enforce TypeScript strict from start
                                                                                                                                                                                                - Make SSR decision upfront
                                                                                                                                                                                                - Follow registry/metadata workflow

2. **Phase 2:** Integrate into forms (NoteForm first, then others)

                                                                                                                                                                                                - Check registry for protected files
                                                                                                                                                                                                - Read metadata headers before modifying
                                                                                                                                                                                                - Update metadata together with dependents

3. **Phase 3:** Display in detail pages (NoteDetailPage first)

                                                                                                                                                                                                - Same workflow as Phase 2

4. **Phase 4:** Verify AND FIX full CRUD (all entities)

                                                                                                                                                                                                - Audit existing routes/services/ViewModels
                                                                                                                                                                                                - Fix gaps, don't just verify
                                                                                                                                                                                                - Add pagination where missing

5. **Phase 5:** Navigation actions (create, search, notifications)

                                                                                                                                                                                                - Follow workflow for each new file

6. **Phase 6:** Edit mode improvements

                                                                                                                                                                                                - Follow workflow

7. **Phase 7:** SSR optimization (considerations from Phase 1)

                                                                                                                                                                                                - Convert pages to Server Components where appropriate

8. **Phase 8:** TypeScript strict compliance (enforced from Phase 1)

                                                                                                                                                                                                - Final audit and cleanup

9. **Phase 9:** Testing & validation

---

## Notes

- **Registry Check:** Always grep `function-registry.json` before editing (MANDATORY)
- **Protected Files:** If `touch_again: false` → ASK PERMISSION FIRST
- **Metadata Headers:** Required on all critical files (see agent-rules)
- **Metadata Workflow:** Read → Check exports → Update together → Commit together
- **TypeScript Strict:** Enforce from Phase 1, don't defer to Phase 8
- **SSR Decisions:** Make upfront, don't defer to Phase 7
- **CRUD Audit:** Don't just verify - FIX gaps found
- **Pagination:** Verify AND ADD to all list endpoints