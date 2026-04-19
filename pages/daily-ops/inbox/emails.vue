<template>
  <InboxPageShell
    title="Emails"
    description="All messages stored from Gmail or manual upload."
  >
    <UAlert v-if="error" color="error" :title="String(error)" />

    <div v-else-if="pending" class="space-y-2">
      <USkeleton v-for="i in 8" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <UCard v-else class="border-2 border-gray-900 bg-white">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b-2 border-gray-200">
              <th class="px-3 py-2 font-semibold">Subject</th>
              <th class="px-3 py-2 font-semibold">From</th>
              <th class="px-3 py-2 font-semibold">Received</th>
              <th class="px-3 py-2 font-semibold">Status</th>
              <th class="px-3 py-2 font-semibold">Attachments</th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in emails" :key="e._id" class="border-b border-gray-100">
              <td class="max-w-xs truncate px-3 py-2">
                <NuxtLink :to="`/daily-ops/inbox/${e._id}`" class="font-medium text-primary-600 hover:underline">
                  {{ e.subject }}
                </NuxtLink>
              </td>
              <td class="px-3 py-2 text-gray-600">{{ e.from }}</td>
              <td class="px-3 py-2 text-gray-600">{{ formatDate(e.receivedAt) }}</td>
              <td class="px-3 py-2">
                <UBadge>{{ e.status }}</UBadge>
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ e.attachmentStats?.parsed ?? 0 }}/{{ e.attachmentStats?.total ?? 0 }}
              </td>
              <td class="px-3 py-2">
                <UButton size="xs" variant="outline" :to="`/daily-ops/inbox/${e._id}`">
                  Open
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between gap-4">
        <p class="text-sm text-gray-500">
          Page {{ page }} — {{ total }} total
        </p>
        <div class="flex gap-2">
          <UButton variant="outline" :disabled="page <= 1" @click="page--">Previous</UButton>
          <UButton variant="outline" :disabled="!hasMore" @click="page++">Next</UButton>
        </div>
      </div>
    </UCard>
  </InboxPageShell>
</template>

<script setup lang="ts">
const api = useInboxApi()
const page = ref(1)
const limit = 20

const { data, pending, error, refresh } = await useAsyncData(
  () => `inbox-emails-${page.value}`,
  () => api.listEmails(page.value, limit, { archived: false }),
  { watch: [page] },
)

const emails = computed(() => data.value?.data?.emails ?? [])
const total = computed(() => data.value?.data?.total ?? 0)
const hasMore = computed(() => data.value?.data?.hasMore ?? false)

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
</script>
