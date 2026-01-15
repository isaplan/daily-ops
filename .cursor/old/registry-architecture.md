# Registry V2.0 Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Function Registry                   │
│                         (function-registry.json)                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ METADATA: counts, version, timestamp                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ INDEX (4 Query Strategies - All O(1))                  │  │
│  │                                                          │  │
│  │  byName ─────────→ { "useAuth" → "useAuth-composable" }│  │
│  │  byFile ─────────→ { "composables/useAuth.ts" → ... }  │  │
│  │  byType ─────────→ { composable: [...], component: [...] } │
│  │  byLastSeen ──→ ["account-info-page", "index-page", ...]  │
│  │                   (sorted: newest first)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ FUNCTIONS ARRAY (62 entries, sorted by last_seen_ms)   │  │
│  │                                                          │  │
│  │ [                                                        │  │
│  │   { id: "useAuth-composable",                          │  │
│  │     name: "useAuth",                                   │  │
│  │     file: "composables/useAuth.ts",                    │  │
│  │     type: "composable",                                │  │
│  │     last_seen_ms: 1766015524902,                       │  │
│  │     size: 3029, lines: 124, ... },                    │  │
│  │   { ... }, { ... }                                     │  │
│  │ ]                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Generation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│ Event: Developer commits code                               │
│ $ git commit -m "feat: update composables"                  │
└──────────────────────────────────────────┬──────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Husky Pre-Commit Hook Triggered                             │
│ .husky/pre-commit                                           │
└──────────────────────────────────────────┬──────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────┐
│ npm run registry:generate                                   │
│ (Runs: tsx scripts/generate-registry.ts)                    │
└──────────────────────────────────────────┬──────────────────┘
                                          │
                      ┌───────────────────┼───────────────────┐
                      │                   │                   │
                      ▼                   ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐ ┌──────────────────┐
        │ Scan composables/│  │ Scan components/ │ │ Scan server/     │
        │ Find: 7 files    │  │ Find: 14 files   │ │ Find: 27 files   │
        └────────┬─────────┘  └────────┬─────────┘ └────────┬─────────┘
                 │                     │                    │
                 └─────────────────────┼────────────────────┘
                                       │
                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │ For Each File:                                       │
        │ • Read content                                       │
        │ • Calculate MD5 checksum                             │
        │ • Count lines                                        │
        │ • Determine type (composable/component/etc)         │
        │ • Generate ID: {name}-{type}                        │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │ Merge with Existing Registry                         │
        │ • Preserve detection_at timestamps                   │
        │ • Update last_seen/last_seen_ms                      │
        │ • Set last_updated for modified files                │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │ Check for Duplicates                                 │
        │ (IDs that appear > 1 time)                          │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │ Build 4 Indices:                                     │
        │ • byName: { "useAuth" → "useAuth-composable" }      │
        │ • byFile: { path → id }                             │
        │ • byType: { type → [ids...] }                       │
        │ • byLastSeen: [ids...] sorted desc by timestamp     │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │ Calculate Statistics                                 │
        │ • totalByType: { composable: 7, ... }               │
        │ • totalFiles: 62                                    │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │ Write function-registry.json                         │
        │ • Format: JSON with 2-space indentation              │
        │ • Size: ~1.2 MB                                      │
        │ • Pretty-printed for git diffs                       │
        └────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │ git add function-        │
                    │ registry.json            │
                    └──────────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │ Continue with npm run    │
                    │ lint                     │
                    └──────────────┬───────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │ Commit Created ✅        │
                    │ Registry Up-to-Date ✅   │
                    └──────────────────────────┘
```

---

## Query Architecture (O(1) Lookups)

```
Registry Loaded in Memory
│
├─ index.byName (Hash Map)
│  │
│  ├─ "useAuth" ──→ "useAuth-composable"
│  ├─ "CitySelector" ──→ "CitySelector-component"
│  └─ ... (instant O(1) lookup)
│
├─ index.byFile (Hash Map)
│  │
│  ├─ "composables/useAuth.ts" ──→ "useAuth-composable"
│  ├─ "components/CitySelector.vue" ──→ "CitySelector-component"
│  └─ ... (instant O(1) lookup)
│
├─ index.byType (Hash of Arrays)
│  │
│  ├─ composable: ["useAuth-composable", "useFoursquare-composable", ...]
│  ├─ component: ["CitySelector-component", "ToastContainer-component", ...]
│  ├─ api-route: [...]
│  ├─ service: [...]
│  └─ page: [...]
│
├─ index.byLastSeen (Pre-sorted Array)
│  │
│  ├─ 1st (most recent): "account-info-page"
│  ├─ 2nd: "index-service"
│  ├─ 3rd: "useToast-composable"
│  └─ ... (already sorted, just slice)
│
└─ functions (Full entries array)
   │
   ├─ id: "useAuth-composable"
   ├─ name: "useAuth"
   ├─ file: "composables/useAuth.ts"
   ├─ type: "composable"
   ├─ size: 3029
   ├─ lines: 124
   ├─ checksum: "be0e716d63ee07cd"
   ├─ last_seen_ms: 1766015524902
   └─ ... (more metadata)
```

---

## Usage Flows

### Flow 1: Find and Edit a Function

```
┌──────────────────────────────────────┐
│ User: "Edit the useAuth composable"  │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ AI looks up:                         │
│ registry.index.byName["useAuth"]     │
└──────────────────┬───────────────────┘
                   │
                   ▼ (O(1) instant)
         ┌────────────────────┐
         │ "useAuth-          │
         │ composable"        │
         └────────────┬───────┘
                      │
                      ▼
┌──────────────────────────────────────┐
│ Find entry:                          │
│ registry.functions.find(              │
│   f => f.id === "useAuth-composable" │
│ )                                    │
└──────────────────┬───────────────────┘
                   │
                   ▼
         ┌─────────────────────────────┐
         │ { id, name, file,          │
         │   type, size, lines, ... }  │
         │                            │
         │ file: "composables/        │
         │       useAuth.ts"           │
         └─────────────┬──────────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │ AI reads:                    │
         │ read_file("composables/      │
         │ useAuth.ts")                 │
         └─────────────┬────────────────┘
                       │
                       ▼
         ┌──────────────────────────────┐
         │ AI edits & makes changes     │
         └──────────────────────────────┘
```

### Flow 2: List All Recent Functions

```
┌──────────────────────────────────────┐
│ User: "What was recently edited?"    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ AI looks up:                         │
│ registry.index.byLastSeen.slice(0, 5)│
│                                      │
│ (Already sorted, newest first)       │
└──────────────────┬───────────────────┘
                   │
                   ▼ (O(5))
         ┌────────────────────┐
         │ [                  │
         │   "account-info-   │
         │   page",           │
         │   "index-service", │
         │   "useToast-comp...",
         │   ...              │
         │ ]                  │
         └────────────┬───────┘
                      │
                      ▼
┌──────────────────────────────────────┐
│ AI maps to full entries:             │
│ ids.map(id =>                        │
│   registry.functions.find(           │
│     f => f.id === id                 │
│   )                                  │
│ )                                    │
└──────────────────┬───────────────────┘
                   │
                   ▼
         ┌────────────────────────┐
         │ [                      │
         │   { name: "account-   │
         │     info",            │
         │     file: "pages/...",│
         │     last_seen_ms: ... │
         │   },                  │
         │   ...                 │
         │ ]                      │
         └────────────────────────┘
```

### Flow 3: Find All of a Type

```
┌──────────────────────────────────────┐
│ User: "List all API routes"          │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│ AI looks up:                         │
│ registry.index.byType["api-route"]   │
└──────────────────┬───────────────────┘
                   │
                   ▼ (O(1))
         ┌────────────────────────┐
         │ [                      │
         │   "create.post-        │
         │   api-route",          │
         │   "login.post-         │
         │   api-route",          │
         │   "onboarding.post-    │
         │   api-route",          │
         │   ...                  │
         │ ]  (14 IDs)            │
         └────────────┬───────────┘
                      │
                      ▼
┌──────────────────────────────────────┐
│ AI maps to files:                    │
│ ids.map(id =>                        │
│   registry.functions.find(           │
         f => f.id === id              │
   ).file                              │
│ )                                    │
└──────────────────┬───────────────────┘
                   │
                   ▼
         ┌────────────────────────┐
         │ [                      │
         │   "server/api/artist...",
         │   "server/api/auth/...",
         │   "server/api/band/...",
         │   ...                  │
         │ ]                      │
         └────────────────────────┘
```

---

## Data Structures

### FunctionEntry
```typescript
{
  id: "useAuth-composable",           // Unique ID
  name: "useAuth",                    // Function name
  type: "composable",                 // Function type
  file: "composables/useAuth.ts",     // Relative path
  status: "active",
  touch_again: true,
  description: "Auto-detected composable",
  auto_detected: true,
  detected_at: "2025-12-17T23:52:04.901Z",  // First seen
  last_seen: "2025-12-17T23:52:04.901Z",    // Last updated
  last_seen_ms: 1766015524902,              // For sorting
  size: 3029,                         // Bytes
  lines: 124,                         // Line count
  checksum: "be0e716d63ee07cd"       // MD5 for change detection
}
```

### Registry Indices (Lookups)
```typescript
index: {
  byName: { [functionName: string]: functionId },
  byFile: { [filePath: string]: functionId },
  byType: {
    composable: string[],
    component: string[],
    'api-route': string[],
    service: string[],
    page: string[]
  },
  byLastSeen: string[]  // sorted newest first
}
```

---

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| Find by name | O(1) | Hash table lookup |
| Find by file | O(1) | Hash table lookup |
| Get all of type | O(1) | Pre-computed array |
| Get N recent | O(n) | Already sorted array |
| Search substring | O(m) | m = total functions |
| Register generation | <100ms | Scans 62 files |
| Registry load | <10ms | JSON parse |

---

## File Organization

```
project-root/
├── function-registry.json ..................... Generated registry
├── scripts/
│   └── generate-registry.ts ................... Generator script
├── lib/
│   └── registry-query.ts ...................... Query utility
├── types/
│   └── registry.ts ............................ TypeScript types
├── .husky/
│   └── pre-commit ............................. Auto-generation hook
├── .cursor/
│   ├── registry-ai-guide.md ................... AI quick reference
│   └── registry-architecture.md ............... This file
├── REGISTRY-ENHANCED.md ....................... Full documentation
└── REGISTRY-V2-IMPLEMENTATION.md ............ Implementation summary
```

---

## Key Insights

1. **All lookups O(1)** - Hash tables for instant discovery
2. **Pre-sorted by time** - No sorting needed for recency
3. **Auto-generated** - No manual maintenance required
4. **Zero duplicates** - Unique IDs prevent conflicts
5. **AI-optimized** - Structure designed for LLM context
6. **Fast generation** - <100ms to scan and index
7. **Git-integrated** - Auto-stages on every commit



