<template>
  <form @submit.prevent="submit" class="space-y-4">
    <UFormField label="Content">
      <UTextarea
        v-model="form.content"
        placeholder="Note content"
        :rows="12"
      />
    </UFormField>
    <div class="flex gap-2">
      <UButton type="submit" :loading="loading">
        {{ note ? 'Save' : 'Create' }}
      </UButton>
      <UButton type="button" variant="outline" @click="$emit('cancel')">
        Cancel
      </UButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Note, NoteResponse } from '~/types/note'

const props = defineProps<{ note?: Note | null; externalTitle?: string }>()
const emit = defineEmits<{
  saved: [note: Note]
  cancel: []
}>()

const form = reactive({
  title: props.note?.title ?? '',
  content: props.note?.content ?? '',
})

watch(
  () => props.externalTitle,
  (v) => {
    if (v !== undefined && v !== null) form.title = v
  },
  { immediate: true }
)
watch(
  () => props.note,
  (n) => {
    if (n) {
      form.title = n.title
      form.content = n.content
    } else {
      form.title = ''
      form.content = ''
    }
  },
  { immediate: true }
)

const loading = ref(false)

async function submit() {
  const title = (props.externalTitle !== undefined && props.externalTitle !== null ? props.externalTitle : form.title).trim() || 'Untitled'
  const content = form.content ?? ''
  loading.value = true
  try {
    if (props.note) {
      const res = await $fetch<NoteResponse>(`/api/notes/${props.note._id}`, {
        method: 'PUT',
        body: { title, content },
      })
      if (res.success && res.data) emit('saved', res.data)
    } else {
      const res = await $fetch<NoteResponse>('/api/notes', {
        method: 'POST',
        body: { title, content },
      })
      if (res.success && res.data) emit('saved', res.data)
    }
  } finally {
    loading.value = false
  }
}
</script>
