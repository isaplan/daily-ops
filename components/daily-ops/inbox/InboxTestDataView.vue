<template>
  <InboxPageShell :title="title" :description="description">
    <UAlert v-if="error" color="error" :title="String(error)" />

    <div v-else-if="pending" class="space-y-3">
      <USkeleton class="h-10 w-full rounded-lg" />
      <USkeleton class="h-64 w-full rounded-lg" />
    </div>

    <template v-else-if="payload?.success && payload.data">
      <UCard class="border-2 border-gray-900 bg-white">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-medium text-gray-500">Collection</p>
              <p class="font-mono text-sm">{{ payload.data.collectionName }}</p>
              <p class="mt-1 text-xs text-gray-500">
                <span v-if="payload.data.viewMode" class="mr-1 rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                  {{ payload.data.viewMode }}
                </span>
                DB <span class="font-mono text-gray-700">{{ payload.data.mongoDatabase }}</span>
                <span class="text-gray-400"> · </span>
                Parsed inbox files (this type):
                <span class="font-semibold text-gray-700">{{ payload.data.parsedImportCount ?? '—' }}</span>
              </p>
            </div>
            <div class="text-sm text-gray-600">
              {{ payload.data.pagination.total }} row(s)
              <span class="text-gray-400">·</span>
              page {{ page }} / {{ payload.data.pagination.totalPages || 1 }}
            </div>
          </div>
        </template>

        <div v-if="payload.data.rows.length === 0" class="space-y-3 py-8 text-center text-sm text-gray-600">
          <p>No rows in <span class="font-mono text-gray-900">{{ payload.data.collectionName }}</span>.</p>
          <p
            v-if="(payload.data.parsedImportCount ?? 0) > 0 && payload.data.viewMode === 'mapped'"
            class="mx-auto max-w-lg text-amber-900"
          >
            There are {{ payload.data.parsedImportCount }} parsed inbox attachment(s) of this type in
            <span class="font-mono">parseddatas</span>, but nothing was written to the mapped collection. That usually
            means required CSV columns did not match (mapping dropped every row). Use the default
            <span class="font-semibold">attachment</span> view for exact file columns.
          </p>
          <p
            v-else-if="(payload.data.parsedImportCount ?? 0) > 0 && payload.data.viewMode === 'attachment'"
            class="mx-auto max-w-lg text-amber-900"
          >
            Parsed imports exist but no row objects were found (check
            <span class="font-mono">data.rows</span> on parsed documents).
          </p>
          <p v-else-if="(payload.data.parsedImportCount ?? 0) > 0" class="mx-auto max-w-lg text-amber-900">
            There are {{ payload.data.parsedImportCount }} parsed import(s); nothing matched this view yet.
          </p>
          <p v-else class="mx-auto max-w-lg text-gray-500">
            No parsed imports of this type in this database (<span class="font-mono">{{ payload.data.mongoDatabase }}</span>).
            Confirm <span class="font-mono">MONGODB_URI</span> matches the environment where Gmail sync ran, then sync or upload again.
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr class="border-b-2 border-gray-200">
                <th
                  v-for="col in displayColumns"
                  :key="col"
                  class="sticky top-0 bg-white px-3 py-2 font-semibold text-gray-900"
                >
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in payload.data.rows" :key="ri" class="border-b border-gray-100">
                <td
                  v-for="col in displayColumns"
                  :key="col"
                  class="max-w-xs truncate px-3 py-1.5 font-mono text-xs text-gray-800"
                  :title="String(cellValue(rowRecord(row), col))"
                >
                  {{ formatCell(cellValue(rowRecord(row), col)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="payload.data.pagination.totalPages > 1" class="mt-4 flex justify-center gap-2">
          <UButton variant="outline" :disabled="page <= 1" @click="page--">
            Previous
          </UButton>
          <UButton variant="outline" :disabled="!payload.data.pagination.hasMore" @click="page++">
            Next
          </UButton>
        </div>
      </UCard>
    </template>
  </InboxPageShell>
</template>

<script setup lang="ts">
import type { TestDataType } from '~/composables/useInboxApi'

const props = defineProps<{
  testType: TestDataType
  title: string
  description?: string
}>()

const api = useInboxApi()
const route = useRoute()
const page = ref(1)
const limit = 50

const viewFromQuery = computed(() => {
  const v = route.query.view
  return v === 'mapped' ? ('mapped' as const) : undefined
})

const { data: payload, pending, error } = await useAsyncData(
  () => `inbox-test-${props.testType}-${page.value}-${viewFromQuery.value ?? ''}`,
  () => api.fetchTestData(props.testType, page.value, limit, viewFromQuery.value),
  { watch: [page, () => props.testType, viewFromQuery] },
)

const displayColumns = computed(() => payload.value?.data.columns ?? [])

function rowRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
}

function cellValue(row: Record<string, unknown>, col: string): unknown {
  return row[col]
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 200)
  const s = String(v)
  return s.length > 120 ? `${s.slice(0, 117)}…` : s
}
</script>
