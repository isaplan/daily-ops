<template>
  <InboxPageShell
    title="Upload"
    description="Upload a CSV, Excel, or PDF file. It will be parsed and mapped like email attachments."
  >
    <UCard class="max-w-xl border-2 border-gray-900 bg-white">
      <div class="space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.htm,.html"
          class="block w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
          @change="onFile"
        />
        <div class="flex flex-wrap gap-2">
          <UButton :loading="uploading" :disabled="!file" @click="doUpload">
            Upload &amp; store
          </UButton>
          <UButton variant="outline" :loading="parsing" :disabled="!file" @click="doParseOnly">
            Preview parse only
          </UButton>
        </div>

        <UAlert v-if="parsePreview" color="neutral" variant="subtle">
          <template #title>Parse preview</template>
          <pre class="mt-2 max-h-64 overflow-auto text-xs">{{ parsePreview }}</pre>
        </UAlert>

        <UAlert v-if="uploadResult" color="success" variant="subtle">
          <template #title>Upload result</template>
          <pre class="mt-2 max-h-64 overflow-auto text-xs">{{ uploadResult }}</pre>
        </UAlert>
      </div>
    </UCard>
  </InboxPageShell>
</template>

<script setup lang="ts">
const toast = useToast()
const api = useInboxApi()

const file = ref<File | null>(null)
const uploading = ref(false)
const parsing = ref(false)
const parsePreview = ref('')
const uploadResult = ref('')

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  parsePreview.value = ''
  uploadResult.value = ''
}

async function doUpload() {
  if (!file.value) return
  uploading.value = true
  uploadResult.value = ''
  try {
    const r = await api.uploadFile(file.value)
    uploadResult.value = JSON.stringify(r, null, 2)
    toast.add({ title: 'Upload complete' })
  } catch (e) {
    toast.add({
      title: 'Upload failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    uploading.value = false
  }
}

async function doParseOnly() {
  if (!file.value) return
  parsing.value = true
  parsePreview.value = ''
  try {
    const r = await api.parsePreview(file.value)
    parsePreview.value = JSON.stringify(r, null, 2)
  } catch (e) {
    toast.add({
      title: 'Parse failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    parsing.value = false
  }
}
</script>
