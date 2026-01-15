# Development Guidelines

## Stack
Nuxt 3 • Vue 3 Composition API • TypeScript • Tailwind • Shadcn Vue • MongoDB • GraphQL

## Code Output (Token Efficient)
- NO full code examples (use ```startLine:endLine:filepath)
- NO .md files unless requested
- Workflow: Plan → get approval → execute silently → summary only

## Workflow
**Request:** "Plan: Add X to file Y (lines A-B). Proceed?"
**Approval:** "Yes"
**Execution:** Changes made silently
**Result:** "✅ Done: file X updated"

## Critical Rules
1. Check `function-registry.json` for `"touch_again": false` before editing
2. Search existing code before creating (avoid duplicates)
3. Keep changes ~100 lines max
4. NO Pinia (removed) - use composables + useState()
5. NO logic in GraphQL resolvers - use server/services/
6. NO `any` without justification - types over interfaces
7. NO enums - use const objects with `as const`
8. SSR-first: use `<ClientOnly>`, `useFetch()`, `useAsyncData()`
9. Use `createModuleLogger()` in composables/services/utils
10. NO console.log() in production code

## Debug Mode
Only when user asks "add debug to [page]":
- Add `<DebugPanel ref="debugPanel" />` to page
- Update composable to call: `debugPanel.value?.addEntry({category, title, data, duration})`
- That's it - no extra explanation

## Function Registry
Don't load full registry (~15K tokens). Instead:
```bash
grep '"file": "composables/useSearch"' function-registry.json
grep '"status": "pending"' function-registry.json
```
Ask specific questions instead.

## Token Efficiency
Assume: concise = efficient = cheaper. Only show what's needed.
