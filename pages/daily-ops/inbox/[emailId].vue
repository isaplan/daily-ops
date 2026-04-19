<template>
  <InboxPageShell
    title="Email detail"
    description="Metadata, attachments, and processing."
  >
    <UButton variant="ghost" icon="i-lucide-arrow-left" to="/daily-ops/inbox/emails" class="mb-2">
      Back to list
    </UButton>

    <UAlert v-if="error" color="error" :title="String(error)" />

    <div v-else-if="pending" class="space-y-3">
      <USkeleton class="h-32 w-full rounded-lg" />
    </div>

    <template v-else-if="email">
      <UCard class="border-2 border-gray-900 bg-white">
        <template #header>
          <h2 class="text-lg font-semibold">{{ email.subject }}</h2>
          <p class="text-sm text-gray-500">{{ email.from }}</p>
        </template>
        <dl class="grid gap-2 text-sm md:grid-cols-2">
          <div><span class="text-gray-500">Status</span> {{ email.status }}</div>
          <div><span class="text-gray-500">Received</span> {{ formatDate(String(email.receivedAt)) }}</div>
          <div><span class="text-gray-500">Message ID</span> <span class="font-mono text-xs">{{ email.messageId }}</span></div>
        </dl>
        <p v-if="email.summary" class="mt-4 text-gray-700">{{ email.summary }}</p>

        <div class="mt-6 flex flex-wrap gap-2">
          <UButton :loading="processing" icon="i-lucide-cog" @click="onProcess">
            Process attachments
          </UButton>
        </div>
      </UCard>

      <UCard v-if="attachments?.length" class="border-2 border-gray-900 bg-white">
        <template #header>
          <h3 class="font-semibold">Attachments</h3>
        </template>
        <ul class="divide-y divide-gray-100">
          <li v-for="att in attachments" :key="att._id" class="py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="font-medium">{{ att.fileName }}</p>
                <p class="text-xs text-gray-500">
                  {{ att.documentType }} · {{ att.parseStatus }} · {{ att.fileSize }} bytes
                </p>
                <p v-if="att.parseError" class="text-xs text-red-600">{{ att.parseError }}</p>
              </div>
            </div>
          </li>
        </ul>
      </UCard>
    </template>
  </InboxPageShell>
</template>

<script setup lang="ts">
import type { EmailAttachmentDoc, InboxEmailDoc } from '~/types/inbox'

const route = useRoute()
const toast = useToast()
const api = useInboxApi()

const emailId = computed(() => String(route.params.emailId))

const { data, pending, error, refresh } = await useAsyncData(
  () => `inbox-email-${emailId.value}`,
  () => api.getEmail(emailId.value),
  { watch: [emailId] },
)

const email = computed(() => {
  const d = data.value?.data
  if (!d) return null
  const { attachments: _a, ...rest } = d
  return rest as unknown as InboxEmailDoc
})

const attachments = computed(() => data.value?.data?.attachments as EmailAttachmentDoc[] | undefined)

const processing = ref(false)

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function onProcess() {
  processing.value = true
  try {
    const r = await api.processEmail(emailId.value)
    if (r.success) {
      toast.add({ title: 'Processing finished' })
      await refresh()
    }
  } catch (e) {
    toast.add({
      title: 'Processing failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    processing.value = false
  }
}
</script>
