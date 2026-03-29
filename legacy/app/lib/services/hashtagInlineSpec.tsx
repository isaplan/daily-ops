/**
 * @registry-id: hashtagInlineSpec
 * @created: 2026-01-18T00:00:00.000Z
 * @last-modified: 2026-01-18T00:00:00.000Z
 * @description: BlockNote inline content spec for #hashtag functionality
 * @last-fix: [2026-01-18] Initial implementation
 * 
 * @imports-from:
 *   - app/components/editors/HashtagRenderer.tsx => HashtagRenderer component
 * 
 * @exports-to:
 *   ✓ app/components/editors/BlockNoteEditor.tsx => Used in schema config
 */

import { createReactInlineContentSpec } from '@blocknote/react'
import { HashtagRenderer } from '@/components/editors/HashtagRenderer'

export const hashtagInlineSpec = createReactInlineContentSpec(
  {
    type: 'hashtag',
    propSchema: {
      entityType: {
        default: '',
      },
      entityId: {
        default: '',
      },
      entityName: {
        default: '',
      },
    },
  },
  {
    render: (props) => {
      const { entityType, entityId, entityName } = props.inlineContent.props
      return (
        <HashtagRenderer
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
        />
      )
    },
  }
)

export function createHashtagInlineSpec() {
  return hashtagInlineSpec
}
