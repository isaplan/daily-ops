/**
 * @registry-id: HashtagExtension
 * @created: 2026-01-20T00:00:00.000Z
 * @last-modified: 2026-01-20T00:00:00.000Z
 * @description: TipTap extension for #hashtag functionality
 * @last-fix: [2026-01-20] Initial implementation
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const HashtagExtension = Extension.create({
  name: 'hashtag',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hashtag'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            const hashtagRegex = /#[\w-]+/g

            state.doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text || ''
                let match

                while ((match = hashtagRegex.exec(text)) !== null) {
                  const from = pos + match.index
                  const to = from + match[0].length

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'hashtag',
                      'data-hashtag': match[0],
                    })
                  )
                }
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
