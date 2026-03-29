<template>
  <div class="space-y-4">
    <div v-if="blocks?.length" class="space-y-8">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="space-y-3"
      >
        <section class="rounded-lg bg-white shadow-sm p-4 space-y-3">
          <div v-if="block.title?.trim()" class="flex items-center gap-2">
            <div class="min-w-0 flex-1 rounded-none px-0 font-semibold border-b border-black pb-1 text-gray-900">
              {{ block.title }}
            </div>
          </div>
          <div
            v-if="block.content"
            class="note-read-only-content w-full outline-none min-h-[100px] px-3 py-2 sm:px-8 *:my-5 *:first:mt-0 *:last:mb-0 [&_p]:leading-7 [&_a]:text-primary [&_a]:border-b [&_a]:border-transparent [&_a]:hover:border-primary [&_a]:font-medium [&_.mention]:text-primary [&_.mention]:font-medium [&_:is(h1,h2,h3,h4,h5,h6)]:font-bold [&_:is(h1,h2,h3,h4,h5,h6)]:text-gray-900 [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg [&_h5]:text-base [&_h6]:text-base [&_blockquote]:border-s-4 [&_blockquote]:border-gray-300 [&_blockquote]:ps-4 [&_blockquote]:italic [&_hr]:border-t [&_hr]:border-gray-200 [&_hr]:my-5 [&_pre]:text-sm [&_pre]:border [&_pre]:border-gray-200 [&_pre]:bg-gray-100 [&_pre]:rounded-md [&_pre]:px-4 [&_pre]:py-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-x-auto [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:font-inherit [&_pre_code]:rounded-none [&_pre_code]:inline [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_code]:font-medium [&_code]:rounded-md [&_code]:inline-block [&_code]:border [&_code]:border-gray-200 [&_code]:text-gray-900 [&_code]:bg-gray-100 [&_:is(ul,ol)]:ps-6 [&_ul]:list-disc [&_ul]:marker:text-gray-500 [&_ol]:list-decimal [&_ol]:marker:text-gray-400 [&_li]:my-1.5 [&_li]:ps-1.5 [&_img]:rounded-md [&_img]:block [&_img]:max-w-full text-gray-900"
            v-html="block.content"
          />
        </section>
        <div v-if="block.todos?.length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
          <label
            v-for="todo in block.todos"
            :key="todo.id"
            :class="[
              'flex cursor-pointer items-start gap-3 rounded-md py-1.5 pr-2 text-sm transition-colors',
              noteId && 'hover:bg-gray-50',
            ]"
          >
            <UCheckbox
              :model-value="isTodoChecked(todo)"
              :disabled="!noteId"
              class="mt-0.5 shrink-0"
              @update:model-value="noteId ? toggleTodo(todo) : undefined"
            />
            <span :class="isTodoChecked(todo) ? 'text-gray-500 line-through' : 'text-gray-900'">{{ todo.text }}</span>
          </label>
        </div>
        <div v-if="blockAgrees(block).length" class="ml-1 border-l-2 border-gray-300 pl-4 space-y-2">
          <div
            v-for="agree in blockAgrees(block)"
            :key="agree.id"
            class="flex items-start gap-3 py-1.5"
          >
            <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
            <span class="text-sm text-gray-900">{{ agree.text }}</span>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="note?.content"
      class="note-read-only-content w-full outline-none min-h-[100px] px-3 py-2 sm:px-8 *:my-5 *:first:mt-0 *:last:mb-0 [&_p]:leading-7 [&_a]:text-primary [&_a]:border-b [&_a]:border-transparent [&_a]:hover:border-primary [&_a]:font-medium [&_.mention]:text-primary [&_.mention]:font-medium [&_:is(h1,h2,h3,h4,h5,h6)]:font-bold [&_:is(h1,h2,h3,h4,h5,h6)]:text-gray-900 [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_h4]:text-lg [&_h5]:text-base [&_h6]:text-base [&_blockquote]:border-s-4 [&_blockquote]:border-gray-300 [&_blockquote]:ps-4 [&_blockquote]:italic [&_hr]:border-t [&_hr]:border-gray-200 [&_hr]:my-5 [&_pre]:text-sm [&_pre]:border [&_pre]:border-gray-200 [&_pre]:bg-gray-100 [&_pre]:rounded-md [&_pre]:px-4 [&_pre]:py-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-x-auto [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:font-inherit [&_pre_code]:rounded-none [&_pre_code]:inline [&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_code]:font-medium [&_code]:rounded-md [&_code]:inline-block [&_code]:border [&_code]:border-gray-200 [&_code]:text-gray-900 [&_code]:bg-gray-100 [&_:is(ul,ol)]:ps-6 [&_ul]:list-disc [&_ul]:marker:text-gray-500 [&_ol]:list-decimal [&_ol]:marker:text-gray-400 [&_li]:my-1.5 [&_li]:ps-1.5 [&_img]:rounded-md [&_img]:block [&_img]:max-w-full text-gray-900"
      v-html="note.content"
    />
    <p v-else class="text-gray-500">No content.</p>
  </div>
</template>

<script setup lang="ts">
import type { Note } from '~/types/note'
import type { NoteBlock } from '~/types/noteBlock'

const props = defineProps<{
  note: Note
  blocks: NoteBlock[]
  /** When set, todos are clickable and toggle checked via API. */
  noteId?: string
}>()

const emit = defineEmits<{
  'todo-toggled': []
}>()

/** Optimistic todo checked state (todoId -> checked). Cleared when blocks change. */
const todoCheckedOverride = ref<Record<string, boolean>>({})

function isTodoChecked(todo: { id: string; checked?: boolean }) {
  if (todo.id in todoCheckedOverride.value) return todoCheckedOverride.value[todo.id]
  return todo.checked ?? false
}

watch(
  () => props.blocks,
  () => { todoCheckedOverride.value = {} },
  { deep: true }
)

async function toggleTodo(todo: { id: string; text?: string; checked?: boolean }) {
  if (!props.noteId) return
  const next = !isTodoChecked(todo)
  todoCheckedOverride.value = { ...todoCheckedOverride.value, [todo.id]: next }
  try {
    await $fetch(`/api/notes/${props.noteId}/todos/${todo.id}`, {
      method: 'PUT',
      body: { checked: next },
    })
    emit('todo-toggled')
  } catch {
    todoCheckedOverride.value = { ...todoCheckedOverride.value, [todo.id]: !next }
  }
}

function blockAgrees(block: NoteBlock) {
  return block.agrees ?? []
}
</script>

<style scoped>
/* Match editor (ProseMirror): TipTap outputs unstyled semantic HTML; we only override p spacing */
.note-read-only-content p {
  margin-top: 0;
  margin-bottom: 0.25em;
}
.note-read-only-content p:last-child {
  margin-bottom: 0;
}
</style>
