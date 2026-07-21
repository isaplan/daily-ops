<template>
  <div class="relative">
    <div class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <UIcon :name="icon" class="mt-0.5 size-4 shrink-0 text-gray-400" />
      <MentionTextInput
        ref="mentionInputRef"
        v-model="text"
        :placeholder="placeholder"
        input-class="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        @commit="onCommit"
        @cancel="emit('cancel')"
      />
      <UButton size="xs" variant="soft" :disabled="!text.trim()" @click="onCommit(text)">
        Add
      </UButton>
      <UButton size="xs" variant="ghost" icon="i-lucide-x" @click="emit('cancel')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MentionTextInput from '~/components/weeklyReports/MentionTextInput.vue'

defineProps<{
  icon: string
  placeholder: string
}>()

const emit = defineEmits<{
  commit: [text: string]
  cancel: []
}>()

const text = ref('')
const mentionInputRef = ref<{ focus: () => void } | null>(null)

defineExpose({ focus: () => mentionInputRef.value?.focus() })

function onCommit(val: string) {
  const t = val.trim()
  if (!t) return
  emit('commit', t)
  text.value = ''
}
</script>
