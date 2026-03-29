<template>
  <div ref="wrapperRef" class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      @input="onInputFromEvent($event)"
      @keydown="onKeydown"
    />
    <Teleport to="body">
      <div
        v-if="showMenu"
        ref="menuRef"
        class="fixed z-50 min-w-[12rem] max-w-[20rem] max-h-64 overflow-y-auto rounded-md border bg-white py-1 shadow-lg"
        :style="menuStyle"
      >
        <button
          v-for="(item, i) in filteredOptions"
          :key="item.id"
          type="button"
          class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
          :class="{ 'bg-gray-100': i === selectedIndex }"
          @click="selectOption(item)"
        >
          <span v-if="triggerChar === '@'" class="font-medium">{{ item.label }}</span>
          <span v-else>#{{ item.label }}</span>
        </button>
        <p v-if="filteredOptions.length === 0" class="px-3 py-2 text-sm text-gray-500">
          No {{ triggerChar === '@' ? 'members' : 'tags' }} found
        </p>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { MentionMemberItem, MentionTagItem } from '~/composables/useMentionTagSuggestions'
import { useMentionTagSuggestions } from '~/composables/useMentionTagSuggestions'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    rows?: number
  }>(),
  { rows: 12 }
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { memberItems, tagItems } = useMentionTagSuggestions()
const wrapperRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)
const triggerChar = ref<'@' | '#'>('@')
const query = ref('')
const triggerStart = ref(0)
const selectedIndex = ref(0)
const menuStyle = ref({ top: '0px', left: '0px' })

function getCursorPosition(): number {
  const el = textareaRef.value
  if (!el) return 0
  return el.selectionStart ?? 0
}

function getTextBeforeCursor(): string {
  const el = textareaRef.value
  const pos = getCursorPosition()
  const text = el?.value ?? props.modelValue
  return text.slice(0, pos)
}

/** Find last @ or # that starts a mention (no alnum before it). */
function detectTrigger(): { char: '@' | '#'; start: number } | null {
  const before = getTextBeforeCursor()
  const match = before.match(/(?:^|[\s(])[@#]([a-zA-Z0-9_-]*)$/)
  if (!match) return null
  const full = match[0]
  const trimStartLen = full.length - full.trimStart().length
  const start = before.length - full.length + trimStartLen
  const trigger = full.trimStart().charAt(0) as '@' | '#'
  return { char: trigger, start }
}

const filteredOptions = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (triggerChar.value === '@') {
    const list = memberItems.value
    if (!q) return list.slice(0, 12)
    return list.filter((m: MentionMemberItem) => m.label.toLowerCase().includes(q)).slice(0, 12)
  }
  const list = tagItems.value
  if (!q) return list.slice(0, 12)
  return list.filter((t: MentionTagItem) => t.label.toLowerCase().includes(q)).slice(0, 12)
})

function openMenu(trigger: '@' | '#', start: number, q: string) {
  triggerChar.value = trigger
  triggerStart.value = start
  query.value = q
  showMenu.value = true
  selectedIndex.value = 0
  nextTick(() => positionMenu())
}

function positionMenu() {
  const el = textareaRef.value
  if (!el || !menuRef.value) return
  const rect = el.getBoundingClientRect()
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function closeMenu() {
  showMenu.value = false
}

function insertReplacement(replacement: string) {
  const el = textareaRef.value
  if (!el) return
  const start = triggerStart.value
  const end = getCursorPosition()
  const text = el.value
  const before = text.slice(0, start)
  const after = text.slice(end)
  const newValue = before + replacement + after
  emit('update:modelValue', newValue)
  closeMenu()
  nextTick(() => {
    const newPos = start + replacement.length
    el.setSelectionRange(newPos, newPos)
    el.focus()
  })
}

function selectOption(item: MentionMemberItem | MentionTagItem) {
  const prefix = triggerChar.value
  const replacement = prefix === '#' ? `#${item.label}` : `@${item.label}`
  insertReplacement(replacement)
}

function onInputFromEvent(e: Event) {
  const value = (e.target as HTMLTextAreaElement)?.value ?? ''
  onInput(value)
}

function onInput(value: string) {
  emit('update:modelValue', value)
  const t = detectTrigger()
  if (t) {
    const q = getTextBeforeCursor().slice(t.start + 1)
    openMenu(t.char, t.start, q)
  } else {
    closeMenu()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (!showMenu.value) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredOptions.value.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return
  }
  if (e.key === 'Enter' && filteredOptions.value.length > 0) {
    e.preventDefault()
    selectOption(filteredOptions.value[selectedIndex.value])
    return
  }
  if (e.key === 'Escape') {
    closeMenu()
  }
}

</script>
