/**
 * @registry-id: channelSchema
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Channel Zod validation schemas
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/types/channel.types.ts => Channel types
 * 
 * @exports-to:
 *   ✓ app/components/ChannelForm.tsx => Uses schema for form validation
 */

import { z } from 'zod'

export const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  description: z.string().optional(),
  type: z.enum(['general', 'location', 'team', 'member', 'project']),
  location_id: z.string().optional(),
  team_id: z.string().optional(),
  member_id: z.string().optional(),
  members: z.array(z.string()).optional(),
  created_by: z.string().optional(),
})

export const updateChannelSchema = createChannelSchema.partial().extend({
  name: z.string().min(1).optional(),
})

export type CreateChannelInput = z.infer<typeof createChannelSchema>
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>
