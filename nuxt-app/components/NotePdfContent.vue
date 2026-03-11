<template>
  <div ref="rootRef" class="note-pdf-content">
    <h1 class="pdf-title">{{ title }}</h1>
    <div v-if="blocks?.length" class="pdf-blocks">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="pdf-block"
      >
        <div v-if="block.title?.trim()" class="pdf-block-title">{{ block.title }}</div>
        <div
          v-if="block.content"
          class="note-pdf-block-content prose-pdf"
          v-html="block.content"
        />
        <div v-if="block.todos?.length" class="pdf-list pdf-todos">
          <div
            v-for="todo in block.todos"
            :key="todo.id"
            class="pdf-list-item"
          >
            <span :class="todo.checked ? 'pdf-todo-done' : ''">{{ todo.text }}</span>
          </div>
        </div>
        <div v-if="(block.agrees ?? []).length" class="pdf-list">
          <div
            v-for="agree in block.agrees"
            :key="agree.id"
            class="pdf-list-item"
          >
            {{ agree.text }}
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="legacyContent"
      class="note-pdf-block-content prose-pdf"
      v-html="legacyContent"
    />
  </div>
</template>

<script setup lang="ts">
import type { NoteBlock } from '~/types/noteBlock'

defineProps<{
  title: string
  blocks: NoteBlock[]
  legacyContent?: string
}>()

const rootRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })
</script>

<style scoped>
/* Hex/rgb only so html2canvas (used by html2pdf) can parse - no oklch */
.note-pdf-content {
  background-color: #ffffff;
  color: #111827;
  padding: 1.5rem;
}
.pdf-title {
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
}
.pdf-blocks { margin-top: 1.5rem; }
.pdf-block { margin-bottom: 1.5rem; }
.pdf-block-title {
  font-weight: 600;
  border-bottom: 1px solid #d1d5db;
  padding-bottom: 0.25rem;
  font-size: 1.125rem;
  color: #111827;
}
.pdf-list {
  margin-left: 0.5rem;
  border-left: 2px solid #d1d5db;
  padding-left: 0.75rem;
  font-size: 0.875rem;
  color: #111827;
}
.pdf-list-item { margin: 0.125rem 0; }
.pdf-todo-done { color: #6b7280; text-decoration: line-through; }
.prose-pdf :deep(p) { margin: 0 0 0.25em; color: #111827; }
.prose-pdf :deep(p:last-child) { margin-bottom: 0; }
.prose-pdf :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.5em 0 0.25em; color: #111827; }
.prose-pdf :deep(h2) { font-size: 1.25rem; font-weight: 700; margin: 0.5em 0 0.25em; color: #111827; }
.prose-pdf :deep(h3) { font-size: 1.125rem; font-weight: 700; margin: 0.5em 0 0.25em; color: #111827; }
.prose-pdf :deep(ul), .prose-pdf :deep(ol) { padding-left: 1.5rem; margin: 0.25em 0; }
.prose-pdf :deep(li) { margin: 0.125em 0; color: #111827; }
.prose-pdf :deep(hr) { border-top: 1px solid #e5e7eb; margin: 0.5em 0; }
.prose-pdf :deep(a) { color: #2563eb; }
.prose-pdf :deep(blockquote) { border-left-color: #d1d5db; color: #374151; }
.prose-pdf :deep(code) { background-color: #f3f4f6; border-color: #e5e7eb; color: #111827; }
/* Force hex everywhere so html2canvas never sees oklch from global styles */
.note-pdf-content :deep(*) { color: #111827; background-color: transparent; border-color: #e5e7eb; }
.note-pdf-content :deep(a) { color: #2563eb; }
.note-pdf-content :deep(.mention) { color: #2563eb; }
</style>
