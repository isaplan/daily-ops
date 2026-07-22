<template>
  <div>
    <section :id="anchorId" class="scroll-mt-28 space-y-4">
      <h2 class="text-xl font-bold text-gray-900">{{ title }}</h2>
      <slot />
      <div v-if="showFindings" class="space-y-3">
        <div class="flex gap-2">
          <UButton size="xs" variant="soft" icon="i-lucide-plus" class="cursor-pointer" @click="openQuickAdd('todo')">
            Todo
          </UButton>
          <UButton size="xs" variant="soft" icon="i-lucide-plus" class="cursor-pointer" @click="openQuickAdd('agree')">
            Agreed
          </UButton>
        </div>
        <QuickAddInput
          v-if="activeQuickAdd === 'todo'"
          ref="quickAddInputRef"
          icon="i-lucide-circle-check"
          placeholder="Todo… use @name to assign, #tag to link"
          @commit="commitQuickAdd"
          @cancel="cancelQuickAdd"
        />
        <QuickAddInput
          v-if="activeQuickAdd === 'agree'"
          ref="quickAddInputRef"
          icon="i-lucide-handshake"
          placeholder="Agreed decision… use @name or #tag"
          @commit="commitQuickAdd"
          @cancel="cancelQuickAdd"
        />
        <ClientOnly>
          <RichTextEditor
            :model-value="localText"
            :surface="true"
            placeholder="Add comments, /todo items, /agree decisions…"
            @update:model-value="onEditorUpdate"
          />
          <template #fallback>
            <textarea
              :value="plainTextFallback"
              rows="4"
              class="w-full rounded-lg bg-white px-3 py-2 text-sm"
              disabled
            />
          </template>
        </ClientOnly>
        <div class="flex items-center gap-2">
          <UButton size="sm" :disabled="saving || !dirty" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </UButton>
          <span v-if="saved" class="text-xs text-green-700">Saved</span>
        </div>
        <div v-if="localTodos.length" class="ml-1 space-y-2 border-l-2 border-gray-300 pl-4">
          <div
            v-for="todo in localTodos"
            :key="todo.id"
            class="flex cursor-pointer items-start gap-3 rounded-md py-1.5 pr-2 hover:bg-gray-50"
          >
            <UCheckbox
              :model-value="todo.checked"
              class="mt-0.5 shrink-0"
              @update:model-value="(v) => setTodoChecked(todo.id, v === true)"
            />
            <MentionTextInput
              :model-value="todo.text"
              :input-class="[
                'w-full bg-transparent text-sm outline-none focus:rounded focus:ring-1 focus:ring-gray-300 focus:px-1',
                todo.checked ? 'text-gray-500 line-through' : '',
              ].join(' ')"
              @update:model-value="(v) => updateTodoText(todo.id, v)"
              @commit="(v) => updateTodoText(todo.id, v)"
              @cancel="() => {}"
            />
            <button
              type="button"
              class="shrink-0 cursor-pointer text-gray-300 hover:text-red-500"
              title="Remove"
              @click="removeTodo(todo.id)"
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>
        </div>
        <div v-if="localAgrees.length" class="ml-1 space-y-2 border-l-2 border-gray-300 pl-4">
          <div
            v-for="agree in localAgrees"
            :key="agree.id"
            class="flex items-start gap-3 py-1.5"
          >
            <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-gray-500" />
            <MentionTextInput
              :model-value="agree.text"
              input-class="w-full bg-transparent text-sm outline-none focus:rounded focus:ring-1 focus:ring-gray-300 focus:px-1"
              @update:model-value="(v) => updateAgreeText(agree.id, v)"
              @commit="(v) => updateAgreeText(agree.id, v)"
              @cancel="() => {}"
            />
            <button
              type="button"
              class="shrink-0 cursor-pointer text-gray-300 hover:text-red-500"
              title="Remove"
              @click="removeAgree(agree.id)"
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
    <hr v-if="showDivider" class="my-8 border-gray-200">
  </div>
</template>

<script setup lang="ts">
import QuickAddInput from '~/components/weeklyReports/QuickAddInput.vue'
import MentionTextInput from '~/components/weeklyReports/MentionTextInput.vue'
import { extractAssignedTo, parseBlockAgrees, parseBlockTodos } from '~/lib/utils/blockTodoParser'
import { createEmptyBlockAgree, createEmptyBlockTodo } from '~/types/noteBlock'
import type { BlockAgree, BlockTodo } from '~/types/noteBlock'
import type { WeeklyReportSectionContent, WeeklyReportSectionKey } from '~/types/weeklyReportDocument'

const props = withDefaults(
  defineProps<{
    title: string
    anchorId: string
    sectionKey?: WeeklyReportSectionKey
    content?: WeeklyReportSectionContent
    isLocked?: boolean
    showFindings?: boolean
    showDivider?: boolean
    onSave?: (text: string, todos: BlockTodo[], agrees: BlockAgree[]) => Promise<void>
  }>(),
  {
    showFindings: false,
    showDivider: true,
    isLocked: false,
  },
)

const localText = ref(props.content?.text ?? '')
const localTodos = ref<BlockTodo[]>([...(props.content?.todos ?? [])])
const localAgrees = ref<BlockAgree[]>([...(props.content?.agrees ?? [])])
const dirty = ref(false)
const saving = ref(false)
const saved = ref(false)

const activeQuickAdd = ref<'todo' | 'agree' | null>(null)
const quickAddInputRef = ref<{ focus: () => void } | null>(null)

function openQuickAdd(type: 'todo' | 'agree') {
  activeQuickAdd.value = type
  nextTick(() => quickAddInputRef.value?.focus())
}

function commitQuickAdd(text: string) {
  if (!activeQuickAdd.value) return
  if (activeQuickAdd.value === 'todo') {
    localTodos.value = [...localTodos.value, createEmptyBlockTodo(text, 'slash', extractAssignedTo(text))]
  } else {
    localAgrees.value = [...localAgrees.value, createEmptyBlockAgree(text)]
  }
  dirty.value = true
  saved.value = false
  cancelQuickAdd()
}

function cancelQuickAdd() {
  activeQuickAdd.value = null
}

const plainTextFallback = computed(() => localText.value.replace(/<[^>]+>/g, ' ').trim())

watch(
  () => props.content,
  (c) => {
    if (!c) return
    localText.value = c.text
    localTodos.value = [...c.todos]
    localAgrees.value = [...c.agrees]
    dirty.value = false
  },
  { deep: true },
)

function onEditorUpdate(html: string) {
  localText.value = html
  localTodos.value = parseBlockTodos(html, localTodos.value)
  localAgrees.value = parseBlockAgrees(html, localAgrees.value)
  dirty.value = true
  saved.value = false
}

function setTodoChecked(todoId: string, checked: boolean) {
  localTodos.value = localTodos.value.map((t) => (t.id === todoId ? { ...t, checked } : t))
  dirty.value = true
  saved.value = false
}

function updateTodoText(todoId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  localTodos.value = localTodos.value.map((t) => (t.id === todoId ? { ...t, text: trimmed } : t))
  dirty.value = true
  saved.value = false
}

function removeTodo(todoId: string) {
  localTodos.value = localTodos.value.filter((t) => t.id !== todoId)
  dirty.value = true
  saved.value = false
}

function updateAgreeText(agreeId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  localAgrees.value = localAgrees.value.map((a) => (a.id === agreeId ? { ...a, text: trimmed } : a))
  dirty.value = true
  saved.value = false
}

function removeAgree(agreeId: string) {
  localAgrees.value = localAgrees.value.filter((a) => a.id !== agreeId)
  dirty.value = true
  saved.value = false
}

async function save() {
  if (!props.onSave) return
  saving.value = true
  saved.value = false
  try {
    await props.onSave(localText.value, localTodos.value, localAgrees.value)
    dirty.value = false
    saved.value = true
  } finally {
    saving.value = false
  }
}
</script>
