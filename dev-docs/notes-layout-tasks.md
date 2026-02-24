# Note layout tasks: top nav, aside, default block, new weekly

## Current state

- **Existing note** (`/notes/[slug]` e.g. nuxt-wekelijks-mt-21-feb-2026): Uses one layout branch in `pages/notes/[id].vue` with top nav (Back, title, Details/Todo/Agreed tabs), two-column flex (editor + aside). Aside shows Details panel (teleported from WeeklyNoteEditor), Todo list, Agreed list, and optional Active members. Correct layout.
- **New note** (`/notes/new`, `/notes/new?template=weekly`): Uses a different branch (`v-else-if="isNew"`). Same top nav, but only one main column and a minimal second column that is just `#details-panel-target` when Details is open. **Missing**: the same aside panel (Details/Todo/Agreed in one sticky panel) and the same two-column structure. So the “new weekly” page looks like the old layout without the aside.

---

## Task 1: Update the Note layout with top nav, aside, and empty block

**Goal:** One shared layout for both existing and new notes: top nav + aside (Details/Todo/Agreed), and a default new-note state with one empty block at ~75% height and “Add block” below.

**Subtasks:**

1. **Unify layout in `pages/notes/[id].vue`**
   - Use a **single** layout structure for both “existing note” and “new note” when showing the block editor (i.e. when `(note && isBlockNote) || (isNew && useWeekly)` for weekly, and equivalent for plain new with block editor if applicable).
   - That structure must match the existing-note layout: same top nav, same two-column flex (editor column + aside column with `asideVisible`, Details/Todo/Agreed tabs and content, `#details-panel-target` for teleport).
   - Ensure `asideVisible` and `showDetailsButton` work for `isNew` (already true for `useWeekly`) so the aside and tabs show for new weekly notes.

2. **Default note: one block, empty title, ~75% height, Add block below**
   - Define a “default” initial state for new notes: **one** editor block with **empty title** (no prefilled section title).
   - In `WeeklyNoteEditor` (or via a small default template in `lib/templates/`):
     - When there is no `note` and no `initialTemplate === 'weekly'`, initialize with a single block (e.g. use `createEmptyBlock()` or a `getDefaultTemplateBlocks()` that returns one block with `title: ''`).
   - So: “New note” (no template) = same top nav + aside + 1 block (empty title).
   - Give the first block **~75% of available height** when it’s the only block on a new note (e.g. first section with `min-height: 75%` or `flex: 0 0 75%` in a flex column, or a wrapper with `min-h-[75vh]` only when `blocks.length === 1` and no `note`).
   - “Add block” button stays below that block (already in `WeeklyNoteEditor`).

**Files to touch:** `nuxt-app/pages/notes/[id].vue`, `nuxt-app/components/WeeklyNoteEditor.vue`, optionally `nuxt-app/lib/templates/weeklyNoteTemplate.ts` or a new default template.

---

## Task 2: Update the new weekly to match the correct layout

**Goal:** `/notes/new?template=weekly` should look like the existing note page: same top nav, same aside (Details/Todo/Agreed), same two-column layout. No “old” single-column layout.

**Subtasks:**

1. **Use the same layout branch for new weekly as for existing note**
   - In `pages/notes/[id].vue`, remove or refactor the `v-else-if="isNew"` block that currently renders a different layout (single column + minimal details target).
   - Render new weekly (`isNew && useWeekly`) with the **same** layout as existing block notes: the same `v-if` condition and the same template block that contains:
     - Top nav (Back, title, Details/Todo/Agreed buttons).
     - Flex row: editor column (with `WeeklyNoteEditor`) + aside column (sticky panel with Details/Todo/Agreed content and `#details-panel-target`).
   - Ensure `showDetailsButton` is true for `isNew && useWeekly` (already is), and that the aside column is visible when Details is open or when Todo/Agreed would be shown (for new notes, Todo/Agreed lists can be empty).

2. **Keep WeeklyNoteEditor and teleport behavior**
   - `WeeklyNoteEditor` already receives `v-model:details-open` and `initial-template="weekly"` for new weekly; it teleports the Details form to `#details-panel-target`. Ensure that target lives in the **same** aside column as on the existing note page so the aside looks identical.

**Files to touch:** `nuxt-app/pages/notes/[id].vue` only (merge the two layout branches so new weekly uses the “correct” layout).

---

## Order of work

1. **Task 2 first** (simpler): In `[id].vue`, make the `isNew` case use the same layout structure as `!isNew && note` (one shared block for “editor + aside”). That fixes “new weekly” missing the aside.
2. **Task 1 next**: Add default note setup (one block, empty title, 75% height, Add block below) and ensure both new plain and new weekly use the shared layout with top nav and aside.

---

## Summary

| Task | What | Key change |
|------|------|------------|
| **1** | Note layout: top nav, aside, default empty block | Single layout in `[id].vue` for existing + new; default = 1 block, empty title, ~75% height, Add block below. |
| **2** | New weekly matches correct layout | `/notes/new?template=weekly` uses same layout as existing note (top nav + aside, two-column). |

After both: new note and new weekly have the same top nav and aside as `http://localhost:8080/notes/nuxt-wekelijks-mt-21-feb-2026`, and the default new note has one empty block at ~75% height with Add block below.
