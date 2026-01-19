/**
 * @registry-id: mentionInlineSpec
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: BlockNote inline content spec for @mention functionality
 * @last-fix: [2026-01-18] Initial implementation
 * 
 * @imports-from:
 *   - app/components/editors/MentionRenderer.tsx => MentionRenderer component
 * 
 * @exports-to:
 *   ✓ app/components/editors/BlockNoteEditor.tsx => Used in schema config
 */

import { createReactInlineContentSpec } from '@blocknote/react'
import { MentionRenderer } from '@/components/editors/MentionRenderer'

export const mentionInlineSpec = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      userId: {
        default: '',
      },
      userName: {
        default: '',
      },
    },
  },
  {
    render: (props) => {
      const { userId, userName } = props.inlineContent.props
      return <MentionRenderer userId={userId} userName={userName} />
    },
  }
)

export function createMentionInlineSpec() {
  return mentionInlineSpec
}
