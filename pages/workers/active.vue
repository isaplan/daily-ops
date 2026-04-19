<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Active Workers</h1>
      <p class="text-gray-500">Workers ready to be invited to use the app</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-gray-500">Loading workers...</div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-800">{{ error }}</p>
    </div>

    <template v-else>
      <div class="grid gap-4 md:grid-cols-3">
        <UCard>
          <template #header>
            <span class="text-sm font-medium">Total Active Workers</span>
          </template>
          <p class="text-3xl font-bold">{{ workers.length }}</p>
        </UCard>
        <UCard>
          <template #header>
            <span class="text-sm font-medium">With Emails</span>
          </template>
          <p class="text-3xl font-bold">{{ workers.filter(w => w.email).length }}</p>
        </UCard>
        <UCard>
          <template #header>
            <span class="text-sm font-medium">Ready to Invite</span>
          </template>
          <p class="text-3xl font-bold text-green-600">{{ workers.length }}</p>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Export Options</h2>
        </template>
        <div class="flex gap-2">
          <UButton @click="downloadCSV" icon="i-lucide-download">
            Download CSV for Email
          </UButton>
          <UButton variant="outline" @click="copyEmails" icon="i-lucide-copy">
            Copy All Emails
          </UButton>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Active Workers</h2>
          <p class="text-sm text-gray-500">{{ workers.length }} worker(s) ready to invite</p>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 pr-4 font-medium">Name</th>
                <th class="pb-2 pr-4 font-medium">Email</th>
                <th class="pb-2 pr-4 font-medium">Contract Type</th>
                <th class="pb-2 pr-4 font-medium">Contract End</th>
                <th class="pb-2 pr-4 font-medium text-right">Hourly Rate</th>
                <th class="pb-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="worker in workers" :key="worker._id" class="border-b last:border-0 hover:bg-gray-50">
                <td class="py-2 pr-4 font-medium">{{ worker.name }}</td>
                <td class="py-2 pr-4 text-blue-600">{{ worker.email }}</td>
                <td class="py-2 pr-4">
                  <span class="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                    {{ worker.contractType || 'N/A' }}
                  </span>
                </td>
                <td class="py-2 pr-4">{{ formatDate(worker.contractEndDate) }}</td>
                <td class="py-2 pr-4 text-right font-mono">€{{ worker.hourlyRate.toFixed(2) }}</td>
                <td class="py-2 text-right">
                  <UButton size="xs" variant="outline" @click="copyEmail(worker.email)">
                    Copy
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Contract Type Breakdown</h2>
        </template>
        <div class="space-y-2">
          <div v-for="(count, type) in contractTypeCounts" :key="type" class="flex items-center justify-between">
            <span class="text-sm">{{ type || 'Unknown' }}</span>
            <span class="font-medium">{{ count }} workers</span>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Active Workers' })

interface Worker {
  _id: string
  name: string
  email: string
  contractType: string
  contractStartDate: string | null
  contractEndDate: string | null
  hourlyRate: number
  phone: string
}

const workers = ref<Worker[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const contractTypeCounts = computed(() => {
  const counts: Record<string, number> = {}
  workers.value.forEach(w => {
    const type = w.contractType || 'Unknown'
    counts[type] = (counts[type] || 0) + 1
  })
  return counts
})

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-NL')
}

function downloadCSV() {
  const headers = ['Name', 'Email', 'Contract Type', 'Contract Start', 'Contract End', 'Hourly Rate']
  const rows = workers.value.map(w => [
    w.name,
    w.email,
    w.contractType,
    formatDate(w.contractStartDate),
    formatDate(w.contractEndDate),
    `€${w.hourlyRate.toFixed(2)}`,
  ])

  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(c => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `active-workers-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

function copyEmails() {
  const emails = workers.value.map(w => w.email).join('; ')
  navigator.clipboard.writeText(emails).then(() => {
    useToast().add({
      title: 'Copied',
      description: `${workers.value.length} email addresses copied to clipboard`,
      color: 'green',
    })
  })
}

function copyEmail(email: string) {
  navigator.clipboard.writeText(email).then(() => {
    useToast().add({
      title: 'Copied',
      description: email,
      color: 'green',
    })
  })
}

onMounted(async () => {
  try {
    const res = await $fetch<{ success: boolean; data: Worker[] }>('/api/workers/active')
    if (res.success) {
      workers.value = res.data || []
    } else {
      error.value = 'Failed to load workers'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch workers'
  } finally {
    loading.value = false
  }
})
</script>
