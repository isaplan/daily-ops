# Code Metadata Header Format

## Standard Header Template

Add this header to the top of each file (after imports, before code):

```typescript
/**
 * @registry-id: {registryEntryName}
 * @created: {ISO timestamp}
 * @modified: {ISO timestamp}
 * @description: {brief description}
 * @last-fix: {brief note about last fix}
 * 
 * @imports-from:
 *   - {file1} => {what it provides}
 *   - {file2} => {what it provides}
 * 
 * @exports-to:
 *   - {file1} => {what it uses}
 *   - {file2} => {what it uses}
 */
```

## Example

```typescript
import type { AuthUser } from '~/types/auth'

/**
 * @registry-id: useAuth
 * @created: 2026-01-12T18:50:48.216Z
 * @modified: 2026-01-12T23:07:39.079Z
 * @description: Authentication composable - handles login, register, logout, token management
 * @last-fix: Fixed token refresh race condition
 * 
 * @imports-from:
 *   - types/auth.ts => AuthUser, LoginCredentials, RegisterCredentials
 *   - server/api/auth/login.post.ts => login endpoint
 * 
 * @exports-to:
 *   - pages/auth/login.vue => useAuth() for login functionality
 *   - middleware/auth.ts => useAuth() for route protection
 *   - components/Navbar.vue => useAuth() for user display
 */

export const useAuth = () => {
  // ... code
}
```

## Benefits

1. **Immediate Context**: Metadata visible when reading code
2. **Dependency Graph**: See imports/exports at a glance
3. **Maintenance History**: Track changes and fixes
4. **Searchable**: Can grep for "@exports-to: pages/auth" to find dependencies

## Maintenance

- Update `@modified` when file changes
- Update `@last-fix` when fixing bugs
- Update `@exports-to` when new files use this code
- Keep in sync with `function-registry.json`
