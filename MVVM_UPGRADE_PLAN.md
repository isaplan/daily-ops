# MVVM + Shadcn Microcomponents Upgrade Plan

## 📋 Executive Summary

**Goal:** Refactor entire codebase to MVVM architecture with reusable shadcn microcomponents.

**Current State:**
- ❌ No shadcn UI components installed
- ❌ Components mix UI + business logic
- ❌ Direct API calls in components
- ❌ No reusable microcomponents
- ❌ No ViewModels or Services layer
- ❌ Inconsistent patterns across components

**Target State:**
- ✅ Full shadcn UI microcomponents library
- ✅ MVVM pattern: View (UI) ↔ ViewModel (hooks) ↔ Service (API) ↔ Model (API routes)
- ✅ All components reusable and composable
- ✅ Business logic separated from UI
- ✅ Type-safe, SSR-compatible, modular

---

## 🏗️ Architecture Overview

### MVVM Pattern Structure

```
┌─────────────────────────────────────────────────────────┐
│ VIEW (Components)                                       │
│ - Pure UI components using microcomponents              │
│ - No business logic, only presentation                 │
│ - Receives data via props from ViewModels               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ VIEWMODEL (Custom Hooks)                                │
│ - State management                                      │
│ - Business logic coordination                           │
│ - Calls Services for data operations                   │
│ - Returns state + handlers to View                     │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ SERVICE (API Client Layer)                              │
│ - Type-safe API calls                                   │
│ - Request/response transformation                       │
│ - Error handling                                        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ MODEL (API Routes + Database)                           │
│ - Existing API routes (app/api/**)                      │
│ - MongoDB models (app/models/**)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Phase 1: Shadcn UI Setup + Microcomponents Foundation

### 1.1 Install Shadcn UI
- [ ] Initialize shadcn: `npx shadcn@latest init`
- [ ] Configure `components.json`
- [ ] Update `tailwind.config.ts` with shadcn theme

### 1.2 Create Core Microcomponents (`app/components/ui/`)

**Form Components:**
- [ ] `Button` - Primary, secondary, ghost, destructive variants
- [ ] `Input` - Text, email, password, number, date, time
- [ ] `Textarea` - Multi-line text input
- [ ] `Select` - Dropdown with search, multi-select support
- [ ] `Checkbox` - Single and group checkboxes
- [ ] `RadioGroup` - Radio button groups
- [ ] `Switch` - Toggle switches
- [ ] `Label` - Form labels
- [ ] `Form` - Form wrapper with validation (react-hook-form)

**Layout Components:**
- [ ] `Card` - Container with header, content, footer
- [ ] `Sheet` - Side panel drawer
- [ ] `Dialog` - Modal dialogs
- [ ] `Tabs` - Tab navigation
- [ ] `Separator` - Visual dividers
- [ ] `Badge` - Status badges, tags
- [ ] `Skeleton` - Loading placeholders

**Data Display:**
- [ ] `Table` - Data tables with sorting/pagination
- [ ] `Avatar` - User avatars
- [ ] `Alert` - Success, error, warning, info messages
- [ ] `Tooltip` - Hover tooltips
- [ ] `Popover` - Popover menus

**Navigation:**
- [ ] `Sidebar` - Refactored from existing Sidebar.tsx
- [ ] `Breadcrumb` - Breadcrumb navigation

**Composite Microcomponents (Built from base components):**
- [ ] `FormField` - Input + Label + Error message wrapper
- [ ] `SelectField` - Select + Label + Error wrapper
- [ ] `CardHeader` - Card header with title + actions
- [ ] `DataTable` - Table with search, filter, pagination
- [ ] `StatusBadge` - Status badge with variants
- [ ] `LoadingSpinner` - Loading indicator
- [ ] `EmptyState` - Empty state placeholder

**Total:** ~25 microcomponents

---

## 🔧 Phase 2: Services Layer (API Client)

### 2.1 Create Service Base (`app/lib/services/base.ts`)
- [ ] `ApiService` base class with:
  - Generic CRUD methods (get, post, put, delete)
  - Error handling
  - Request/response interceptors
  - Type-safe responses

### 2.2 Create Domain Services (`app/lib/services/`)

**Entity Services:**
- [ ] `channelService.ts` - Channel CRUD operations
- [ ] `memberService.ts` - Member CRUD operations
- [ ] `teamService.ts` - Team CRUD operations
- [ ] `locationService.ts` - Location CRUD operations
- [ ] `eventService.ts` - Event CRUD operations
- [ ] `noteService.ts` - Note CRUD operations
- [ ] `todoService.ts` - Todo CRUD operations
- [ ] `messageService.ts` - Message operations

**Utility Services:**
- [ ] `connectionService.ts` - Connection management
- [ ] `authService.ts` - Authentication (extends existing useAuth)

**Service Interface Example:**
```typescript
// app/lib/services/channelService.ts
export const channelService = {
  getAll: (filters?: ChannelFilters): Promise<Channel[]>
  getById: (id: string): Promise<Channel>
  create: (data: CreateChannelDto): Promise<Channel>
  update: (id: string, data: UpdateChannelDto): Promise<Channel>
  delete: (id: string): Promise<void>
}
```

---

## 🎯 Phase 3: ViewModels (Custom Hooks)

### 3.1 Create ViewModel Base (`app/lib/viewmodels/base.ts`)
- [ ] `useViewModel` base hook pattern
- [ ] Common state management utilities
- [ ] Error handling utilities

### 3.2 Create Domain ViewModels (`app/lib/viewmodels/`)

**Entity ViewModels:**
- [ ] `useChannelViewModel.ts` - Channel list/form state + operations
- [ ] `useMemberViewModel.ts` - Member list/form state + operations
- [ ] `useTeamViewModel.ts` - Team list/form state + operations
- [ ] `useLocationViewModel.ts` - Location list/form state + operations
- [ ] `useEventViewModel.ts` - Event list/form state + operations
- [ ] `useNoteViewModel.ts` - Note list/form state + operations
- [ ] `useTodoViewModel.ts` - Todo list/form state + operations

**ViewModel Interface Example:**
```typescript
// app/lib/viewmodels/useChannelViewModel.ts
export function useChannelViewModel() {
  return {
    // State
    channels: Channel[]
    loading: boolean
    error: string | null
    
    // Actions
    loadChannels: () => Promise<void>
    createChannel: (data: CreateChannelDto) => Promise<void>
    updateChannel: (id: string, data: UpdateChannelDto) => Promise<void>
    deleteChannel: (id: string) => Promise<void>
    
    // Form state (if needed)
    formData: ChannelFormData
    setFormData: (data: Partial<ChannelFormData>) => void
    resetForm: () => void
  }
}
```

---

## 🎨 Phase 4: Refactor Components to MVVM

### 4.1 Refactor Form Components

**Current → New Structure:**
- [ ] `ChannelForm.tsx` → Uses `useChannelViewModel` + microcomponents
- [ ] `EventForm.tsx` → Uses `useEventViewModel` + microcomponents
- [ ] `NoteForm.tsx` → Uses `useNoteViewModel` + microcomponents
- [ ] `MemberList.tsx` (form part) → Uses `useMemberViewModel` + microcomponents

**Pattern:**
```typescript
// Before: Mixed UI + logic
export default function ChannelForm() {
  const [formData, setFormData] = useState(...)
  const handleSubmit = async () => { /* fetch directly */ }
  return <form>...</form>
}

// After: Pure View + ViewModel
export default function ChannelForm({ channel, onSave, onCancel }) {
  const viewModel = useChannelViewModel(channel)
  return <ChannelFormView viewModel={viewModel} onSave={onSave} onCancel={onCancel} />
}
```

### 4.2 Refactor List Components

- [ ] `ChannelList.tsx` → Uses `useChannelViewModel` + microcomponents
- [ ] `EventList.tsx` → Uses `useEventViewModel` + microcomponents
- [ ] `NoteList.tsx` → Uses `useNoteViewModel` + microcomponents
- [ ] `MemberList.tsx` → Uses `useMemberViewModel` + microcomponents
- [ ] `TeamList.tsx` → Uses `useTeamViewModel` + microcomponents
- [ ] `LocationList.tsx` → Uses `useLocationViewModel` + microcomponents

### 4.3 Refactor Detail Components

- [ ] `NoteDetailPage.tsx` → Uses `useNoteViewModel` + microcomponents
- [ ] `ConnectionSheet.tsx` → Uses microcomponents
- [ ] `ConnectionsDisplay.tsx` → Uses microcomponents

### 4.4 Refactor Utility Components

- [ ] `Sidebar.tsx` → Uses microcomponents (Button, navigation)
- [ ] `MemberSelect.tsx` → Uses Select microcomponent
- [ ] `MessageInput.tsx` → Uses Input + Button microcomponents

---

## 📄 Phase 5: Update Pages

### 5.1 Refactor Page Components

All pages in `app/**/page.tsx` will:
- [ ] Use refactored components (already using MVVM)
- [ ] Ensure SSR compatibility (Server Components where possible)
- [ ] Use Suspense boundaries for async data

**Pages to Update:**
- [ ] `app/page.tsx`
- [ ] `app/channels/page.tsx`
- [ ] `app/channels/[id]/page.tsx`
- [ ] `app/events/page.tsx`
- [ ] `app/notes/page.tsx`
- [ ] `app/notes/[slug]/page.tsx`
- [ ] `app/members/page.tsx`
- [ ] `app/members/[id]/page.tsx`
- [ ] `app/teams/[id]/page.tsx`
- [ ] `app/locations/[id]/page.tsx`
- [ ] `app/todos/page.tsx`
- [ ] `app/decisions/page.tsx`
- [ ] `app/organization/page.tsx`
- [ ] `app/(authenticated)/dashboard/**/page.tsx` (6 pages)

---

## 📝 Phase 6: Types & Validation

### 6.1 Create Type Definitions (`app/lib/types/`)

- [ ] `channel.types.ts` - Channel DTOs, filters, form data
- [ ] `member.types.ts` - Member DTOs, filters, form data
- [ ] `team.types.ts` - Team DTOs, filters, form data
- [ ] `location.types.ts` - Location DTOs, filters, form data
- [ ] `event.types.ts` - Event DTOs, filters, form data
- [ ] `note.types.ts` - Note DTOs, filters, form data
- [ ] `todo.types.ts` - Todo DTOs, filters, form data

### 6.2 Create Zod Schemas (`app/lib/schemas/`)

- [ ] `channel.schema.ts` - Channel validation schemas
- [ ] `member.schema.ts` - Member validation schemas
- [ ] `team.schema.ts` - Team validation schemas
- [ ] `location.schema.ts` - Location validation schemas
- [ ] `event.schema.ts` - Event validation schemas
- [ ] `note.schema.ts` - Note validation schemas
- [ ] `todo.schema.ts` - Todo validation schemas

---

## 🔄 Migration Strategy

### Step-by-Step Approach

1. **Phase 1 First** - Setup microcomponents (no breaking changes)
2. **Phase 2 + 3** - Create services + viewmodels (parallel, no breaking changes)
3. **Phase 4** - Refactor components one by one:
   - Start with simplest: `Sidebar.tsx`
   - Then forms: `ChannelForm.tsx` → `EventForm.tsx` → `NoteForm.tsx`
   - Then lists: `ChannelList.tsx` → `EventList.tsx` → etc.
4. **Phase 5** - Update pages (should work automatically)
5. **Phase 6** - Add types/schemas (ongoing, can be done in parallel)

### Backward Compatibility

- ✅ Keep existing API routes unchanged
- ✅ Migrate components one at a time
- ✅ Test each component after migration
- ✅ No breaking changes to external interfaces

---

## 📊 File Structure After Migration

```
app/
├── components/
│   ├── ui/                          # NEW: Microcomponents
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── card.tsx
│   │   ├── ... (25 microcomponents)
│   │
│   ├── ChannelForm.tsx               # REFACTORED: Uses ViewModel + microcomponents
│   ├── ChannelList.tsx              # REFACTORED: Uses ViewModel + microcomponents
│   ├── EventForm.tsx                # REFACTORED
│   ├── EventList.tsx                # REFACTORED
│   ├── NoteForm.tsx                 # REFACTORED
│   ├── NoteList.tsx                 # REFACTORED
│   ├── MemberList.tsx               # REFACTORED
│   ├── TeamList.tsx                 # REFACTORED
│   ├── LocationList.tsx             # REFACTORED
│   ├── Sidebar.tsx                  # REFACTORED: Uses microcomponents
│   └── ... (all components refactored)
│
├── lib/
│   ├── services/                    # NEW: API Client Layer
│   │   ├── base.ts
│   │   ├── channelService.ts
│   │   ├── memberService.ts
│   │   ├── teamService.ts
│   │   ├── locationService.ts
│   │   ├── eventService.ts
│   │   ├── noteService.ts
│   │   ├── todoService.ts
│   │   ├── messageService.ts
│   │   ├── connectionService.ts
│   │   └── authService.ts
│   │
│   ├── viewmodels/                   # NEW: ViewModel Layer
│   │   ├── base.ts
│   │   ├── useChannelViewModel.ts
│   │   ├── useMemberViewModel.ts
│   │   ├── useTeamViewModel.ts
│   │   ├── useLocationViewModel.ts
│   │   ├── useEventViewModel.ts
│   │   ├── useNoteViewModel.ts
│   │   └── useTodoViewModel.ts
│   │
│   ├── types/                        # ENHANCED: Add domain types
│   │   ├── channel.types.ts
│   │   ├── member.types.ts
│   │   ├── team.types.ts
│   │   ├── location.types.ts
│   │   ├── event.types.ts
│   │   ├── note.types.ts
│   │   ├── todo.types.ts
│   │   ├── connections.ts           # EXISTING
│   │   └── errors.ts                 # EXISTING
│   │
│   ├── schemas/                      # NEW: Zod validation
│   │   ├── channel.schema.ts
│   │   ├── member.schema.ts
│   │   ├── team.schema.ts
│   │   ├── location.schema.ts
│   │   ├── event.schema.ts
│   │   ├── note.schema.ts
│   │   └── todo.schema.ts
│   │
│   ├── hooks/                        # EXISTING: Keep useAuth, add ViewModels
│   │   ├── useAuth.ts                # EXISTING
│   │   └── useTestHook.ts            # EXISTING
│   │
│   └── ... (other existing lib files)
│
├── api/                              # UNCHANGED: Keep existing API routes
│   └── ...
│
└── ... (pages, models unchanged)
```

---

## ✅ Success Criteria

### Functional
- [ ] All existing features work identically
- [ ] No regressions in functionality
- [ ] All forms validate correctly
- [ ] All lists display and filter correctly

### Code Quality
- [ ] All components use microcomponents (no raw HTML/Tailwind)
- [ ] All components use ViewModels (no direct API calls)
- [ ] All business logic in ViewModels/Services (none in Views)
- [ ] TypeScript strict mode passes
- [ ] No `any` types (except where justified)
- [ ] SSR compatible (Server Components where possible)

### Reusability
- [ ] Microcomponents can be used anywhere
- [ ] ViewModels can be reused across components
- [ ] Services are testable and mockable
- [ ] Consistent patterns across all components

### Performance
- [ ] No performance regressions
- [ ] Proper use of Suspense boundaries
- [ ] Efficient re-renders (React.memo where needed)
- [ ] Proper loading states

---

## 🚨 Risks & Mitigations

### Risk 1: Breaking Changes
**Mitigation:** Migrate one component at a time, test thoroughly

### Risk 2: Large Refactor Scope
**Mitigation:** Phased approach, can pause/resume between phases

### Risk 3: Type Safety Issues
**Mitigation:** Use Zod schemas, strict TypeScript, comprehensive types

### Risk 4: Performance Impact
**Mitigation:** Profile before/after, use React DevTools, optimize ViewModels

---

## 📅 Estimated Scope

**Files to Create:** ~60 files
- 25 microcomponents
- 10 services
- 7 viewmodels
- 7 type files
- 7 schema files
- 4 base/utility files

**Files to Refactor:** ~30 files
- 15 component files
- 15 page files

**Total Effort:** Large refactor, but systematic and incremental

---

## 🎯 Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Approve Phase 1** - Start with microcomponents setup
3. **Execute incrementally** - One phase at a time with approval
4. **Test continuously** - Verify after each component migration

---

**Ready to proceed?** This plan ensures:
- ✅ No breaking changes during migration
- ✅ Incremental, testable progress
- ✅ Full MVVM architecture
- ✅ Reusable microcomponents throughout
- ✅ Type-safe, SSR-compatible code
- ✅ Follows agent-rules (token efficiency, metadata headers, etc.)
