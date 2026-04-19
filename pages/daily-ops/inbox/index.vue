<template>
  <InboxPageShell
    title="Inbox"
    description="Sync from Gmail, process attachments, and review imported documents."
  >
    <div class="flex flex-wrap gap-3">
      <UButton
        :loading="syncing"
        icon="i-lucide-refresh-cw"
        @click="onSync"
      >
        Sync from Gmail
      </UButton>
      <UButton
        variant="outline"
        :loading="processingAll"
        icon="i-lucide-play"
        @click="onProcessAll"
      >
        Process all
      </UButton>
      <UButton
        variant="outline"
        :loading="watchLoading"
        :icon="watchOn ? 'i-lucide-bell-off' : 'i-lucide-bell'"
        @click="onToggleWatch"
      >
        {{ watchOn ? 'Stop Gmail watch' : 'Start Gmail watch' }}
      </UButton>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
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
        <div class="flex flex-col gap-2 text-sm">
          <NuxtLink to="/daily-ops/inbox/emails" class="text-primary-600 underline">All emails</NuxtLink>
          <NuxtLink to="/daily-ops/inbox/upload" class="text-primary-600 underline">Manual upload</NuxtLink>
        </div>
      </UCard>
    </div>

    <UCard class="border-2 border-gray-900 bg-white">
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
            <NuxtLink
              :to="`/daily-ops/inbox/${e._id}`"
              class="font-medium text-primary-600 hover:underline"
            >
              {{ e.subject || '(No subject)' }}
            </NuxtLink>
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
  </InboxPageShell>
</template>

<script setup lang="ts">
import type { InboxEmailDoc } from '~/types/inbox'

const toast = useToast()
const api = useInboxApi()

const unprocessed = ref<number | null>(null)
const syncing = ref(false)
const processingAll = ref(false)
const watchLoading = ref(false)
const watchOn = ref(false)

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
      color: 'red',
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
      color: 'red',
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
      color: 'red',
    })
  }
}

async function onToggleWatch() {
  watchLoading.value = true
  try {
    if (watchOn.value) {
      await api.stopWatch()
      watchOn.value = false
      toast.add({ title: 'Gmail watch stopped' })
    } else {
      await api.startWatch()
      watchOn.value = true
      toast.add({ title: 'Gmail watch started' })
    }
  } catch (e) {
    toast.add({
      title: 'Watch failed',
      description: e instanceof Error ? e.message : 'Check GMAIL_PUBSUB_TOPIC and credentials',
      color: 'red',
    })
  } finally {
    watchLoading.value = false
  }
}
</script>
