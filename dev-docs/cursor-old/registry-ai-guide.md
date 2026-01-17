# AI Registry Quick Reference

## TL;DR: How to Use the Enhanced Registry

The function registry is your **instant lookup system**. When you need to find, edit, or understand any function, composable, component, or service in the project:

### 1. **Find by Name**
```typescript
import registry from '~/function-registry.json'

// Get useAuth composable
const id = registry.index.byName['useAuth']  // → 'useAuth-composable'
const func = registry.functions.find(f => f.id === id)
// Result: { name: 'useAuth', file: 'composables/useAuth.ts', type: 'composable', ... }
```

### 2. **Find by File**
```typescript
const id = registry.index.byFile['composables/useAuth.ts']
// Instantly get the function metadata
```

### 3. **Find All of a Type**
```typescript
// Get all composables
const ids = registry.index.byType.composable
const composables = ids.map(id => registry.functions.find(f => f.id === id))
```

### 4. **Get Most Recent (Already Sorted)**
```typescript
// Most recently used/edited functions, newest first
const recentIds = registry.index.byLastSeen.slice(0, 10)
```

### 5. **Use Query Utility**
```typescript
import { createRegistryQuery } from '~/lib/registry-query'
import registry from '~/function-registry.json'

const query = createRegistryQuery(registry)

query.byName('useAuth')                        // Find by name
query.byFile('composables/useAuth.ts')        // Find by file
query.byType('composable')                    // Get all of type
query.recent(5)                               // Get 5 most recent
query.search('auth')                          // Search substring
query.exists('useFoursquare')                 // Check if exists
query.stats()                                 // Get counts
```

---

## Registry Structure (What You Have Access To)

```json
{
  "metadata": {
    "totalByType": {
      "composable": 7,
      "component": 14,
      "api-route": 14,
      "service": 13,
      "page": 14
    }
  },
  "index": {
    "byName": { "useAuth": "useAuth-composable", ... },
    "byFile": { "composables/useAuth.ts": "useAuth-composable", ... },
    "byType": {
      "composable": ["useAuth-composable", "useFoursquare-composable", ...],
      "component": ["CitySelector-component", ...],
      "api-route": [...],
      "service": [...],
      "page": [...]
    },
    "byLastSeen": ["index-service", "account-info-page", ...]
  },
  "functions": [
    {
      "id": "useAuth-composable",
      "name": "useAuth",
      "type": "composable",
      "file": "composables/useAuth.ts",
      "last_seen": "2025-12-17T23:52:04.901Z",
      "last_seen_ms": 1766015524902,
      "size": 3029,
      "lines": 124,
      "checksum": "be0e716d63ee07cd",
      ...
    }
  ]
}
```

---

## Current Project Stats

| Type | Count |
|------|-------|
| Composables | 7 |
| Components | 14 |
| API Routes | 14 |
| Services | 13 |
| Pages | 14 |
| **Total** | **62** |

**All verified: 0 duplicates** ✅

---

## Common AI Tasks

### Task: "Find all API routes"
```typescript
const apiIds = registry.index.byType['api-route']
const apiRoutes = apiIds.map(id => registry.functions.find(f => f.id === id))
```

### Task: "Check if service exists"
```typescript
const exists = registry.index.byFile['server/services/foursquare.ts'] !== undefined
```

### Task: "Get recently edited pages"
```typescript
const recentPageIds = registry.index.byLastSeen
  .filter(id => registry.functions.find(f => f.id === id)?.type === 'page')
  .slice(0, 5)
```

### Task: "Find all 'use' composables"
```typescript
const query = createRegistryQuery(registry)
const useComposables = query.search('use').filter(f => f.type === 'composable')
```

### Task: "List components with file paths"
```typescript
const componentIds = registry.index.byType.component
const components = componentIds
  .map(id => registry.functions.find(f => f.id === id))
  .map(f => ({ name: f.name, file: f.file }))
```

---

## ID Format

All function IDs follow this pattern:
```
{name}-{type}
```

Examples:
- `useAuth-composable` → useAuth in composables/
- `CitySelector-component` → CitySelector in components/
- `onboarding.post-api-route` → onboarding.post in server/api/
- `foursquare-service` → foursquare in server/services/
- `dashboard-page` → dashboard in pages/

---

## Performance

All lookups are **O(1) constant time**:
- ✅ `byName[key]` → Direct hash lookup
- ✅ `byFile[key]` → Direct hash lookup
- ✅ `byType[key]` → Array (pre-populated)
- ✅ `byLastSeen` → Already sorted (slice is O(n) but for small n)

**No scanning needed, instant results.**

---

## Auto-Update

The registry automatically updates on every commit via pre-commit hook:
1. Run `git commit`
2. Hook runs `npm run registry:generate`
3. Registry scans & indexes all functions
4. Updated `function-registry.json` auto-staged
5. Commit includes latest registry

**No manual updates needed.**

---

## Next Steps

1. ✅ Use `registry.index.byName[...]` for instant lookups
2. ✅ Reference `last_seen_ms` to find recently edited code
3. ✅ Use `byType` to find all functions of a category
4. ✅ Import `createRegistryQuery` for complex queries
5. ✅ Trust that registry is always up-to-date (auto-generated on commit)

---

## Docs

Full documentation: `REGISTRY-ENHANCED.md`
Types: `types/registry.ts`
Query utility: `lib/registry-query.ts`



