<template>
  <div class="space-y-2">
    <label :for="id" class="text-sm font-medium text-gray-800">{{ label }}</label>
    <UInput
      :id="id"
      :type="type"
      :model-value="modelValue"
      :placeholder="placeholder"
      class="w-full"
      @update:model-value="onInput"
    />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  id: string
  label: string
  modelValue: string
  placeholder?: string
  type?: 'text' | 'password' | 'url'
}>(), {
  placeholder: '',
  type: 'text',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const onInput = (value: string | number | undefined) => {
  emit('update:modelValue', String(value ?? ''))
}
</script>
