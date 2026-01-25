# Eitje Collection Renaming - Code Impact Overview

## Collections to Rename (with `eitje_` prefix)

1. `time_registration_aggregation` → `eitje_time_registration_aggregation`
2. `planning_registration_aggregation` → `eitje_planning_registration_aggregation`
3. `team_aggregation` → `eitje_team_aggregation`
4. `location_aggregation` → `eitje_location_aggregation`
5. `user_aggregation` → `eitje_user_aggregation`
6. `event_aggregation` → `eitje_event_aggregation`
7. `aggregation_lock` → `eitje_aggregation_lock`

## Collections to KEEP AS-IS (no prefix)

- `unified_location` ✅ (covers all sources, renamed from location_unified)
- `unified_team` ✅ (covers all sources, renamed from team_unified)
- `unified_user` ✅ (covers all sources, renamed from user_unified)
- `eitje_raw_data` ✅ (already has prefix)

---

## Files That Will Be Modified

### 1. `app/lib/services/aggregationService.ts`
**File:** `app/lib/services/aggregationService.ts`  
**Function:** `aggregateTimeRegistration()`  
**Line 326:**
```typescript
const bulkResult = await db.collection('time_registration_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_time_registration_aggregation').bulkWrite(operations);
```

**Function:** `aggregatePlanningRegistration()`  
**Line 453:**
```typescript
const bulkResult = await db.collection('planning_registration_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_planning_registration_aggregation').bulkWrite(operations);
```

**Function:** `aggregateByTeam()`  
**Line 583:**
```typescript
const bulkResult = await db.collection('team_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_team_aggregation').bulkWrite(operations);
```

**Function:** `aggregateByLocation()`  
**Line 722:**
```typescript
const bulkResult = await db.collection('location_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_location_aggregation').bulkWrite(operations);
```

**Function:** `aggregateByUser()`  
**Line 867:**
```typescript
const bulkResult = await db.collection('user_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_user_aggregation').bulkWrite(operations);
```

**Function:** `aggregateByEvent()`  
**Line 991:**
```typescript
const bulkResult = await db.collection('event_aggregation').bulkWrite(operations);
```
**Change to:**
```typescript
const bulkResult = await db.collection('eitje_event_aggregation').bulkWrite(operations);
```

---

### 2. `app/api/aggregations/sync/route.ts`
**File:** `app/api/aggregations/sync/route.ts`  
**Function:** `GET()` - Status check endpoint  
**Lines 131-136:**
```typescript
const collections = [
  'time_registration_aggregation',
  'planning_registration_aggregation',
  'team_aggregation',
  'location_aggregation',
  'user_aggregation',
  'event_aggregation',
  'unified_location',  // KEEP AS-IS ✅ (renamed from location_unified)
  'unified_team',      // KEEP AS-IS ✅ (renamed from team_unified)
  'unified_user',      // KEEP AS-IS ✅ (renamed from user_unified)
];
```
**Change to:**
```typescript
const collections = [
  'eitje_time_registration_aggregation',
  'eitje_planning_registration_aggregation',
  'eitje_team_aggregation',
  'eitje_location_aggregation',
  'eitje_user_aggregation',
  'eitje_event_aggregation',
  'unified_location',  // KEEP AS-IS ✅ (renamed from location_unified)
  'unified_team',      // KEEP AS-IS ✅ (renamed from team_unified)
  'unified_user',      // KEEP AS-IS ✅ (renamed from user_unified)
];
```

---

### 3. `app/lib/services/aggregationTrigger.ts`
**File:** `app/lib/services/aggregationTrigger.ts`  
**Function:** `getAggregationLock()`  
**Line 79:**
```typescript
let lock = await db.collection('aggregation_lock').findOne({ _id: 'main' });
```
**Line 87:**
```typescript
await db.collection('aggregation_lock').insertOne(newLock);
```
**Change both to:**
```typescript
let lock = await db.collection('eitje_aggregation_lock').findOne({ _id: 'main' });
await db.collection('eitje_aggregation_lock').insertOne(newLock);
```

**Function:** `acquireAggregationLock()`  
**Line 98:**
```typescript
const result = await db.collection('aggregation_lock').updateOne(
  { _id: 'main', isRunning: false },
  { ... }
);
```
**Change to:**
```typescript
const result = await db.collection('eitje_aggregation_lock').updateOne(
  { _id: 'main', isRunning: false },
  { ... }
);
```

**Function:** `releaseAggregationLock()`  
**Line 132:**
```typescript
await db.collection('aggregation_lock').updateOne(
  { _id: 'main' },
  { $set: update }
);
```
**Change to:**
```typescript
await db.collection('eitje_aggregation_lock').updateOne(
  { _id: 'main' },
  { $set: update }
);
```

---

## Summary

**Total files to modify:** 3 files
**Total collection references to change:** 10 references
  - 6 aggregated collections (1 reference each in aggregationService.ts)
  - 6 aggregated collections (1 reference each in aggregations/sync/route.ts - status check)
  - 1 aggregation_lock collection (4 references in aggregationTrigger.ts)

**Files NOT affected (unified collections stay as-is):**
- `app/lib/services/unifiedCollectionsService.ts` ✅ (updated - uses unified_location, unified_team, unified_user)
- `app/api/hours/route.ts` ✅ (uses unified collections, not aggregated ones)

---

## Migration Notes

After renaming in code, you'll need to:
1. **Option A (Recommended):** Let the aggregation service create new collections with new names on next run, then drop old collections
2. **Option B:** Manually rename collections in MongoDB using `db.collection.renameCollection()`
3. The aggregation service will automatically create new collections if they don't exist
4. Old collections can be safely dropped after verifying new ones work correctly
