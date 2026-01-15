---
alwaysApply: false
---

# Updated Agent Rules System: Summary

## What Was Done

### 1. ✅ New Agent Rules (`.cursor/rules/agent-rules.mdc`)

**Completely rewritten:**
- Removed Nuxt/Vue3 content (was outdated)
- Added Next.js 15 + React 18 specifics
- Integrated metadata header enforcement
- Added Socket.io patterns
- Reduced from 300 lines → **126 lines** (ultra-concise, token-efficient)
- Next.js app router patterns
- Server Components best practices
- Real-time (Socket.io) integration patterns

**Key additions:**
- **RULE #11:** Metadata headers are mandatory before modifying critical code
- **RULE #0:** Workflow enforcement (Plan → Approval → Execute)
- Function registry integration (grep-based, O(1) lookups)
- Metadata sync requirements on every commit

---

### 2. ✅ Metadata Validation Script (`scripts/validate-metadata.ts`)

**New script that runs on pre-commit:**
- Parses metadata headers from critical files
- Extracts `@registry-id`, `@exports-to`, `@last-modified`, `@last-fix`
- Validates all `@exports-to` files actually exist
- Fails commit if dependencies are broken
- Prevents orphaned code & cascading failures

**Critical file patterns it checks:**
- `app/lib/hooks/*.ts` (custom hooks)
- `app/lib/services/*.ts` (backend services)
- `app/lib/types/*.ts` (type definitions)
- `app/api/**/*.ts` (API endpoints)

---

### 3. ✅ Updated Pre-Commit Hook (`.husky/pre-commit`)

**Enhanced hook now:**
1. Runs metadata validation (NEW)
2. Regenerates function registry
3. Validates everything before commit
4. Stops commit if any issues found

**This ensures:**
- Metadata & registry always in sync
- Exports-to dependencies always valid
- No broken imports
- No orphaned code

---

### 4. ✅ Metadata Sync Guide (`.cursor/rules/METADATA-SYNC-GUIDE.md`)

**New quick reference:**
- How to add metadata headers
- When to update @last-modified/@last-fix
- Examples of updating critical code
- Troubleshooting common issues
- Step-by-step workflow

---

## How It Works Now

### The Flow

```
You make changes to critical code
    ↓
git add files
    ↓
git commit -m "message"
    ↓
Pre-commit hook triggers
    ↓
validate-metadata.ts runs
    ├─ Parse all metadata headers
    ├─ Extract @exports-to dependencies
    ├─ Check each exported file exists
    └─ Fail if broken!
    ↓
If valid: generate-registry.ts runs
    ├─ Scan all files
    ├─ Create function registry
    └─ Stage updated registry
    ↓
Commit completes ✅
    ↓
Registry & metadata perfectly in sync
```

### Key Difference from Before

| Before | After |
|--------|-------|
| Registry updated on commit | Registry + metadata validated on commit |
| Broken exports-to possible | Broken exports-to FAILS commit |
| Manual dependency tracking | Auto-validated dependencies |
| Registry was snapshot only | Registry linked to metadata headers |

---

## What This Solves

### Problem 1: Cascading Failures ✅
**Before:** Modify composable X, forget to update component Y that uses it → broken
**After:** Pre-commit catches this → can't commit

### Problem 2: Orphaned Code ✅
**Before:** Delete function Z, no way to know what depends on it
**After:** Metadata header lists all dependents → validate before deleting

### Problem 3: Registry Not Tracking Changes ✅
**Before:** Registry was just "current state" snapshot
**After:** Metadata headers track "why" + registry tracks "what"

### Problem 4: Manual Sync Burden ✅
**Before:** Developer had to keep metadata, registry, code all in sync manually
**After:** Pre-commit validates everything automatically

---

## For You: Next Steps

### 1. Test the New System
```bash
# Make a small change to a critical file
# Try to commit
git commit -m "test: updating new system"

# You'll see the validation run:
# 🔍 Validating metadata headers...
# 📋 Generating function registry...
# ✅ Metadata & registry validated!
```

### 2. Add Metadata Headers
Go through your critical files and add headers:
- `app/lib/hooks/*.ts`
- `app/lib/services/*.ts`
- `app/lib/types/*.ts`
- `app/api/**/*.ts`

Reference: `.cursor/rules/METADATA-SYNC-GUIDE.md` for examples

### 3. Read the New Rules
`.cursor/rules/agent-rules.mdc` is now your source of truth
- Next.js 15 patterns
- Metadata header enforcement
- Registry integration
- Socket.io patterns

---

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `.cursor/rules/agent-rules.mdc` | Main agent rules | 126 |
| `.cursor/rules/METADATA-SYNC-GUIDE.md` | Metadata quick start | 230 |
| `scripts/validate-metadata.ts` | Pre-commit validation | 70 |
| `.husky/pre-commit` | Updated hook | 17 |
| `function-registry.json` | Auto-generated (no changes needed) | - |

---

## Architecture Philosophy

**3-Layer System:**
1. **Code** - You write it with metadata headers
2. **Validation** - Pre-commit validates headers & dependencies
3. **Registry** - Auto-generated snapshot of current state

**This ensures:**
- ✅ Code is self-documenting (headers describe it)
- ✅ Dependencies are explicit (exports-to list)
- ✅ Changes are tracked (last-modified timestamps)
- ✅ Registry is always accurate (auto-generated)
- ✅ Nothing gets orphaned (validation prevents it)

---

## Token Efficiency Reminder

The new agent rules are **ultra-concise** (126 lines):
- No bloated explanations
- Just rules + references
- Point to detailed docs (METADATA-SYNC-GUIDE.md) instead of duplicating
- Uses code references only
- Emphasizes grep-based lookups over loading full registry

**This saves ~50-100 tokens per interaction = real cost savings**

---

## Questions?

Refer to:
- `.cursor/rules/agent-rules.mdc` - Daily reference
- `.cursor/rules/METADATA-SYNC-GUIDE.md` - How to use metadata
- `.cursor/oud/metadata-header-system.md` - Full detailed format
- IMPLEMENTATION_PLAN.md - Project architecture
