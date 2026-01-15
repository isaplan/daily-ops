/**
 * @registry-id: memberSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Member Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/member.types.ts => Member types
 * 
 * @exports-to:
 *   ✓ app/components/MemberList.tsx => Uses schema for form validation
 */

import { z } from 'zod'

export const createMemberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  slack_username: z.string().optional(),
  location_id: z.string().optional(),
  team_id: z.string().optional(),
  roles: z.array(z.object({
    role: z.string(),
    scope: z.string(),
  })).optional(),
})

export const updateMemberSchema = createMemberSchema.partial()

export type CreateMemberInput = z.infer<typeof createMemberSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
