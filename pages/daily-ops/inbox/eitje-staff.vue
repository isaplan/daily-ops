<template>
  <div class="min-h-screen bg-gray-50 p-4 sm:p-6">
    <div
      class="mx-auto flex h-[min(88vh,960px)] max-h-[min(88vh,960px)] w-full max-w-[min(100%,1440px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gray-50">
        <div class="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Eitje — Staff</h1>
          <p class="mt-2 text-gray-600">
            Staff profiles from <span class="font-semibold">members</span> (SSOT), enriched with recent Eitje
            activity (last 30 days).
          </p>
          <NuxtLink
            class="mt-2 inline-block text-sm font-medium text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
            to="/daily-ops/inbox"
          >
            ← Inbox home
          </NuxtLink>
        </div>
      </div>

      <div v-if="initialLoading" class="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UCard v-for="i in 4" :key="`sk-${i}`" class="border-2 border-gray-200 bg-white">
          <template #header>
            <span class="inline-block h-4 w-24 animate-pulse rounded bg-gray-200" />
          </template>
          <span class="inline-block h-8 w-16 animate-pulse rounded bg-gray-200" />
        </UCard>
      </div>
      <div v-else class="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <span class="text-sm font-medium text-gray-500">Active (30d)</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-blue-700">
            {{ summary ? summary.with_recent_activity : '—' }}
          </p>
        </UCard>
        <UCard
          v-if="summary && summary.missing_compensation > 0"
          class="border-2 border-red-300 bg-red-50"
        >
          <template #header>
            <span class="text-sm font-medium text-red-800">Missing compensation</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-red-700">
            {{ summary.missing_compensation }}
          </p>
          <p class="mt-1 text-xs text-red-700">Matched members without wage/cost on profile</p>
        </UCard>
      </div>

      <div
        v-if="!initialLoading && missingCompensationRows.length > 0"
        class="mb-6 overflow-hidden rounded-lg border border-red-200 bg-red-50/80 p-4 shadow-sm"
      >
        <h2 class="mb-3 text-sm font-semibold text-red-900">Missing compensation data</h2>
        <p class="mb-3 text-xs text-red-800">
          Linked member profiles missing hourly rate or cost per hour. Re-import contracts or edit the member profile.
        </p>
        <ul class="space-y-2">
          <li
            v-for="(r, i) in missingCompensationRows"
            :key="`missing-${r.matched_member_id}-${i}`"
            class="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-white px-3 py-2 text-sm"
          >
            <span class="font-medium text-gray-900">{{ r.employee_name }}</span>
            <span class="text-xs text-gray-500">{{ r.support_ids.join(', ') || '—' }}</span>
            <UBadge color="error" variant="subtle">Missing data</UBadge>
            <UButton
              v-if="r.matched_member_id"
              size="xs"
              variant="outline"
              @click="openProfile(r.matched_member_id)"
            >
              Open profile
            </UButton>
          </li>
        </ul>
      </div>

      <div
        v-if="!initialLoading && rows.length === 0 && !loadError"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-gray-600">
          No staff with recent Eitje activity or missing profile data. Check members collection and Eitje sync.
        </p>
      </div>

      <div
        v-if="initialLoading || rows.length > 0"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="mb-3 flex items-center gap-2 text-gray-700">
          <UIcon name="i-lucide-filter" class="h-5 w-5 shrink-0" aria-hidden="true" />
          <span class="text-sm font-semibold">Filters</span>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Search</label>
            <UInput v-model="searchInput" class="w-full" placeholder="Name, support id…" @keyup.enter="applyFilters" />
          </div>
          <div class="flex items-center gap-2 pb-1">
            <UCheckbox v-model="onlyMissingData" label="Missing data only" @update:model-value="applyFilters" />
          </div>
          <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" @click="clearFilters">Clear</UButton>
          <UButton color="neutral" variant="solid" :loading="tableBusy" @click="applyFilters">Apply</UButton>
        </div>
      </div>

      <div v-if="initialLoading" class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="space-y-3 p-4">
          <div v-for="i in 8" :key="`row-sk-${i}`" class="h-10 animate-pulse rounded bg-gray-100" />
        </div>
      </div>

      <div v-else-if="loadError" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
        <p class="text-red-800">{{ loadError }}</p>
      </div>

      <div v-else-if="rows.length > 0" class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" :class="tableBusy ? 'opacity-60' : ''">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th class="px-4 py-3 font-medium">Name</th>
                <th class="px-4 py-3 font-medium">Contract</th>
                <th class="px-4 py-3 font-medium">Teams (30d)</th>
                <th class="px-4 py-3 font-medium">Last worked</th>
                <th class="px-4 py-3 text-right font-medium">Hours (30d)</th>
                <th class="px-4 py-3 text-right font-medium">€/h</th>
                <th class="px-4 py-3 text-right font-medium">Cost/h</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in rows"
                :key="`${r.matched_member_id ?? r.employee_name}-${i}`"
                class="border-b border-gray-100 last:border-0"
                :class="
                  r.matched_member_id && r.matched_member_id === profileMemberId
                    ? 'bg-emerald-50/80'
                    : ''
                "
              >
                <td class="px-4 py-3 font-medium text-gray-900">{{ r.employee_name }}</td>
                <td class="px-4 py-3 text-gray-700">{{ r.contract_type || '—' }}</td>
                <td class="px-4 py-3 text-gray-700">{{ r.teams_label || '—' }}</td>
                <td class="px-4 py-3 tabular-nums text-gray-700">{{ r.last_worked || '—' }}</td>
                <td class="px-4 py-3 text-right tabular-nums text-gray-700">{{ r.hours_30d ?? '—' }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.hourly_rate) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.cost_per_hour) }}</td>
                <td class="px-4 py-3">
                  <UBadge
                    v-if="r.compensation_status === 'missing'"
                    color="error"
                    variant="subtle"
                  >
                    Missing data
                  </UBadge>
                  <UBadge
                    v-else
                    :variant="r.match_confidence === 'none' ? 'subtle' : 'solid'"
                    :color="r.match_confidence === 'none' ? 'neutral' : 'neutral'"
                    :class="
                      r.match_confidence !== 'none'
                        ? 'bg-[#228B22]! text-white! ring-0'
                        : ''
                    "
                  >
                    {{ statusLabel(r.match_confidence) }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 text-right">
                  <UButton
                    v-if="r.matched_member_id"
                    size="xs"
                    variant="outline"
                    color="neutral"
                    class="border-gray-900 font-semibold"
                    @click="openProfile(r.matched_member_id)"
                  >
                    View
                  </UButton>
                  <UButton v-else size="xs" variant="solid" color="neutral" class="font-semibold" @click="openCreate(r)">
                    Create
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

      <template v-if="profileMemberId">
        <div
          class="relative w-2 shrink-0 cursor-col-resize touch-none border-l border-gray-200 bg-gray-100 hover:bg-gray-300 active:bg-gray-400"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          title="Drag to resize"
          @mousedown.prevent="startResizeProfile"
        />
        <aside
          class="flex min-h-0 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white"
          :style="{ width: `${profileAsideWidthPx}px` }"
        >
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <span class="truncate text-sm font-semibold text-gray-900">Member profile</span>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-external-link"
                aria-label="Open full profile"
                @click="openFullMemberPage(profileMemberId)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-x"
                aria-label="Close panel"
                @click="closeProfile"
              />
            </div>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <EitjeStaffMemberProfilePanelLazy :key="profileMemberId" :member-id="profileMemberId" />
          </div>
          <div class="shrink-0 border-t border-gray-100 p-3">
            <UButton
              block
              size="sm"
              variant="outline"
              color="neutral"
              class="border-gray-900 font-semibold"
              @click="openFullMemberPage(profileMemberId)"
            >
              Open full page
            </UButton>
          </div>
        </aside>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const EitjeStaffMemberProfilePanelLazy = defineAsyncComponent(
  () => import('~/components/daily-ops/inbox/EitjeStaffMemberProfilePanel.vue')
)

const PROFILE_ASIDE_WIDTH_LS = 'eitje-staff-profile-aside-px-v1'
const profileAsideWidthPx = ref(384)
let profileResizeListeners: { move: (e: MouseEvent) => void; up: () => void } | null = null

onMounted(() => {
  if (import.meta.client) {
    const raw = localStorage.getItem(PROFILE_ASIDE_WIDTH_LS)
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN
    if (Number.isFinite(n) && n >= 260 && n <= 720) profileAsideWidthPx.value = n
  }
})

onBeforeUnmount(() => {
  if (profileResizeListeners) {
    document.removeEventListener('mousemove', profileResizeListeners.move)
    document.removeEventListener('mouseup', profileResizeListeners.up)
    profileResizeListeners = null
  }
})

function startResizeProfile(e: MouseEvent) {
  if (profileResizeListeners) {
    document.removeEventListener('mousemove', profileResizeListeners.move)
    document.removeEventListener('mouseup', profileResizeListeners.up)
    profileResizeListeners = null
  }
  const startX = e.clientX
  const startW = profileAsideWidthPx.value
  const onMove = (ev: MouseEvent) => {
    const dx = startX - ev.clientX
    profileAsideWidthPx.value = Math.min(720, Math.max(260, startW + dx))
  }
  const onUp = () => {
    if (import.meta.client) {
      localStorage.setItem(PROFILE_ASIDE_WIDTH_LS, String(profileAsideWidthPx.value))
    }
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    profileResizeListeners = null
  }
  profileResizeListeners = { move: onMove, up: onUp }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

type MatchConfidence = 'high' | 'medium' | 'none'

type ApiStaffRow = {
  member_id: string
  employee_name: string
  support_id: string | null
  eitje_ids: string[]
  contract_type: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  compensation_status: 'ok' | 'missing'
  recent_activity: {
    last_worked: string | null
    total_hours: number
    teams: string[]
  }
  missing_data: string[]
}

type StaffRow = {
  support_ids: string[]
  employee_name: string
  contract_type: string
  teams_label: string
  last_worked: string | null
  hours_30d: number | null
  startdatum: string | null
  einddatum: string | null
  hourly_rate: number | null
  cost_per_hour: number | null
  matched_member_id?: string
  match_confidence: MatchConfidence
  compensation_status?: 'ok' | 'missing'
}

function mapApiRow(r: ApiStaffRow): StaffRow {
  const supportIds = [
    ...(r.support_id ? [r.support_id] : []),
    ...r.eitje_ids,
  ].filter(Boolean)
  const hasActivity = r.recent_activity.total_hours > 0
  return {
    support_ids: supportIds,
    employee_name: r.employee_name,
    contract_type: r.contract_type ?? '—',
    teams_label: r.recent_activity.teams.filter(Boolean).join(', ') || '—',
    last_worked: r.recent_activity.last_worked,
    hours_30d: hasActivity ? r.recent_activity.total_hours : null,
    startdatum: r.recent_activity.last_worked,
    einddatum: null,
    hourly_rate: r.hourly_rate,
    cost_per_hour: r.cost_per_hour,
    matched_member_id: r.member_id,
    match_confidence: r.compensation_status === 'ok' ? 'high' : hasActivity ? 'medium' : 'none',
    compensation_status: r.compensation_status,
  }
}

type LocationItem = { _id: string; name: string }
type TeamItem = { _id: string; name: string; location_id: string }

const toast = useToast()

const profileMemberId = ref<string | null>(null)

function openProfile(memberId: string) {
  const id = String(memberId ?? '').trim()
  if (!id) return
  profileMemberId.value = id
}

function closeProfile() {
  profileMemberId.value = null
}

const EITJE_STAFF_PATH = '/daily-ops/inbox/eitje-staff'

function memberFullPageTo(memberId: string) {
  const id = String(memberId ?? '').trim()
  if (!id) return '/organisation'
  return {
    path: `/members/${id}`,
    query: { returnTo: EITJE_STAFF_PATH },
  }
}

function openFullMemberPage(memberId: string) {
  void navigateTo(memberFullPageTo(memberId))
}

const initialLoading = ref(true)
const tableBusy = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<StaffRow[]>([])
const summary = ref<{
  total_staff: number
  matched: number
  with_recent_activity: number
  missing_compensation: number
} | null>(null)

const missingCompensationRows = computed(() =>
  rows.value.filter((r) => r.compensation_status === 'missing' && r.matched_member_id)
)
const pagination = ref<{ skip: number; limit: number; total: number } | null>(null)

const page = ref(1)
const pageSize = 25
const searchInput = ref('')
const searchActive = ref('')
const onlyMissingData = ref(false)

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
  const isFirst = initialLoading.value
  if (!isFirst) tableBusy.value = true
  loadError.value = null
  try {
    const skip = (page.value - 1) * pageSize
    const q: Record<string, string> = {
      skip: String(skip),
      limit: String(pageSize),
    }
    if (searchActive.value.trim()) q.search = searchActive.value.trim()
    if (onlyMissingData.value) q.onlyMissingData = 'true'
    const params = new URLSearchParams(q).toString()
    const res = await $fetch<{
      success: boolean
      data: ApiStaffRow[]
      summary: {
        total_staff: number
        with_recent_activity: number
        missing_critical_data: number
      }
      pagination: { skip: number; limit: number; total: number }
    }>(`/api/daily-ops/eitje-staff?${params}`)
    if (!res.success) throw new Error('Failed to load staff')
    rows.value = res.data.map(mapApiRow)
    summary.value = {
      total_staff: res.summary.total_staff,
      matched: res.summary.total_staff - res.summary.missing_critical_data,
      with_recent_activity: res.summary.with_recent_activity,
      missing_compensation: res.summary.missing_critical_data,
    }
    pagination.value = res.pagination
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    rows.value = []
    summary.value = null
    pagination.value = null
  } finally {
    initialLoading.value = false
    tableBusy.value = false
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
  onlyMissingData.value = false
  page.value = 1
  load()
}


const locations = ref<LocationItem[]>([])
const teams = ref<TeamItem[]>([])
const createMetaLoaded = ref(false)

async function ensureCreateMeta() {
  if (createMetaLoaded.value) return
  const [locRes, teamRes] = await Promise.all([
    $fetch<{ success: boolean; data: LocationItem[] }>('/api/locations'),
    $fetch<{ success: boolean; data: TeamItem[] }>('/api/teams'),
  ])
  locations.value = locRes.data ?? []
  teams.value = teamRes.data ?? []
  createMetaLoaded.value = true
}

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
  void ensureCreateMeta()
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
      contract_start_date: t.startdatum ?? undefined,
      contract_end_date: t.einddatum ?? undefined,
      email: createForm.email.trim() || undefined,
      location_id: createForm.location_id || undefined,
      team_id: createForm.team_id || undefined,
    }
    const res = await fetch('/api/daily-ops/eitje-staff/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json()) as {
      success?: boolean
      statusMessage?: string
      data?: { _id: string }
    }
    if (!res.ok || !json?.success) {
      createError.value =
        typeof json.statusMessage === 'string' && json.statusMessage
          ? json.statusMessage
          : `Request failed (${res.status})`
      return
    }
    const newId = json.data?._id
    if (!newId) {
      createError.value = 'Created but missing member id in response'
      return
    }
    toast.add({ title: 'Worker profile created', color: 'success' })
    createOpen.value = false
    await navigateTo(memberFullPageTo(newId))
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
