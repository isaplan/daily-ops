<template>
  <div class="relative flex-1">
    <input
      ref="inputRef"
      :value="modelValue"
      :placeholder="placeholder"
      :class="inputClass"
      autocomplete="off"
      @input="onInput"
      @keydown="onKeydown"
    />
    <div
      v-if="suggestions.length"
      class="absolute left-0 top-full z-50 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
    >
      <button
        v-for="(item, i) in suggestions"
        :key="item.id"
        :class="[
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
          i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50',
        ]"
        @mousedown.prevent="selectSuggestion(item)"
      >
        <span class="truncate font-medium">{{ item.label }}</span>
        <span v-if="'description' in item && item.description" class="truncate text-xs text-gray-400">
          {{ item.description }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MentionMemberItem, MentionTagItem } from '~/composables/useMentionTagSuggestions'
import { useMentionTagSuggestions } from '~/composables/useMentionTagSuggestions'

type SuggestionItem = MentionMemberItem | MentionTagItem

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    inputClass?: string
  }>(),
  { placeholder: '', inputClass: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: [text: string]
  cancel: [original: string]
}>()

const { memberItems, tagItems } = useMentionTagSuggestions()

const inputRef = ref<HTMLInputElement | null>(null)
const suggestions = ref<SuggestionItem[]>([])
const activeIndex = ref(0)
const triggerStart = ref(-1)
const mentionChar = ref<'@' | '#' | null>(null)

defineExpose({ focus: () => inputRef.value?.focus() })

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  emit('update:modelValue', val)

  const cursor = inputRef.value?.selectionStart ?? val.length
  const slice = val.slice(0, cursor)
  const atIdx = slice.lastIndexOf('@')
  const hashIdx = slice.lastIndexOf('#')
  const triggerIdx = Math.max(atIdx, hashIdx)

  if (triggerIdx === -1) { closeSuggestions(); return }

  const char = val[triggerIdx] as '@' | '#'
  const query = slice.slice(triggerIdx + 1)

  if (/\s/.test(query) && query.length > 0) { closeSuggestions(); return }

  mentionChar.value = char
  triggerStart.value = triggerIdx
  activeIndex.value = 0

  const q = query.toLowerCase()
  suggestions.value = (char === '@' ? memberItems.value : tagItems.value)
    .filter((m) => m.label.toLowerCase().includes(q))
    .slice(0, 8)
}

function onKeydown(e: KeyboardEvent) {
  if (suggestions.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex.value = (activeIndex.value + 1) % suggestions.value.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length; return }
    if (e.key === 'Enter') { e.preventDefault(); selectSuggestion(suggestions.value[activeIndex.value]); return }
    if (e.key === 'Escape') { e.preventDefault(); closeSuggestions(); return }
  } else {
    if (e.key === 'Enter') { e.preventDefault(); commitCurrent(); return }
    if (e.key === 'Escape') { e.preventDefault(); emit('cancel', props.modelValue); return }
  }
}

function selectSuggestion(item: SuggestionItem) {
  if (triggerStart.value === -1 || !mentionChar.value) return
  const cur = inputRef.value?.selectionStart ?? props.modelValue.length
  const before = props.modelValue.slice(0, triggerStart.value)
  const after = props.modelValue.slice(cur)
  const next = `${before}${mentionChar.value}${item.label} ${after}`
  emit('update:modelValue', next)
  closeSuggestions()
  nextTick(() => {
    const pos = before.length + item.label.length + 2
    inputRef.value?.setSelectionRange(pos, pos)
    inputRef.value?.focus()
  })
}

function closeSuggestions() {
  suggestions.value = []
  mentionChar.value = null
  triggerStart.value = -1
}

function commitCurrent() {
  const t = props.modelValue.trim()
  if (!t) return
  closeSuggestions()
  emit('commit', t)
}
</script>
