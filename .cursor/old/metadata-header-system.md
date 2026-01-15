# Metadata Header System

## Purpose

Metadata headers embed critical dependency and context information directly in code files. This prevents AI agents from making changes without understanding the full impact on dependent code.

**Key Principle:** Metadata headers are **unavoidable** - they're in the code itself, not in separate files that can be ignored.

## Why This System Exists

1. **Prevents cascading failures** - AI sees dependencies before modifying code
2. **Forces complete updates** - Can't delete/modify without updating dependents
3. **Reduces cache reads** - Dependency info is visible immediately
4. **Creates audit trail** - History of changes and fixes
5. **Eliminates orphaned code** - All dependents are listed and checked

## When to Add Metadata Headers

### ✅ REQUIRED (Critical Code)

- `composables/*.ts` - Used across multiple files
- `server/services/*.ts` - Data layer, business logic
- `server/models/*.ts` - Database schemas
- `types/*.ts` - Type definitions used everywhere
- `server/api/**/*.ts` - Public API endpoints
- Complex components (>200 lines, used in 2+ places)

### ❌ NOT NEEDED (Simple Code)

- Simple UI components (<100 lines, single-use)
- Page components (router-only, no exports)
- Utility one-liners
- Shadcn base components (ui/*)

## Header Format

### Standard Template

```typescript
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ {CRITICAL|COMPLEX}: {Component/Function Name} - {Brief Purpose}   ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: {registryEntryName}
 * @created: {ISO timestamp}
 * @last-modified: {ISO timestamp}
 * @description: {1-2 sentence description of what this does}
 * @last-fix: [{date}] {brief note about last fix}
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - path/to/file.ts => {what it provides}
 *   - path/to/file2.ts => {what it provides}
 * 
 * @exports-to (CRITICAL - Update if modifying signatures):
 *   ✓ path/to/file1.ts => {what it uses / how it's used}
 *   ✓ path/to/file2.vue => {what it uses / how it's used}
 * 
 * 🔴 TOUCHING THIS FILE?
 * MUST check & update: [list of critical dependent files]
 */
```

### For Vue Components

```vue
<script setup lang="ts">
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ {CRITICAL|COMPLEX}: {ComponentName} - {Brief Purpose}              ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: {ComponentName}
 * @created: {ISO timestamp}
 * @last-modified: {ISO timestamp}
 * @description: {1-2 sentence description}
 * @last-fix: [{date}] {what was fixed}
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - composables/useX.ts => {what it provides}
 *   - types/x.ts => {type definitions}
 * 
 * @exports-to (Used in):
 *   ✓ pages/cms/artist/[slug]/profile.vue => {how it's used}
 *   ✓ pages/cms/band/[slug]/profile.vue => {how it's used}
 * 
 * @props: {list key props}
 * @emits: {list key emits}
 * 
 * 🔴 TOUCHING THIS FILE?
 * MUST verify: [dependent files] still work with changes
 */
```

## Examples by File Type

### 1. Composable Example

```typescript
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ CRITICAL: useAuth - Authentication State & Methods                 ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: useAuth
 * @created: 2026-01-12T18:50:48.216Z
 * @last-modified: 2026-01-13T10:22:15.781Z
 * @description: Manages auth state (user, loading, error), token persistence, 
 *               login/register/logout/fetchUser flows
 * @last-fix: [2026-01-10] Fixed token refresh race condition by adding 401/403 check
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - types/auth.ts => AuthUser, LoginCredentials, RegisterCredentials
 *   - server/api/auth/login.post.ts (POST /api/auth/login)
 *   - server/api/auth/register.post.ts (POST /api/auth/register)
 *   - server/api/auth/me.get.ts (GET /api/auth/me with Bearer token)
 * 
 * @exports-to (CRITICAL - Update if modifying signatures):
 *   ✓ middleware/auth.ts => useAuth() for route protection check
 *   ✓ pages/auth/login.vue => useAuth() for login form
 *   ✓ pages/auth/register.vue => useAuth() for registration form
 *   ✓ components/Navbar.vue => useAuth() for user display/logout
 *   ✓ plugins/auth.client.ts => useAuth() for app initialization
 * 
 * 🔴 TOUCHING THIS FILE?
 * MUST check & update: middleware/auth.ts, pages/auth/*.vue, components/Navbar.vue
 */

import type { AuthUser, LoginCredentials, RegisterCredentials } from '~/types/auth'

export const useAuth = () => {
  // ... implementation
}
```

### 2. Service Example

```typescript
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ CRITICAL: Email Verification Service - OTP Generation & Sending    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: email-verification-service
 * @created: 2025-11-20T09:15:00.000Z
 * @last-modified: 2026-01-12T14:30:22.541Z
 * @description: Generates email verification codes, validates format, 
 *               sends via SendGrid, stores verification state
 * @last-fix: [2026-01-08] Added email normalization (lowercase + trim)
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - server/utils/verification-codes.ts => generateVerificationCode(), storeVerificationCode()
 *   - server/services/sendgrid-email.ts => sendVerificationEmail()
 * 
 * @exports-to (CRITICAL - Used in auth flow):
 *   ✓ server/api/auth/send-verification.post.ts => generateAndSendEmailCode()
 *   ✓ server/api/auth/verify-code.post.ts => verifyEmailCode()
 *   ✓ pages/auth/register.vue (via API) => indirectly uses this service
 * 
 * 🔴 TOUCHING THIS FILE?
 * MUST verify: server/api/auth/send-verification.post.ts & verify-code.post.ts work
 * MUST check: sendgrid-email.ts still exports sendVerificationEmail()
 */

import { generateVerificationCode, storeVerificationCode } from '../utils/verification-codes'
import { sendVerificationEmail } from './sendgrid-email'

export function validateEmail(email: string) {
  // ... implementation
}
```

### 3. Type Definition Example

```typescript
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ CRITICAL: Auth Types - All Authentication-Related Schemas         ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: auth-types
 * @created: 2025-09-01T00:00:00.000Z
 * @last-modified: 2026-01-12T23:07:39.079Z
 * @description: User, AuthUser, LoginCredentials, RegisterCredentials, AuthResponse types
 * @last-fix: [2026-01-06] Added oauth.youtube connection tracking fields
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - (none - pure types)
 * 
 * @exports-to (CRITICAL - Used by most auth/user code):
 *   ✓ composables/useAuth.ts => AuthUser, LoginCredentials, RegisterCredentials
 *   ✓ server/api/auth/login.post.ts => AuthUser, AuthResponse
 *   ✓ server/api/auth/register.post.ts => RegisterCredentials, AuthResponse
 *   ✓ pages/auth/login.vue => LoginCredentials type
 *   ✓ pages/auth/register.vue => RegisterCredentials type
 *   ✓ middleware/auth.ts => AuthUser type
 *   ✓ server/models/User.ts => Uses User type for schema
 * 
 * 🔴 TOUCHING THIS FILE?
 * Changing ANY property requires updates to:
 *   - server/models/User.ts (schema)
 *   - All files listed in @exports-to
 *   - Database migrations (if db schema needs change)
 */

export type User = {
  _id: string
  email: string
  // ... rest
}
```

### 4. Complex Component Example

```vue
<script setup lang="ts">
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ COMPLEX: GenreInput - Multi-Select Genre Picker with Tree Display  ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: GenreInput
 * @created: 2025-10-15T12:00:00.000Z
 * @last-modified: 2026-01-13T08:45:22.123Z
 * @description: Genre selector component. Loads genre tree, filters by search,
 *               displays hierarchical structure, multi-select with max 10 limit
 * @last-fix: [2026-01-09] Fixed genre tree loading race condition on mount
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - composables/useGenreTree.ts => useGenreTree() for tree data
 *   - server/services/genre-tree-builder.ts => Genre tree building logic
 *   - types/tag.ts => Genre, GenreNode types
 * 
 * @exports-to (Used in multiple artist pages):
 *   ✓ pages/cms/artist/[slug]/profile.vue => GenreInput in form (genres field)
 *   ✓ pages/cms/band/[slug]/profile.vue => GenreInput in form
 *   ✓ pages/cms/community/[slug]/profile.vue => GenreInput in form
 * 
 * @props: genres (v-model) => Array of selected genre IDs
 * @emits: update:genres => When selection changes, error => When tree fails to load
 * 
 * 🔴 TOUCHING THIS FILE?
 * MUST check: pages/cms/artist|band|community/[slug]/profile.vue still pass correct props
 * MUST verify: useGenreTree() still returns expected tree structure
 * MUST test: Multi-select limit (10 genres) still enforced
 */

import { useGenreTree } from '~/composables/useGenreTree'
import type { Genre, GenreNode } from '~/types/tag'

// ... component code
</script>
```

### 5. API Route Example

```typescript
/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║ CRITICAL: GET /api/artist/public/[slug] - Public Artist Profile     ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * @registry-id: get-public-artist-profile
 * @created: 2025-08-10T00:00:00.000Z
 * @last-modified: 2026-01-13T10:22:15.781Z
 * @description: Fetches public artist profile data. Returns name, bio, genres,
 *               social links, theme settings, public videos. NO auth required.
 * @last-fix: [2026-01-11] Added theme settings (accentColor, accentTextColor) to response
 * 
 * ⚠️  DEPENDENCY GRAPH:
 * 
 * @imports-from:
 *   - server/models/ArtistsPortal.ts => ArtistsPortal model + queries
 *   - server/models/VideosPortal.ts => Video filtering
 *   - server/services/artist-genres.ts => Genre enrichment
 * 
 * @exports-to (Used by public pages):
 *   ✓ pages/iam/[slug].vue => useFetch('/api/artist/public/' + slug)
 *   ✓ pages/iam/[slug]/about.vue => Uses response data
 *   ✓ pages/iam/[slug]/updates.vue => Uses response.updates
 *   ✓ pages/iam/[slug]/videos.vue => Uses response.videos
 *   ✓ components/member-page/themes/ThemeArtist.vue => Uses theme settings
 * 
 * @response-schema {
 *   name: string
 *   bio: string
 *   genres: string[]
 *   accentColor: string
 *   accentTextColor: string
 *   videos: Video[]
 * }
 * 
 * 🔴 TOUCHING THIS FILE?
 * If adding/removing fields:
 *   - MUST update pages/iam/[slug]*.vue to handle new fields
 *   - MUST update ThemeArtist.vue if theme fields change
 *   - MUST update types/artist.ts schema
 * If changing query logic:
 *   - MUST verify ArtistsPortal model query still works
 *   - MUST test with real artist data
 */

import { ArtistsPortal } from '~/server/models/ArtistsPortal'

export default defineEventHandler(async (event) => {
  // ... implementation
})
```

## Maintenance Rules

### When Modifying Code with Metadata Headers

1. **Read the header first** - Check @exports-to dependencies
2. **Plan all changes** - Modify this file AND all dependents together
3. **Update @last-modified** - Set to current ISO timestamp
4. **Update @last-fix** - Add entry: `[YYYY-MM-DD] {what was fixed}`
5. **Verify dependents** - Check all @exports-to files still work
6. **Update header if needed** - If dependencies change, update @exports-to

### When Adding New Dependencies

If a new file starts using this code:
- Add it to @exports-to list
- Update @last-modified timestamp

### When Removing Dependencies

If a file stops using this code:
- Remove it from @exports-to list
- Update @last-modified timestamp

## Golden Rule

**If a file's metadata says "exports-to X, Y, Z" and you don't update X, Y, Z → AUTOMATIC FAILURE**

This prevents:
- Orphaned code
- Broken imports
- Cascading failures
- Wasted debugging time

## Benefits

1. **Visible dependencies** - Can't miss them, they're in the code
2. **Forced awareness** - Must acknowledge before modifying
3. **Complete updates** - All dependents updated together
4. **Audit trail** - History of changes and fixes
5. **Reduced cache reads** - Info is right there, no need to grep registry

## Integration with Agent Rules

See `.cursor/rules/agent-rules.mdc` → RULE #11 for enforcement rules that AI agents must follow when encountering metadata headers.
