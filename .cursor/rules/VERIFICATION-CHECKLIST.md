---
alwaysApply: false
---

# ✅ Verification Checklist: New Agent Rules System

## Files Created/Updated

- ✅ `.cursor/rules/agent-rules.mdc` (126 lines) - Main rules, Next.js focused
- ✅ `.cursor/rules/METADATA-SYNC-GUIDE.md` (230 lines) - How to use metadata
- ✅ `.cursor/rules/UPDATE-SUMMARY.md` (190 lines) - Overview of changes
- ✅ `scripts/validate-metadata.ts` (70 lines) - Pre-commit validation
- ✅ `.husky/pre-commit` (17 lines) - Updated hook with validation

## System Ready

### ✅ Agent Rules
- [x] Next.js 15 + React 18 specifics
- [x] Metadata header enforcement (RULE #11)
- [x] Workflow enforcement (RULE #0)
- [x] Function registry integration
- [x] Socket.io patterns
- [x] Token efficiency emphasis
- [x] Under 130 lines (ultra-concise)

### ✅ Metadata Validation
- [x] Parses `@registry-id` from headers
- [x] Validates `@exports-to` files exist
- [x] Checks critical file patterns
- [x] Fails commit on broken dependencies
- [x] Ready for pre-commit hook

### ✅ Pre-Commit Hook
- [x] Runs metadata validation first
- [x] Then generates registry
- [x] Ensures sync on every commit
- [x] Prevents orphaned code

### ✅ Documentation
- [x] Quick start guide (METADATA-SYNC-GUIDE.md)
- [x] Examples for common tasks
- [x] Troubleshooting section
- [x] File reference table
- [x] Architecture overview (UPDATE-SUMMARY.md)

## How to Test

### Test 1: Verify Files Exist
```bash
ls -la .cursor/rules/
ls -la scripts/
ls -la .husky/
```

### Test 2: Try a Commit
```bash
git status
git add -A
git commit -m "chore: updated agent rules system"
```

**Expected output:**
```
🔍 Validating metadata headers...
📋 Generating function registry...
✅ Metadata & registry validated!
🎉 Pre-commit checks passed. Ready to commit!
```

### Test 3: Read the New Rules
```bash
cat .cursor/rules/agent-rules.mdc
cat .cursor/rules/METADATA-SYNC-GUIDE.md
```

## Next: Add Metadata Headers

Critical files to add headers to:
- [ ] `app/lib/hooks/useAuth.ts` (if exists)
- [ ] `app/lib/hooks/useSocket.ts` (if exists)
- [ ] `app/lib/services/*.ts` (all services)
- [ ] `app/lib/types/*.ts` (all type files)
- [ ] `app/api/**/route.ts` (all API endpoints)

Use METADATA-SYNC-GUIDE.md as reference for format.

## Validation Checklist

Before committing code to critical files:

- [ ] Read metadata header at file top
- [ ] Check `@exports-to` - know what depends on this
- [ ] Update `@last-modified` to ISO timestamp (NOW)
- [ ] Update `@last-fix` with what you changed
- [ ] If exports changed, update `@exports-to` list
- [ ] Commit message: `fix: [what] in [file]`
- [ ] Pre-commit validation passes ✅

## Key Commands

```bash
# Check if metadata validation is working
npx ts-node scripts/validate-metadata.ts

# Manually view function registry
cat function-registry.json | jq '.metadata'

# Find all files with metadata
grep -r "@registry-id" app/

# Search by registry ID
grep -B 2 "@registry-id: useAuth" app/lib/hooks/useAuth.ts
```

## Documentation Files

| File | Purpose | Read This When |
|------|---------|----------------|
| `agent-rules.mdc` | Main rules | Daily development |
| `METADATA-SYNC-GUIDE.md` | How to use metadata | Adding/updating metadata |
| `UPDATE-SUMMARY.md` | Overview of changes | Understanding the system |
| `.cursor/oud/metadata-header-system.md` | Detailed format | Writing complex headers |
| `IMPLEMENTATION_PLAN.md` | Project architecture | Understanding features |

## Success Indicators

✅ You'll know it's working when:

1. **Commit validations pass** - No errors from pre-commit hook
2. **Metadata headers sync** - Updated timestamps on every change
3. **Registry updates** - `function-registry.json` has new entries
4. **Agent uses it** - AI mentions metadata headers and registry when planning changes
5. **No orphaned code** - Can't delete exports without updating dependents

## Common Issues

### Issue: "Validation failed: exports-to file not found"
- Check file path in @exports-to is correct
- Remove if file doesn't exist
- Try commit again

### Issue: Pre-commit takes too long
- Normal if registry is large
- First run slower than subsequent
- ~2-5 seconds typical

### Issue: TypeScript errors in validate-metadata.ts
- Run: `npm install glob` (if needed)
- Ensure Node.js 18+
- Check ts-node is installed

---

**Ready to use!** Start by reading `.cursor/rules/agent-rules.mdc`
