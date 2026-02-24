<template>
  <div class="space-y-8">
    <template v-if="blocks?.length">
      <section
        v-for="block in blocks"
        :key="block.id"
        class="space-y-3"
      >
        <h2
          v-if="block.title?.trim()"
          class="text-lg font-semibold text-gray-900 border-b border-black pb-1"
        >
          {{ block.title }}
        </h2>
        <div
          v-if="block.content"
          class="prose prose-sm max-w-none text-gray-800"
          v-html="block.content"
        />
        <div v-if="block.todos?.length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
          <label
            v-for="todo in block.todos"
            :key="todo.id"
            class="flex items-start gap-3 py-1.5 text-sm"
          >
            <UIcon
              :name="todo.checked ? 'i-lucide-checkbox-checked' : 'i-lucide-checkbox'"
              class="mt-0.5 size-4 shrink-0 text-gray-500"
            />
            <span :class="todo.checked ? 'text-gray-500 line-through' : ''">{{ todo.text }}</span>
          </label>
        </div>
        <div v-if="blockAgrees(block).length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
          <div
            v-for="agree in blockAgrees(block)"
            :key="agree.id"
            class="flex items-start gap-3 py-1.5 text-sm"
          >
            <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
            <span>{{ agree.text }}</span>
          </div>
        </div>
      </section>
    </template>
    <div
      v-else-if="note?.content"
      class="prose prose-sm max-w-none text-gray-800"
      v-html="note.content"
    />
    <p v-else class="text-gray-500">No content.</p>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/types/note'
import type { NoteBlock } from '~/types/noteBlock'

defineProps<{
  note: Note
  blocks: NoteBlock[]
}>()

function blockAgrees(block: NoteBlock) {
  return block.agrees ?? []
}
</script>
