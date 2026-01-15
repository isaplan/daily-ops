---
alwaysApply: false
---

# Metadata + Registry Integration: Quick Start

**Purpose:** Metadata headers stay in sync with function-registry on every commit.

---

## What Changed?

| Before | After |
|--------|-------|
| Registry only tracked files | Registry + metadata dependencies synced |
| Manual sync needed | Auto-validated on commit |
| Broken exports-to ignored | Commit fails if exports-to broken |
| No dependency graph | Full dependency tracking |

---

## For Your Code

### 1. Add Metadata Header to Critical Files

**Files that NEED headers:**
- `app/lib/hooks/*.ts` (custom React hooks)
- `app/lib/services/*.ts` (backend logic)
- `app/lib/types/*.ts` (TypeScript types)
- `app/api/**/*.ts` (API routes)
- Complex components (>150 lines)

**Simple Example:**
```typescript
/**
 * @registry-id: useAuth
 * @created: 2026-01-15T10:00:00.000Z
 * @last-modified: 2026-01-15T10:00:00.000Z
 * @description: Authentication state, login/logout/register
 * @last-fix: [2026-01-15] Fixed session timing issue
 * 
 * @exports-to:
 *   ✓ app/middleware.ts => useAuth() for auth checks
 *   ✓ app/components/Navbar.tsx => useAuth() for user info
 * 
 * @imports-from:
 *   - app/lib/types/auth.ts => AuthUser, LoginData
 */

import { AuthUser, LoginData } from '@/lib/types/auth'

export function useAuth() {
  // ... implementation
}
```

### 2. When You Modify Critical Code

**ALWAYS:**
1. Read the metadata header first
2. Update `@last-modified` to NOW (ISO format)
3. Update `@last-fix` with what you fixed
4. If adding/removing exports, update `@exports-to`
5. Commit with message: `fix: [what] in [where]`

**Example of updating @last-fix:**
```typescript
// Before:
// @last-fix: [2026-01-14] Initial implementation

// After:
// @last-fix: [2026-01-15] Fixed session timeout bug
```

### 3. On Commit

The pre-commit hook will:
- ✅ Parse all metadata headers
- ✅ Validate `@exports-to` files exist
- ✅ Check for circular dependencies
- ✅ Sync with function-registry
- ❌ Fail if dependencies broken

**If commit fails:**
```bash
# See what's broken
git status

# Fix the exports-to references
# Then try again
git commit -m "fix: updated exports"
```

---

## Files to Know

| File | Purpose |
|------|---------|
| `.cursor/rules/agent-rules.mdc` | This rules document |
| `scripts/validate-metadata.ts` | Pre-commit validation |
| `.husky/pre-commit` | Hook that runs validation |
| `function-registry.json` | Auto-generated registry |
| `.cursor/rules/metadata-header-system.md` | Full format documentation |

---

## Key Principles

**Auto-Sync = Less Manual Work:**
- You write metadata headers (once per file)
- On commit, validation ensures they're correct
- Registry auto-updates
- No manual sync needed

**Metadata = Dependency Graph:**
- See what depends on what
- Spot circular dependencies
- Update all related files together
- Never orphaned code

**Small Commits = Easy Tracking:**
- Each commit updates related files only
- Clear "why" in commit message
- Pre-commit validates everything
- Easy to revert if needed

---

## Examples

### Example 1: Modify useAuth Hook

```typescript
// File: app/lib/hooks/useAuth.ts

/**
 * @registry-id: useAuth
 * @created: 2026-01-10T00:00:00.000Z
 * @last-modified: 2026-01-15T14:30:00.000Z  // ← Updated NOW
 * @last-fix: [2026-01-15] Fixed session timeout bug in token refresh  // ← New fix
 * 
 * @exports-to:
 *   ✓ app/middleware.ts => useAuth() for route protection
 *   ✓ app/components/Navbar.tsx => useAuth() for user display
 */
```

Then on commit:
```bash
git add app/lib/hooks/useAuth.ts
git commit -m "fix: prevent session timeout in useAuth token refresh"
```

Pre-commit hook validates:
- ✅ @registry-id exists
- ✅ app/middleware.ts exists (in exports-to)
- ✅ app/components/Navbar.tsx exists
- ✅ Timestamps are valid
- ✅ Syncs to function-registry
- ✅ Commit succeeds

### Example 2: Update Type Definition

If you modify `app/lib/types/auth.ts` and add a new field:

```typescript
// File: app/lib/types/auth.ts
/**
 * @last-modified: 2026-01-15T14:30:00.000Z  // ← Updated
 * @last-fix: [2026-01-15] Added oauth.github connection field
 * 
 * @exports-to:
 *   ✓ app/lib/hooks/useAuth.ts => Uses AuthUser type
 *   ✓ app/api/auth/route.ts => Uses LoginData type
 */
```

You MUST also:
1. Update `app/lib/hooks/useAuth.ts` to handle new field
2. Update `app/api/auth/route.ts` to handle new field
3. Commit ALL three files together

This is why metadata headers exist - to force you to update dependents!

---

## Troubleshooting

**Q: Commit failed - "exports-to file not found"**
- A: Check your @exports-to references - file path is wrong
- Solution: Fix the path or remove if not actually used

**Q: Which files need metadata headers?**
- A: Critical code only: hooks, services, types, API routes
- Simple UI components don't need them

**Q: Can I update @last-modified later?**
- A: No - pre-commit runs automatically and validates timestamps
- Solution: Keep timestamps accurate when you commit

**Q: How do I know what to put in @exports-to?**
- A: Use grep: `grep -r "from.*useAuth" app/` → see all imports
- Then list each file that imports this code

---

## Next Steps

1. ✅ Read the updated `agent-rules.mdc` (this rules doc)
2. ✅ Add metadata headers to critical files
3. ✅ Make a commit to see validation in action
4. ✅ Check `function-registry.json` for your new entries
5. ✅ Reference metadata before modifying critical code
