<template>
  <section class="rounded-lg border border-gray-200 bg-white shadow-sm">
    <div class="border-b border-gray-200 px-4 py-3">
      <h2 class="text-lg font-semibold text-gray-900">{{ title }}</h2>
    </div>
    <div class="space-y-4 p-4">
      <slot />
      <div class="border-t border-gray-100 pt-4">
        <label class="mb-2 block text-xs font-semibold uppercase text-gray-500">
          Findings / todos / agreements
        </label>
        <p class="mb-2 text-xs text-gray-500">Use /todo and /agree lines (same as Daily Notes).</p>
        <textarea
          :value="localText"
          :disabled="false"
          rows="4"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Add comments, /todo items, /agree decisions…"
          @input="onInput"
        />
        <div class="mt-2 flex items-center gap-2">
          <UButton size="sm" :disabled="saving || !dirty" @click="save">
            {{ saving ? 'Saving…' : 'Save' }}
          </UButton>
          <span v-if="saved" class="text-xs text-green-700">Saved</span>
        </div>
        <ul v-if="content.todos.length" class="mt-3 space-y-1 text-sm">
          <li v-for="todo in content.todos" :key="todo.id" class="flex gap-2">
            <span class="text-gray-400">☐</span>
            <span :class="todo.checked ? 'line-through text-gray-400' : ''">{{ todo.text }}</span>
          </li>
        </ul>
        <ul v-if="content.agrees.length" class="mt-2 space-y-1 text-sm">
          <li v-for="agree in content.agrees" :key="agree.id" class="flex gap-2">
            <span class="text-gray-400">🤝</span>
            <span>{{ agree.text }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { WeeklyReportSectionContent, WeeklyReportSectionKey } from '~/types/weeklyReportDocument'

const props = defineProps<{
  title: string
  sectionKey: WeeklyReportSectionKey
  content: WeeklyReportSectionContent
  isFrozen: boolean
  onSave: (text: string) => Promise<void>
}>()

const localText = ref(props.content.text)
const dirty = ref(false)
const saving = ref(false)
const saved = ref(false)

watch(() => props.content.text, (t) => {
  localText.value = t
  dirty.value = false
})

function onInput(e: Event) {
  localText.value = (e.target as HTMLTextAreaElement).value
  dirty.value = true
  saved.value = false
}

async function save() {
  saving.value = true
  saved.value = false
  try {
    await props.onSave(localText.value)
    dirty.value = false
    saved.value = true
  } finally {
    saving.value = false
  }
}
</script>
