<template>
  <div class="rich-text-editor rounded-md min-h-[120px]">
    <UEditor
      v-slot="{ editor }"
      :model-value="modelValue"
      content-type="html"
      :placeholder="placeholder"
      class="w-full min-h-[120px] px-3 py-2 [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <UEditorToolbar :editor="editor" :items="bubbleToolbarItems" layout="bubble" />
      <UEditorMentionMenu
        :editor="editor"
        :items="memberItems"
        char="@"
        plugin-key="memberMentionMenu"
        :limit="12"
      />
      <UEditorMentionMenu
        :editor="editor"
        :items="tagItems"
        char="#"
        plugin-key="tagMentionMenu"
        :limit="12"
      />
    </UEditor>
  </div>
</template>

<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import { useMentionTagSuggestions } from '~/composables/useMentionTagSuggestions'

defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()

const { memberItems, tagItems } = useMentionTagSuggestions()

const bubbleToolbarItems: EditorToolbarItem[][] = [
  // H1 H2 H3 p
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Heading' },
      content: { align: 'start' as const },
      items: [
        { kind: 'heading', level: 1, icon: 'i-lucide-heading-1', label: 'Heading 1' },
        { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
        { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
      ],
    },
    { kind: 'paragraph', icon: 'i-lucide-paragraph', tooltip: { text: 'Paragraph' } },
  ],
  // B U I
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
  ],
  // list ordered unordered check
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bullet list' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Ordered list' } },
    { kind: 'taskList', icon: 'i-lucide-list-checks', tooltip: { text: 'Task list' } },
  ],
  // hr link
  [
    { kind: 'horizontalRule', icon: 'i-lucide-minus', tooltip: { text: 'Horizontal rule' } },
    { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Link' } },
  ],
]
</script>

<style scoped>
/* Single Enter = single line: reduce paragraph margin so new <p> doesn't look like two breaks */
.rich-text-editor :deep(.ProseMirror p) {
  margin-top: 0;
  margin-bottom: 0.25em;
}
.rich-text-editor :deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}
</style>
