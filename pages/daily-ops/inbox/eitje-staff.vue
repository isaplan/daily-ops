<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto max-w-6xl">
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Eitje — Staff</h1>
          <p class="mt-2 text-gray-600">
            Contract rows from <span class="font-mono text-gray-800">inbox-eitje-contracts</span>, matched to
            <span class="font-semibold">members</span> where possible.
          </p>
          <NuxtLink
            class="mt-2 inline-block text-sm font-medium text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
            to="/daily-ops/inbox"
          >
            ← Inbox home
          </NuxtLink>
        </div>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Total staff</span>
          </template>
          <p class="text-3xl font-bold tabular-nums">
            {{ summary ? summary.total_staff : '—' }}
          </p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Matched</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-emerald-700">
            {{ summary ? summary.matched : '—' }}
          </p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Unmatched</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-amber-700">
            {{ summary ? summary.unmatched : '—' }}
          </p>
        </UCard>
      </div>

      <div
        v-if="!loading && rows.length === 0 && !loadError"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-gray-600">
          No contract rows in <span class="font-mono">inbox-eitje-contracts</span> yet. Sync inbox and process a contract
          CSV.
        </p>
      </div>

      <div
        v-if="rows.length > 0 || loading"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center gap-2 text-gray-700">
          <UIcon name="i-lucide-filter" class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span class="text-sm font-semibold">Filters</span>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Contract location</label>
            <USelectMenu
              v-model="filterLocation"
              :items="locationOptions"
              value-attribute="value"
              class="w-full"
              @update:model-value="applyFilters"
            />
          </div>
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Search</label>
            <UInput v-model="searchInput" class="w-full" placeholder="Name, support id…" @keyup.enter="applyFilters" />
          </div>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="clearFilters">Clear</UButton>
          <UButton color="neutral" variant="solid" :loading="loading" @click="applyFilters">Apply</UButton>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-12">
        <p class="text-lg text-gray-600">Loading staff…</p>
      </div>

      <div v-else-if="loadError" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
        <p class="text-red-800">{{ loadError }}</p>
      </div>

      <div v-else-if="rows.length > 0" class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 font-medium">Name</th>
                <th class="px-4 py-3 font-medium">Contract</th>
                <th class="px-4 py-3 font-medium">Location</th>
                <th class="px-4 py-3 font-medium">Start → end</th>
                <th class="px-4 py-3 text-right font-medium">€/h</th>
                <th class="px-4 py-3 text-right font-medium">Cost/h</th>
                <th class="px-4 py-3 font-mono text-xs font-medium text-gray-500">Support</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in rows"
                :key="`${r.support_ids.join('-')}-${i}`"
                class="border-b border-gray-100 last:border-0"
              >
                <td class="px-4 py-3">
                  <UBadge
                    :color="r.match_confidence === 'high' ? 'success' : r.match_confidence === 'medium' ? 'warning' : 'neutral'"
                    variant="subtle"
                  >
                    {{ statusLabel(r.match_confidence) }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ r.employee_name }}</td>
                <td class="px-4 py-3 text-gray-700">{{ r.contract_type }}</td>
                <td class="px-4 py-3 text-gray-700">{{ r.contract_location }}</td>
                <td class="px-4 py-3 text-gray-600">
                  <span class="whitespace-nowrap">{{ r.startdatum ?? '—' }}</span>
                  <span class="mx-1">→</span>
                  <span class="whitespace-nowrap">{{ r.einddatum ?? '—' }}</span>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.hourly_rate) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.cost_per_hour) }}</td>
                <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ r.support_ids.join(', ') }}</td>
                <td class="px-4 py-3 text-right">
                  <UButton
                    v-if="r.matched_member_id"
                    size="xs"
                    variant="outline"
                    color="neutral"
                    :to="`/members/${r.matched_member_id}`"
                    class="border-gray-900 font-semibold"
                  >
                    View member
                  </UButton>
                  <UButton v-else size="xs" variant="solid" color="neutral" class="font-semibold" @click="openCreate(r)">
                    Create member
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pagination && pagination.total > pageSize" class="flex justify-center border-t border-gray-100 p-4">
          <UPagination
            :page="page"
            :total="pagination.total"
            :items-per-page="pageSize"
            @update:page="
              (p) => {
                page = p
                load()
              }
            "
          />
        </div>
      </div>

      <UModal v-model="createOpen">
        <UCard class="w-full max-w-lg">
          <template #header>
            <h3 class="text-base font-semibold text-gray-900">Create member from Eitje</h3>
          </template>

          <div v-if="createTarget" class="grid gap-4 py-4">
            <UFormField label="Name">
              <UInput :model-value="createTarget.employee_name" disabled class="w-full" />
            </UFormField>
            <UFormField label="Support ID">
              <UInput :model-value="createTarget.support_ids.join(', ')" disabled class="w-full font-mono text-sm" />
            </UFormField>
            <UFormField label="Email (optional)">
              <UInput v-model="createForm.email" type="email" class="w-full" placeholder="personal@…" />
            </UFormField>
            <UFormField label="Location">
              <USelectMenu
                v-model="createForm.location_id"
                :items="locationSelectOptions"
                value-key="value"
                class="w-full"
                @update:model-value="createForm.team_id = ''"
              />
            </UFormField>
            <UFormField label="Team">
              <USelectMenu v-model="createForm.team_id" :items="filteredTeamOptionsCreate" value-key="value" class="w-full" />
            </UFormField>
            <p v-if="createError" class="text-sm text-red-600">{{ createError }}</p>
          </div>

          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton variant="outline" color="neutral" @click="createOpen = false">Cancel</UButton>
              <UButton :loading="createSaving" class="font-semibold" @click="submitCreate">Create</UButton>
            </div>
          </template>
        </UCard>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
const FILTER_ALL = '__all__'

type MatchConfidence = 'high' | 'medium' | 'none'

type StaffRow = {
  support_ids: string[]
  employee_name: string
  contract_type: string
  contract_location: string
  startdatum: string | null
  einddatum: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  matched_member_id?: string
  match_confidence: MatchConfidence
}

type LocationItem = { _id: string; name: string }
type TeamItem = { _id: string; name: string; location_id: string }

const toast = useToast()
const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<StaffRow[]>([])
const summary = ref<{
  total_staff: number
  matched: number
  unmatched: number
  distinct_contract_locations?: string[]
} | null>(null)
const pagination = ref<{ skip: number; limit: number; total: number } | null>(null)

const page = ref(1)
const pageSize = 25
const searchInput = ref('')
const searchActive = ref('')
const filterLocation = ref<string>(FILTER_ALL)

const locationOptions = computed(() => [
  { label: 'All locations', value: FILTER_ALL },
  ...(summary.value?.distinct_contract_locations ?? []).map((name: string) => ({
    label: name,
    value: name.toLowerCase(),
  })),
])

const locationSelectOptions = computed(() => [
  { label: 'None', value: '' },
  ...locations.value.map((l: LocationItem) => ({ label: l.name, value: l._id })),
])

function statusLabel(c: MatchConfidence): string {
  if (c === 'high') return 'Matched'
  if (c === 'medium') return 'Matched'
  return 'Unmatched'
}

function money(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `€${n.toFixed(2)}`
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const skip = (page.value - 1) * pageSize
    const locQ = filterLocation.value === FILTER_ALL ? '' : filterLocation.value
    const q: Record<string, string> = {
      skip: String(skip),
      limit: String(pageSize),
    }
    if (searchActive.value.trim()) q.search = searchActive.value.trim()
    if (locQ) q.location = locQ
    const params = new URLSearchParams(q).toString()
    const res = await $fetch<{
      success: boolean
      data: StaffRow[]
      summary: {
        total_staff: number
        matched: number
        unmatched: number
        distinct_contract_locations?: string[]
      }
      pagination: { skip: number; limit: number; total: number }
    }>(`/api/daily-ops/eitje-staff?${params}`)
    if (!res.success) throw new Error('Failed to load staff')
    rows.value = res.data
    summary.value = res.summary
    pagination.value = res.pagination
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    rows.value = []
    summary.value = null
    pagination.value = null
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  searchActive.value = searchInput.value
  page.value = 1
  load()
}

function clearFilters() {
  searchInput.value = ''
  searchActive.value = ''
  filterLocation.value = FILTER_ALL
  page.value = 1
  load()
}

const { data: locationsData } = useFetch<{ success: boolean; data: LocationItem[] }>('/api/locations')
const { data: teamsData } = useFetch<{ success: boolean; data: TeamItem[] }>('/api/teams')
const locations = computed(() => locationsData.value?.data ?? [])
const teams = computed(() => teamsData.value?.data ?? [])

const filteredTeamOptionsCreate = computed(() => {
  const locId = createForm.location_id
  const list = locId ? teams.value.filter((t: TeamItem) => t.location_id === locId) : teams.value
  return [{ label: 'None', value: '' }, ...list.map((t: TeamItem) => ({ label: t.name, value: t._id }))]
})

const createOpen = ref(false)
const createSaving = ref(false)
const createError = ref('')
const createTarget = ref<StaffRow | null>(null)
const createForm = reactive({
  email: '',
  location_id: '',
  team_id: '',
})

function openCreate(r: StaffRow) {
  if (!r.support_ids || r.support_ids.length === 0) {
    toast.add({ title: 'Missing support id', color: 'warning' })
    return
  }
  createTarget.value = r
  createForm.email = ''
  createForm.location_id = ''
  createForm.team_id = ''
  createError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  const t = createTarget.value
  if (!t?.support_ids || t.support_ids.length === 0) return
  createSaving.value = true
  createError.value = ''
  try {
    const payload = {
      employee_name: t.employee_name,
      support_id: t.support_ids[0],
      contract_type: t.contract_type,
      hourly_rate: t.hourly_rate ?? undefined,
      email: createForm.email.trim() || undefined,
      location_id: createForm.location_id || undefined,
      team_id: createForm.team_id || undefined,
    }
    const res = await fetch('/api/daily-ops/eitje-staff/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json()) as { success?: boolean; statusMessage?: string }
    if (!res.ok || !json?.success) {
      createError.value =
        typeof json.statusMessage === 'string' && json.statusMessage
          ? json.statusMessage
          : `Request failed (${res.status})`
      return
    }
    toast.add({ title: 'Member created', color: 'success' })
    createOpen.value = false
    await load()
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' && e !== null && 'data' in e
        ? JSON.stringify((e as { data?: unknown }).data)
        : e instanceof Error
          ? e.message
          : String(e)
    createError.value = msg
  } finally {
    createSaving.value = false
  }
}

onMounted(() => {
  load()
})
</script>
