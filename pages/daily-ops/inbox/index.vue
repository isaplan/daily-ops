<template>
  <InboxPageShell
    title="Inbox"
    description="Sync from Gmail, process attachments, and review imported documents."
  >
    <div class="space-y-8">
    <div class="flex w-full flex-wrap items-center justify-between gap-4">
      <div
        class="inline-flex flex-wrap items-center gap-2 rounded-md border-2 border-gray-900 bg-white p-1.5 shadow-[2px_2px_0_0_rgba(0,0,0,0.08)]"
      >
        <UButton
          variant="solid"
          size="md"
          :color="gmailConnected ? 'success' : 'neutral'"
          :icon="gmailConnected ? 'i-lucide-check' : 'i-lucide-lock-open'"
          class="gap-2.5 px-5 py-2.5 font-semibold"
          @click="onConnectGmail"
        >
          {{ gmailConnected ? 'Connected Gmail' : 'Connect Gmail' }}
        </UButton>
        <UButton
          variant="solid"
          color="neutral"
          size="md"
          :loading="syncing"
          icon="i-lucide-refresh-cw"
          class="gap-2.5 px-5 py-2.5 font-semibold"
          @click="onSync"
        >
          Sync Gmail
        </UButton>
        <UButton
          variant="solid"
          color="neutral"
          size="md"
          :loading="processingAll"
          icon="i-lucide-sparkles"
          class="gap-2.5 px-5 py-2.5 font-semibold"
          @click="onProcessAll"
        >
          Process all
        </UButton>
      </div>

      <UDropdown
        v-if="isAdmin"
        :popper="{ placement: 'bottom-end' }"
        :items="[[{ label: 'Gmail Credentials', slot: 'credentials' }]]"
      >
        <UButton
          icon="i-lucide-info"
          color="neutral"
          variant="ghost"
          size="md"
          class="shrink-0 rounded-md px-3 py-2"
          aria-label="Gmail credentials"
        />

        <template #credentials>
          <div class="min-w-max px-4 py-3 space-y-2 text-sm">
            <div>
              <span class="text-gray-500">Gmail Address:</span>
              <div class="flex items-center gap-2">
                <code class="text-xs">inboxhaagsenieuwehorecagroep@gmail.com</code>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  @click="copyToClipboard('inboxhaagsenieuwehorecagroep@gmail.com')"
                />
              </div>
            </div>
            <div>
              <span class="text-gray-500">Password:</span>
              <div class="flex items-center gap-2">
                <code class="text-xs">@HN-hg#Jan-2026</code>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-copy"
                  @click="copyToClipboard('@HN-hg#Jan-2026')"
                />
              </div>
            </div>
          </div>
        </template>
      </UDropdown>
    </div>

    <div class="grid gap-6 md:grid-cols-3 md:gap-8">
      <UCard class="border-2 border-gray-900 bg-white">
        <template #header>
          <span class="text-sm font-medium text-gray-500">Unprocessed attachments</span>
        </template>
        <p class="text-3xl font-bold tabular-nums">
          {{ unprocessed == null ? '—' : unprocessed }}
        </p>
      </UCard>
      <UCard class="border-2 border-gray-900 bg-white">
        <template #header>
          <span class="text-sm font-medium text-gray-500">Total emails (loaded)</span>
        </template>
        <p class="text-3xl font-bold tabular-nums">
          {{ list?.data?.total ?? '—' }}
        </p>
      </UCard>
      <UCard class="border-2 border-gray-900 bg-white">
        <template #header>
          <span class="text-sm font-medium text-gray-500">Quick links</span>
        </template>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <UButton
            to="/daily-ops/inbox/eitje-hours"
            variant="outline"
            color="neutral"
            block
            class="justify-center border-2 border-gray-900 font-semibold"
          >
            Eitje hours
          </UButton>
          <UButton
            to="/daily-ops/inbox/bork-sales"
            variant="outline"
            color="neutral"
            block
            class="justify-center border-2 border-gray-900 font-semibold"
          >
            Bork sales
          </UButton>
          <UButton
            :to="{ path: '/daily-ops/inbox', hash: '#recent-emails' }"
            variant="outline"
            color="neutral"
            block
            class="justify-center border-2 border-gray-900 font-semibold"
          >
            All emails
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            block
            class="justify-center border-2 border-gray-900 font-semibold"
            @click="onSync"
          >
            Sync inbox
          </UButton>
        </div>
      </UCard>
    </div>

    <UCard id="recent-emails" class="scroll-mt-8 border-2 border-gray-900 bg-white">
      <template #header>
        <h2 class="font-semibold text-gray-900">Recent emails</h2>
        <p class="text-sm text-gray-500">Latest five non-archived messages</p>
      </template>

      <UAlert v-if="listError" color="error" :title="String(listError)" />

      <div v-else-if="listPending" class="space-y-2">
        <USkeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
      </div>

      <ul v-else-if="recent.length" class="divide-y divide-gray-100">
        <li v-for="e in recent" :key="e._id" class="flex flex-wrap items-center justify-between gap-2 py-3">
          <div class="min-w-0">
            <p class="font-medium text-gray-900">
              {{ e.subject || '(No subject)' }}
            </p>
            <p class="truncate text-sm text-gray-500">{{ e.from }} · {{ formatDate(e.receivedAt) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <UBadge :color="statusColor(e.status)">{{ e.status }}</UBadge>
            <UButton size="xs" variant="outline" @click="processOne(e._id)">
              Process
            </UButton>
          </div>
        </li>
      </ul>

      <p v-else class="text-gray-500">No emails yet. Run sync after configuring Gmail credentials.</p>
    </UCard>
    </div>
  </InboxPageShell>
</template>

<script setup lang="ts">
import type { InboxEmailDoc } from '~/types/inbox'

const toast = useToast()
const api = useInboxApi()

const unprocessed = ref<number | null>(null)
const syncing = ref(false)
const processingAll = ref(false)
const gmailConnected = ref(false)
const isAdmin = ref(false)

const { data: list, pending: listPending, error: listError, refresh: refreshList } = await useAsyncData(
  'inbox-dashboard-list',
  () => api.listEmails(1, 5, { archived: false }),
)

const recent = computed(() => list.value?.data?.emails ?? [])

onMounted(async () => {
  try {
    const r = await api.getUnprocessedCount()
    if (r.success) unprocessed.value = r.data.count
  } catch {
    unprocessed.value = 0
  }

  try {
    const status = await $fetch<{ success: boolean; data: { connected: boolean } }>(
      '/api/inbox/gmail-status',
    )
    if (status.success) gmailConnected.value = status.data.connected
  } catch {
    gmailConnected.value = false
  }

  const q = useRoute().query
  if (q.connected === 'gmail') {
    gmailConnected.value = true
    toast.add({
      title: 'Gmail connected!',
      description: 'Your refresh token is stored. Cron can now sync emails.',
      color: 'success',
    })
  } else if (q.error) {
    toast.add({
      title: 'Gmail connection failed',
      description: `${q.error}${q.message ? ': ' + q.message : ''}`,
      color: 'error',
    })
  }

  isAdmin.value = true
})

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function statusColor(status: InboxEmailDoc['status']) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'processing') return 'warning'
  return 'neutral'
}

async function onSync() {
  syncing.value = true
  try {
    const r = await api.syncEmails({ maxResults: 50 })
    if (r.success) {
      toast.add({ title: `Synced ${r.data.emailsCreated} new email(s)` })
      await refreshList()
      const u = await api.getUnprocessedCount()
      if (u.success) unprocessed.value = u.data.count
    }
  } catch (e) {
    toast.add({
      title: 'Sync failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    syncing.value = false
  }
}

async function onProcessAll() {
  processingAll.value = true
  try {
    const r = await api.processAll({ maxEmails: 50 })
    if (r.success) {
      toast.add({ title: r.data.message || 'Process all finished' })
      await refreshList()
      const u = await api.getUnprocessedCount()
      if (u.success) unprocessed.value = u.data.count
    }
  } catch (e) {
    toast.add({
      title: 'Process all failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  } finally {
    processingAll.value = false
  }
}

async function processOne(id: string) {
  try {
    const r = await api.processEmail(id)
    if (r.success) {
      toast.add({ title: 'Processing complete' })
      await refreshList()
      const u = await api.getUnprocessedCount()
      if (u.success) unprocessed.value = u.data.count
    }
  } catch (e) {
    toast.add({
      title: 'Process failed',
      description: e instanceof Error ? e.message : 'Unknown error',
      color: 'error',
    })
  }
}

function onConnectGmail() {
  window.location.href = '/api/auth/gmail/authorize'
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied!' })
}
</script>
