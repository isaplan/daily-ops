<script setup lang="ts">
import { ref, computed } from 'vue'

type DetailView = 'hourly' | 'worker' | 'table' | 'product'

const getYesterdayDate = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const selectedDate = ref<string>(getYesterdayDate())
const detailView = ref<DetailView>('hourly')
const selectedLocation = ref<'all' | string>('all')

const locations = ['all', 'Bar Bea', 'Van Kinsbergen', 'l\'Amour Toujours']

const last7Days = computed(() => {
  const days = []
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${i}d ago`
    const dayName = dayNames[d.getDay()]
    days.push({ date: dateStr, label, dayName })
  }
  return days
})

const businessDayStart = computed(() => {
  const d = new Date(selectedDate.value)
  d.setHours(8, 0, 0, 0)
  return d
})

const businessDayEnd = computed(() => {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  d.setHours(8, 0, 0, 0)
  return d
})

const { data: dayData, pending, error, refresh } = await useFetch('/api/bork/v2/day-breakdown-v2', {
  query: computed(() => ({
    date: selectedDate.value,
    location: selectedLocation.value,
  })),
})

const summary = computed(() => {
  if (!dayData.value?.hourly) return null
  return {
    totalRevenue: dayData.value.hourly.reduce((sum: number, h: any) => sum + (h.total_revenue || 0), 0),
    totalQuantity: dayData.value.hourly.reduce((sum: number, h: any) => sum + (h.total_quantity || 0), 0),
    workerCount: new Set(dayData.value.worker?.map((w: any) => w.workerId)).size || 0,
    tableCount: new Set(dayData.value.table?.map((t: any) => t.tableNumber)).size || 0,
    productCount: dayData.value.product?.length || 0,
  }
})

const verification = computed(() => {
  if (!dayData.value?.hourly) return null
  const hourlyTotal = dayData.value.hourly.reduce((sum: number, h: any) => sum + (h.total_revenue || 0), 0)
  const workerTotal = dayData.value.worker?.reduce((sum: number, w: any) => sum + (w.total_revenue || 0), 0) || 0
  const tableTotal = dayData.value.table?.reduce((sum: number, t: any) => sum + (t.total_revenue || 0), 0) || 0
  const productTotal = dayData.value.product?.reduce((sum: number, p: any) => sum + (p.total_revenue || 0), 0) || 0
  return {
    hourlyTotal,
    workerTotal,
    tableTotal,
    productTotal,
    allMatch: hourlyTotal === workerTotal && workerTotal === tableTotal && tableTotal === productTotal,
    discrepancies: [
      { name: 'Hourly vs Worker', match: hourlyTotal === workerTotal, diff: Math.abs(hourlyTotal - workerTotal) },
      { name: 'Hourly vs Table', match: hourlyTotal === tableTotal, diff: Math.abs(hourlyTotal - tableTotal) },
      { name: 'Hourly vs Product', match: hourlyTotal === productTotal, diff: Math.abs(hourlyTotal - productTotal) },
    ],
  }
})

const formatEur = (value: number | null) => {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Day Breakdown (V2)</h1>
      <p class="text-gray-500">Verify V2 revenue calculations across all dimensions (hourly, worker, table, product)</p>
    </div>

    <UCard v-if="error" class="border-red-200">
      <p class="text-red-600"><strong>Error:</strong> {{ error }}</p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Filters</h2>
      </template>
      <div class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium">Business Day Period</label>
            <p class="text-sm text-gray-600 pt-2">
              {{ formatDate(businessDayStart) }} → {{ formatDate(businessDayEnd) }}
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <div v-if="pending" class="grid gap-4 md:grid-cols-5">
      <USkeleton v-for="i in 5" :key="i" class="h-24 w-full rounded-lg" />
    </div>

    <template v-else-if="summary && verification">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <UButton
          v-for="loc in locations"
          :key="loc"
          class="border-2 border-gray-900 !bg-white !text-gray-900 h-full transition-all"
          :class="selectedLocation === loc ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'"
          @click="selectedLocation = loc; refresh()"
        >
          {{ loc === 'all' ? 'All Locations' : loc }}
        </UButton>
      </div>

      <div class="flex gap-2 flex-wrap items-center">
        <UButton
          v-for="(day, idx) in last7Days"
          :key="idx"
          class="border-2 border-gray-900 !bg-white !text-gray-900 transition-all flex flex-col items-center justify-center"
          :class="selectedDate === day.date ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-md'"
          size="sm"
          @click="selectedDate = day.date; refresh()"
        >
          <span>{{ day.label }}</span>
          <span class="text-xs text-gray-500 mt-0.5">{{ day.dayName }}</span>
          <span class="text-xs text-gray-400">{{ day.date }}</span>
        </UButton>
        <div class="flex gap-2 items-center">
          <span class="text-sm text-gray-600">or</span>
          <UInput
            v-model="selectedDate"
            type="date"
            size="sm"
            class="w-40"
            @update:model-value="refresh"
          />
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <UCard class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg" :class="detailView === 'hourly' ? 'ring-2 ring-blue-500' : ''" @click="detailView = 'hourly'">
          <template #header><span class="text-sm font-medium">Total Revenue</span></template>
          <p class="text-2xl font-bold text-gray-900">{{ formatEur(summary.totalRevenue) }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ summary.totalQuantity }} items</p>
        </UCard>
        <UCard class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg" :class="detailView === 'hourly' ? 'ring-2 ring-blue-500' : ''" @click="detailView = 'hourly'">
          <template #header><span class="text-sm font-medium">Hourly</span></template>
          <p class="text-2xl font-bold text-gray-900">{{ formatEur(verification.hourlyTotal) }}</p>
          <p class="mt-1 text-xs" :class="verification.hourlyTotal === summary.totalRevenue ? 'text-green-600' : 'text-red-600'">
            {{ verification.hourlyTotal === summary.totalRevenue ? '✓ Matches' : '✗ Mismatch' }}
          </p>
        </UCard>
        <UCard class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg" :class="detailView === 'worker' ? 'ring-2 ring-blue-500' : ''" @click="detailView = 'worker'">
          <template #header><span class="text-sm font-medium">Workers</span></template>
          <p class="text-2xl font-bold text-gray-900">{{ formatEur(verification.workerTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">{{ summary.workerCount }} workers</p>
        </UCard>
        <UCard class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg" :class="detailView === 'table' ? 'ring-2 ring-blue-500' : ''" @click="detailView = 'table'">
          <template #header><span class="text-sm font-medium">Tables</span></template>
          <p class="text-2xl font-bold text-gray-900">{{ formatEur(verification.tableTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">{{ summary.tableCount }} tables</p>
        </UCard>
        <UCard class="cursor-pointer border-2 border-gray-900 !bg-white ring-0 shadow-none transition-all hover:shadow-lg" :class="detailView === 'product' ? 'ring-2 ring-blue-500' : ''" @click="detailView = 'product'">
          <template #header><span class="text-sm font-medium">Products</span></template>
          <p class="text-2xl font-bold text-gray-900">{{ formatEur(verification.productTotal) }}</p>
          <p class="mt-1 text-xs text-gray-600">{{ summary.productCount }} products</p>
        </UCard>
      </div>

      <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">
            Verification
            <span :class="verification.allMatch ? 'text-green-600' : 'text-red-600'">
              {{ verification.allMatch ? '✓ All Match' : '✗ Discrepancies Found' }}
            </span>
          </h2>
        </template>
        <div class="space-y-2">
          <div v-for="check in verification.discrepancies" :key="check.name" class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <span class="text-sm font-medium text-gray-700">{{ check.name }}</span>
            <span :class="check.match ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'">
              {{ check.match ? '✓ Match' : `✗ Diff: ${formatEur(check.diff)}` }}
            </span>
          </div>
        </div>
      </UCard>

      <UCard class="border-2 border-gray-900 !bg-white ring-0 shadow-none">
        <template #header>
          <h2 class="text-lg font-semibold text-gray-900">
            {{ detailView === 'hourly' ? 'Hourly Breakdown' : detailView === 'worker' ? 'Worker Breakdown' : detailView === 'table' ? 'Table Breakdown' : 'Product Breakdown' }}
          </h2>
        </template>

        <div v-if="detailView === 'hourly'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Hour</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Quantity</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Avg Per Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hour in dayData?.hourly" :key="hour._id" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-2 text-gray-900">{{ String(hour.business_hour ?? hour.hour ?? 0).padStart(2, '0') }}:00</td>
                <td class="px-4 py-2 text-right font-semibold text-gray-900">{{ formatEur(hour.total_revenue) }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ hour.total_quantity }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ formatEur((hour.total_revenue || 0) / (hour.total_quantity || 1)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="detailView === 'worker'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Worker</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Avg Per Item</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="worker in dayData?.worker" :key="worker._id" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-2 text-gray-900">{{ worker.workerName }}</td>
                <td class="px-4 py-2 text-right font-semibold text-gray-900">{{ formatEur(worker.total_revenue) }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ worker.total_quantity }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ formatEur((worker.total_revenue || 0) / (worker.total_quantity || 1)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="detailView === 'table'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Table</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Items</th>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Products</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="table in dayData?.table" :key="table._id" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-2 text-gray-900 font-semibold">{{ table.tableNumber || 'Guest' }}</td>
                <td class="px-4 py-2 text-right font-semibold text-gray-900">{{ formatEur(table.total_revenue) }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ table.total_quantity }}</td>
                <td class="px-4 py-2 text-gray-600 text-xs">{{ table.products ? Object.keys(table.products).length : 0 }} items</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="detailView === 'product'" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-gray-200 bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-700">Product</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Revenue</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Quantity</th>
                <th class="px-4 py-2 text-right font-medium text-gray-700">Avg Price</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in dayData?.product" :key="product.productId || product._id" class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-2 text-gray-900">{{ product.productName }}</td>
                <td class="px-4 py-2 text-right font-semibold text-gray-900">{{ formatEur(product.total_revenue) }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ product.total_quantity }}</td>
                <td class="px-4 py-2 text-right text-gray-600">{{ formatEur((product.total_revenue || 0) / (product.total_quantity || 1)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>
