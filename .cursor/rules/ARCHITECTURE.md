---
alwaysApply: false
---

# System Architecture: Metadata + Registry Integration

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│              DAILY OPS: Next.js 15 + Socket.io                  │
│                    Member-Centric Operations                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌───────────────────────────────────────────┐
        │   3-Layer Dependency Tracking System      │
        └───────────────────────────────────────────┘
                   ↓           ↓           ↓
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │    LAYER 1   │ │    LAYER 2   │ │    LAYER 3   │
        │     CODE     │ │ VALIDATION   │ │   REGISTRY   │
        ├──────────────┤ ├──────────────┤ ├──────────────┤
        │ Metadata     │ │ Pre-commit   │ │ Auto-indexed │
        │ headers +    │ │ validation   │ │ function    │
        │ exports-to   │ │ script       │ │ database    │
        │ links        │ │              │ │              │
        └──────────────┘ └──────────────┘ └──────────────┘
             ↓                  ↓                  ↓
        Write code         Run git commit    Always in sync
        with headers       Pre-commit fires   with headers
```

---

## Layer 1: Code + Metadata Headers

**Location:** Critical files throughout the project

**Files:**
- `app/lib/hooks/useAuth.ts`
- `app/lib/services/memberService.ts`
- `app/lib/types/member.ts`
- `app/api/members/route.ts`
- Any complex component (>150 lines)

**Example:**
```typescript
/**
 * @registry-id: useAuth
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Auth state, login/logout, token management
 * @last-fix: [2026-01-15] Fixed session timeout race condition
 * 
 * @exports-to:
 *   ✓ app/middleware.ts => useAuth() for protected routes
 *   ✓ app/components/Navbar.tsx => useAuth() for user display
 *   ✓ app/components/LoginForm.tsx => useAuth() for login
 * 
 * @imports-from:
 *   - app/lib/types/auth.ts => AuthUser, LoginCredentials
 *   - app/api/auth/route.ts (POST login endpoint)
 */

export function useAuth() {
  // Implementation...
}
```

**Metadata Fields:**
- `@registry-id` - Unique identifier (matches function-registry)
- `@created` - ISO timestamp when created
- `@last-modified` - ISO timestamp of last change (updated on commit)
- `@description` - 1-2 line summary
- `@last-fix` - `[YYYY-MM-DD] what was fixed` (updated on commit)
- `@exports-to` - List of files that use this code
- `@imports-from` - List of dependencies this uses

**What this solves:**
- ✅ Self-documenting code
- ✅ Visible dependency graph (no grepping needed)
- ✅ Change history in code itself
- ✅ Forces complete updates (see all dependents)

---

## Layer 2: Validation on Commit

**Location:** `scripts/validate-metadata.ts` + `.husky/pre-commit`

**When it runs:**
```bash
git add files
git commit -m "message"
    ↓
Pre-commit hook triggers
    ↓
validate-metadata.ts runs
    ↓
Checks all critical files
```

**What it validates:**
1. **Parse headers** - Extract `@registry-id`, `@exports-to`, etc.
2. **Validate exports exist** - All files in `@exports-to` actually exist
3. **Check timestamps** - `@last-modified` is valid ISO format
4. **Verify IDs** - No duplicate `@registry-id` values
5. **Detect broken links** - File listed in exports-to but deleted? Catch it!

**Example validation output:**
```
🔍 Validating metadata headers...
✅ app/lib/hooks/useAuth.ts → useAuth
✅ app/lib/services/memberService.ts → memberService
❌ BROKEN: app/lib/types/member.ts exports-to app/api/members/DELETED.ts

Commit failed. Fix dependencies and try again.
```

**What this solves:**
- ✅ Prevents broken exports-to references
- ✅ Catches deleted files still listed as dependencies
- ✅ Validates timestamps are correct
- ✅ Stops orphaned code at source
- ✅ Forces developer to update dependents before committing

---

## Layer 3: Function Registry (Auto-Generated)

**Location:** `function-registry.json` (auto-generated on every commit)

**Structure:**
```json
{
  "metadata": {
    "totalByType": {
      "hook": 7,
      "service": 13,
      "api-route": 14,
      "type": 8
    }
  },
  "index": {
    "byName": {
      "useAuth": "useAuth-hook",
      "memberService": "memberService-service"
    },
    "byFile": {
      "app/lib/hooks/useAuth.ts": "useAuth-hook"
    },
    "byType": {
      "hook": ["useAuth-hook", "useSocket-hook", ...],
      "service": ["memberService-service", ...],
      "api-route": [...]
    },
    "byLastSeen": ["useAuth-hook", "memberService-service", ...] // Sorted by timestamp
  },
  "functions": [
    {
      "id": "useAuth-hook",
      "name": "useAuth",
      "type": "hook",
      "file": "app/lib/hooks/useAuth.ts",
      "last_seen": "2026-01-15T10:00:00.000Z",
      "last_seen_ms": 1766015524902,
      "size": 2849,
      "lines": 98,
      "checksum": "abc123def456",
      "dependencies": ["useAuth"], // From metadata
      "exports_to": ["app/middleware.ts", "app/components/Navbar.tsx"], // From metadata
      "last_sync": "2026-01-15T10:05:00.000Z" // When this was synced
    }
  ]
}
```

**Indices (O(1) lookups):**
- `byName` - Find by function name (instant)
- `byFile` - Find by file path (instant)
- `byType` - Find all of a type (instant)
- `byLastSeen` - Most recent edits (pre-sorted)

**What this solves:**
- ✅ AI agents can do instant lookups without loading full file
- ✅ Always up-to-date (regenerated on every commit)
- ✅ Tracks dependency graph (from metadata)
- ✅ Knows which code was touched recently
- ✅ Single source of truth for project structure

---

## Data Flow: Complete Lifecycle

### Scenario 1: Create New Hook with Metadata

```
1. Developer creates: app/lib/hooks/useMembers.ts
   
2. Adds metadata header:
   @registry-id: useMembers
   @exports-to: app/components/MemberList.tsx

3. Git commit
   
4. Pre-commit hook fires:
   ├─ validate-metadata.ts parses header
   ├─ Checks: app/components/MemberList.tsx exists ✓
   ├─ Updates @last-modified timestamp
   └─ Validation passes ✓

5. Hook then:
   ├─ generate-registry.ts scans app/lib/hooks/
   ├─ Finds useMembers.ts
   ├─ Reads metadata header
   ├─ Adds to function-registry.json:
   │   {
   │     "id": "useMembers-hook",
   │     "exports_to": ["app/components/MemberList.tsx"],
   │     ...
   │   }
   └─ Stages registry update

6. Commit succeeds ✓
   function-registry.json includes new hook
```

### Scenario 2: Modify Hook, Forget to Update Dependents

```
1. Developer modifies: app/lib/hooks/useAuth.ts
   Changes function signature: useAuth() → useAuth(options)

2. Updates metadata @last-modified
   BUT forgets about: app/middleware.ts (in @exports-to)
   
3. Git commit
   
4. Pre-commit hook fires:
   ├─ validate-metadata.ts parses header
   ├─ Sees @exports-to: app/middleware.ts
   ├─ Checks if file exists: YES ✓
   └─ Validation passes ✓
   
5. generate-registry.ts runs
   ├─ Updates registry with new metadata
   └─ Stages registry update

6. Commit succeeds ✓
   BUT: app/middleware.ts still uses old signature!
   
⚠️  THIS IS A GAP:
    Registry validates files exist, but not that imports match

Future enhancement: validate imports/exports signatures match
```

### Scenario 3: Delete File Properly (With Metadata)

```
1. Developer wants to delete: app/lib/hooks/useLegacy.ts
   
2. Checks metadata header:
   @exports-to: app/pages/dashboard.tsx
   
3. Must now:
   ├─ Remove import from app/pages/dashboard.tsx
   ├─ Update that file's metadata
   ├─ Commit both changes together
   └─ Then delete useLegacy.ts

4. Pre-commit validation:
   ├─ Checks exports-to in useLegacy.ts
   ├─ If dashboard.tsx no longer imports it: ✓
   └─ Can proceed

5. Commit succeeds ✓
   Registry removes old hook entry
```

---

## Token Efficiency Strategy

### Problem
- Full `function-registry.json` = 15,000+ tokens
- Too expensive to load every interaction
- Wastes tokens on data not needed

### Solution: 3-Part Strategy

1. **Agent rules (126 lines)** - Lean & mean
   - Fits in context always
   - Points to grep for lookups
   - References detailed docs instead of duplicating

2. **Grep-based lookups** - O(1) in terms of tokens
   ```bash
   # ~100 tokens vs 15,000 tokens
   grep '"file": "app/lib/hooks/useAuth"' function-registry.json
   ```

3. **Metadata in code** - Always visible, no extra load
   - Read file header (1-2KB)
   - Dependency graph visible
   - No registry lookup needed

### Result
- **Per interaction:** ~100-200 tokens vs 15,000
- **Cost:** Massive savings (~98% reduction)
- **Quality:** Better context (metadata shows why, registry shows what)

---

## Key Principles

### 1. **Metadata is the source of truth for dependencies**
- Kept in code itself (always available)
- Human-readable (developers read it)
- Validated automatically (pre-commit checks it)

### 2. **Registry is the source of truth for current state**
- Auto-generated (never manual)
- Always in sync (regenerated on every commit)
- Indexed for O(1) lookups (instant)

### 3. **Pre-commit validation ensures consistency**
- Headers stay valid (exports-to files exist)
- Timestamps are current (last-modified is today)
- Dependencies are tracked (nothing orphaned)

### 4. **Small commits = easy tracking**
- Each commit updates related files
- Clear history in git log
- Registry reflects each change

---

## Files in This System

| File | Purpose | Maintained By | Updates |
|------|---------|---|---|
| `.cursor/rules/agent-rules.mdc` | AI agent rules | Developer (manual) | Per project change |
| `.cursor/rules/METADATA-SYNC-GUIDE.md` | Metadata how-to | Developer (manual) | Per project change |
| `scripts/validate-metadata.ts` | Pre-commit validation | Developer (manual) | Per feature |
| `.husky/pre-commit` | Git hook | Developer (manual) | Per commit |
| `function-registry.json` | Current state registry | **Automatic** | Every commit |
| Metadata headers in code | Dependency graph | Developer (manual) | When file changes |

---

## Maintenance & Scaling

### Adding a New Critical File

1. Create file with code
2. Add metadata header with `@registry-id`, `@exports-to`
3. Commit
4. Pre-commit validation checks it
5. Registry auto-includes it

### Modifying Existing File

1. Update code
2. Update `@last-modified` to ISO timestamp (now)
3. Update `@last-fix` with what changed
4. If exports changed, update `@exports-to`
5. Commit
6. Pre-commit validates
7. Registry updates automatically

### Deleting a File

1. Check metadata header
2. See `@exports-to` - which files depend on this?
3. Remove imports from those files
4. Update their metadata
5. Delete original file
6. Commit all changes together
7. Pre-commit validates no broken exports

---

## Success Metrics

You'll know this is working when:

- ✅ **Pre-commit runs silently** - No errors, metadata is valid
- ✅ **Metadata timestamps update** - @last-modified changes on commits
- ✅ **Registry grows** - New entries appear on new code
- ✅ **Agents follow rules** - AI mentions metadata before modifying code
- ✅ **No orphaned code** - Can't commit broken exports
- ✅ **Token efficiency** - Agent uses grep instead of loading full registry

---

## Next: Implementation Steps

1. ✅ Read `.cursor/rules/agent-rules.mdc` (your daily guide)
2. ✅ Read `.cursor/rules/METADATA-SYNC-GUIDE.md` (how to use)
3. [ ] Add metadata headers to critical files
4. [ ] Make a test commit to see validation
5. [ ] Check `function-registry.json` for your new entries
6. [ ] Start using metadata headers on all changes

---

**This system is ready to use. Start by adding metadata headers to your critical files.**
