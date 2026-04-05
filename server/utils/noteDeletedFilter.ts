/**
 * Soft-delete: `deleted_at` is null or missing = active note; Date = in trash.
 */

/** Active notes (not in trash). */
export function activeNotesMatch(): Record<string, unknown> {
  return { deleted_at: null }
}

/** Notes in trash only. */
export function trashedNotesMatch(): Record<string, unknown> {
  return { deleted_at: { $ne: null } }
}
