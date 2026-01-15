/**
 * @registry-id: teamSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Team Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/team.types.ts => Team types
 * 
 * @exports-to:
 *   ✓ app/components/TeamList.tsx => Uses schema for form validation
 */

import { z } from 'zod'

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
  location_id: z.string().optional(),
})

export const updateTeamSchema = createTeamSchema.partial()

export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>
