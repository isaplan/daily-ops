<template>
  <div class="min-h-screen bg-gray-50 p-4 sm:p-6">
    <div
      class="mx-auto flex h-[min(88vh,960px)] max-h-[min(88vh,960px)] w-full max-w-[min(100%,1440px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div class="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gray-50">
        <div class="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Bork — Staff</h1>
          <p class="mt-2 text-gray-600">
            Waiters with guest sales from <span class="font-mono text-gray-800">bork_sales_by_worker</span> (Bork API +
            daily sales), linked via <span class="font-semibold">unified_user</span> to members.
          </p>
          <p v-if="activeRange" class="mt-1 text-sm text-gray-500">
            Period: {{ formatIsoDate(activeRange.range_start) }} – {{ formatIsoDate(activeRange.range_end) }}
            <span v-if="activeRange.collection_suffix" class="font-mono text-xs"> · {{ activeRange.collection_suffix }}</span>
          </p>
          <NuxtLink
            class="mt-2 inline-block text-sm font-medium text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
            to="/daily-ops/inbox"
          >
            ← Inbox home
          </NuxtLink>
        </div>
      </div>


      <UAlert
        color="info"
        variant="subtle"
        class="mb-6"
        title="Why staff may show as unlinked"
        description="Two steps: Bork name → unified_user (bork_unified_user_mapping) and member → unified_user_id. Without (1), aggregates store workerId as unknown. Confirm a suggestion to save mapping; run Bork rebuild to backfill history."
      />
      <div class="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">With sales</span>
          </template>
          <p class="text-3xl font-bold tabular-nums">
            {{ summary ? summary.total_with_sales : '—' }}
          </p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">Linked member</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-emerald-700">
            {{ summary ? summary.matched : '—' }}
          </p>
        </UCard>
        <UCard class="border-2 border-gray-900 bg-white">
          <template #header>
            <span class="text-sm font-medium text-gray-500">No member link</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-amber-700">
            {{ summary ? summary.unmatched : '—' }}
          </p>
        </UCard>
        <UCard
          v-if="summary && summary.suggested > 0"
          class="border-2 border-sky-200 bg-sky-50"
        >
          <template #header>
            <span class="text-sm font-medium text-sky-900">Suggestions</span>
          </template>
          <p class="text-3xl font-bold tabular-nums text-sky-800">
            {{ summary.suggested }}
          </p>
        </UCard>
      </div>

      <div
        v-if="!loading && rows.length === 0 && !loadError"
        class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p class="text-sm text-gray-600">
          No waiter sales in this period. Run Bork sync / rebuild aggregation, or widen the date range.
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
            <label class="text-xs font-medium text-gray-600">Location</label>
            <USelectMenu
              v-model="filterLocation"
              :items="locationOptions"
              value-key="value"
              class="w-full"
              @update:model-value="applyFilters"
            />
          </div>
          <div class="min-w-[200px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">Search</label>
            <UInput v-model="searchInput" class="w-full" placeholder="Name, location…" @keyup.enter="applyFilters" />
          </div>
          <div class="min-w-[140px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">From</label>
            <UInput v-model="filterStart" type="date" class="w-full" />
          </div>
          <div class="min-w-[140px] flex-1 space-y-1">
            <label class="text-xs font-medium text-gray-600">To</label>
            <UInput v-model="filterEnd" type="date" class="w-full" />
          </div>
          <div class="flex items-center gap-2 pb-1">
            <UCheckbox v-model="includeUnmapped" label="Show unmapped" @update:model-value="applyFilters" />
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
                <th class="px-4 py-3 font-medium">Name</th>
                <th class="px-4 py-3 text-right font-medium">Total sales</th>
                <th class="px-4 py-3 text-right font-medium">Avg / day</th>
                <th class="px-4 py-3 text-right font-medium">Days</th>
                <th class="px-4 py-3 text-right font-medium">€/h</th>
                <th class="px-4 py-3 font-medium">Locations</th>
                <th class="px-4 py-3 font-medium">Status</th>
                <th class="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in rows"
                :key="`${r.worker_key}-${i}`"
                class="border-b border-gray-100 last:border-0"
                :class="
                  r.matched_member_id && r.matched_member_id === profileMemberId
                    ? 'bg-emerald-50/80'
                    : r.link_status === 'suggested'
                      ? 'bg-sky-50/50'
                      : r.link_status === 'unmapped'
                        ? 'bg-amber-50/40'
                        : ''
                "
              >
                <td class="px-4 py-3">
                  <p class="font-medium text-gray-900">{{ r.worker_name }}</p>
                  <p v-if="r.bork_user_name && r.bork_user_name !== r.worker_name" class="text-xs text-gray-500">
                    Bork: {{ r.bork_user_name }}
                  </p>
                  <p v-else-if="r.bork_user_name" class="text-xs text-gray-500">Bork: {{ r.bork_user_name }}</p>
                  <p v-if="r.suggestion" class="mt-0.5 text-xs text-sky-700">
                    Suggest: {{ r.suggestion.name }}
                    <span class="text-sky-500">({{ r.suggestion.confidence }})</span>
                  </p>
                </td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.total_sales_ex_vat) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.avg_sales_per_day) }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ r.days_active }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ money(r.productivity_per_hour) }}</td>
                <td class="px-4 py-3 text-gray-700">
                  <span v-if="r.location_count <= 2">{{ r.locations.join(', ') }}</span>
                  <span v-else :title="r.locations.join(', ')">{{ r.location_count }} venues</span>
                </td>
                <td class="px-4 py-3">
                  <UBadge v-if="r.link_status === 'linked'" variant="solid" color="neutral" class="bg-[#228B22]! text-white! ring-0">
                    Linked
                  </UBadge>
                  <UBadge v-else-if="r.link_status === 'unified_no_member'" color="warning" variant="subtle">
                    Unified, no member
                  </UBadge>
                  <UBadge v-else-if="r.link_status === 'suggested'" color="info" variant="subtle">Suggested</UBadge>
                  <UBadge v-else color="neutral" variant="subtle">Unmapped</UBadge>
                  <p v-if="r.needs_rebuild" class="mt-1 text-[10px] text-amber-700">Rebuild agg. to fix workerId</p>
                </td>
                <td class="px-4 py-3 text-right">
                  <div v-if="r.suggestion && r.link_status === 'suggested'" class="mb-1 flex flex-wrap justify-end gap-1">
                    <UButton size="xs" color="success" variant="soft" :loading="linkSaving === r.worker_key" @click="confirmSuggestion(r)">
                      Confirm
                    </UButton>
                    <UButton size="xs" color="neutral" variant="ghost" :disabled="linkSaving === r.worker_key" @click="rejectSuggestion(r)">
                      Reject
                    </UButton>
                  </div>
                  <div v-else-if="r.link_status === 'unified_no_member' && r.member_suggestion" class="mb-1">
                    <UButton size="xs" variant="soft" :loading="linkSaving === r.worker_key" @click="confirmMemberOnly(r)">
                      Link {{ r.member_suggestion.name }}
                    </UButton>
                  </div>
                  <div class="flex flex-wrap justify-end gap-1">
                    <UButton
                      v-if="r.link_status !== 'linked'"
                      size="xs"
                      variant="outline"
                      color="neutral"
                      @click="openLinkModal(r)"
                    >
                      Link…
                    </UButton>
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
                  </div>
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
            <BorkStaffMemberProfilePanel :key="profileMemberId" :member-id="profileMemberId" />
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

  <UModal v-model="linkOpen">
    <UCard class="w-full max-w-lg">
      <template #header>
        <h3 class="text-base font-semibold text-gray-900">Link Bork waiter</h3>
      </template>

      <div v-if="linkTarget" class="grid gap-4 py-4">
        <p class="text-sm text-gray-600">
          Bork name: <span class="font-semibold text-gray-900">{{ linkTarget.bork_user_name }}</span>
        </p>
        <UFormField label="Search unified_user">
          <UInput v-model="unifiedSearch" placeholder="Name…" @keyup.enter="searchUnifiedUsers" />
        </UFormField>
        <UButton size="sm" variant="outline" :loading="unifiedSearchPending" @click="searchUnifiedUsers">
          Search
        </UButton>
        <UFormField label="unified_user">
          <USelectMenu
            v-model="linkUnifiedId"
            :items="unifiedOptions"
            value-key="value"
            class="w-full"
            placeholder="Pick person…"
          />
        </UFormField>
        <UFormField label="Member id (optional)">
          <UInput v-model="linkMemberId" placeholder="24-char member id" class="font-mono text-xs" />
        </UFormField>
        <p v-if="linkError" class="text-sm text-red-600">{{ linkError }}</p>
      </div>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="outline" color="neutral" @click="linkOpen = false">Cancel</UButton>
          <UButton :loading="!!linkSaving" class="font-semibold" @click="submitManualLink">Save link</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import BorkStaffMemberProfilePanel from '~/components/daily-ops/inbox/BorkStaffMemberProfilePanel.vue'

const FILTER_ALL = '__all__'

const PROFILE_ASIDE_WIDTH_LS = 'bork-staff-profile-aside-px-v1'
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

type LinkStatus = 'linked' | 'unified_no_member' | 'suggested' | 'unmapped'

type StaffRow = {
  worker_key: string
  worker_id: string
  bork_user_name: string
  worker_name: string
  unified_user_id?: string
  matched_member_id?: string
  match_confidence: 'high' | 'none'
  link_status: LinkStatus
  is_unmapped: boolean
  from_bork_mapping: boolean
  needs_rebuild: boolean
  suggestion?: { unified_user_id: string; name: string; confidence: string; reason: string }
  member_suggestion?: { member_id: string; name: string; confidence: string; reason: string }
  total_sales_ex_vat: number
  avg_sales_per_day: number | null
  days_active: number
  location_count: number
  locations: string[]
  total_quantity: number
  worked_hours: number | null
  productivity_per_hour: number | null
}

type LocationItem = { _id: string; name: string }

const profileMemberId = ref<string | null>(null)
const activeRange = ref<{ range_start: string; range_end: string; collection_suffix: string | null } | null>(null)

function openProfile(memberId: string) {
  const id = String(memberId ?? '').trim()
  if (!id) return
  profileMemberId.value = id
}

function closeProfile() {
  profileMemberId.value = null
}

const BORK_STAFF_PATH = '/daily-ops/inbox/bork-staff'

function memberFullPageTo(memberId: string) {
  const id = String(memberId ?? '').trim()
  if (!id) return '/organisation'
  return {
    path: `/members/${id}`,
    query: { returnTo: BORK_STAFF_PATH },
  }
}

function openFullMemberPage(memberId: string) {
  void navigateTo(memberFullPageTo(memberId))
}

const loading = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<StaffRow[]>([])
const summary = ref<{
  total_with_sales: number
  matched: number
  unmatched: number
  linked: number
  suggested: number
  unmapped: number
  unmapped_bork_names: number
  distinct_locations?: string[]
} | null>(null)

const toast = useToast()
const linkOpen = ref(false)
const linkTarget = ref<StaffRow | null>(null)
const linkUnifiedId = ref('')
const linkMemberId = ref('')
const linkError = ref('')
const linkSaving = ref<string | null>(null)
const unifiedSearch = ref('')
const unifiedSearchPending = ref(false)
const unifiedOptions = ref<{ label: string; value: string }[]>([])

const pagination = ref<{ skip: number; limit: number; total: number } | null>(null)

const page = ref(1)
const pageSize = 25
const searchInput = ref('')
const searchActive = ref('')
const filterLocation = ref<string>(FILTER_ALL)
const filterStart = ref('')
const filterEnd = ref('')
const includeUnmapped = ref(false)

const { data: locationsData } = useFetch<{ success: boolean; data: LocationItem[] }>('/api/locations')
const locations = computed(() => locationsData.value?.data ?? [])

const locationOptions = computed(() => [
  { label: 'All locations', value: FILTER_ALL },
  ...locations.value.map((l: LocationItem) => ({ label: l.name, value: l._id })),
])

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `€${n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatIsoDate(val: string | null | undefined) {
  if (!val) return ''
  try {
    const [y, mo, d] = val.split('-').map(Number)
    if (!y || !mo || !d) return val
    return new Date(y, mo - 1, d).toLocaleDateString()
  } catch {
    return val ?? ''
  }
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
    if (filterStart.value.trim()) q.start = filterStart.value.trim()
    if (filterEnd.value.trim()) q.end = filterEnd.value.trim()
    if (includeUnmapped.value) q.include_unmapped = '1'
    const params = new URLSearchParams(q).toString()
    const res = await $fetch<{
      success: boolean
      data: StaffRow[]
      range: { range_start: string; range_end: string }
      collection_suffix: string | null
      summary: {
        total_with_sales: number
        matched: number
        unmatched: number
        linked: number
        suggested: number
        unmapped: number
        unmapped_bork_names: number
        distinct_locations?: string[]
      }
      pagination: { skip: number; limit: number; total: number }
    }>(`/api/daily-ops/bork-staff?${params}`)
    if (!res.success) throw new Error('Failed to load Bork staff')
    rows.value = res.data
    summary.value = res.summary
    pagination.value = res.pagination
    activeRange.value = {
      range_start: res.range.range_start,
      range_end: res.range.range_end,
      collection_suffix: res.collection_suffix,
    }
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
  filterStart.value = ''
  filterEnd.value = ''
  includeUnmapped.value = false
  page.value = 1
  load()
}

async function postLink(
  action: 'confirm' | 'reject',
  row: StaffRow,
  unifiedUserId: string,
  memberId?: string
) {
  linkSaving.value = row.worker_key
  linkError.value = ''
  try {
    await $fetch('/api/daily-ops/bork-staff/link', {
      method: 'POST',
      body: {
        action,
        bork_user_name: row.bork_user_name,
        unified_user_id: unifiedUserId,
        member_id: memberId,
      },
    })
    if (action === 'confirm') {
      toast.add({ title: 'Link saved', description: row.bork_user_name, color: 'success' })
    }
    await load()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    linkError.value = msg
    toast.add({ title: 'Link failed', description: msg, color: 'error' })
  } finally {
    linkSaving.value = null
  }
}

function confirmSuggestion(row: StaffRow) {
  const uid = row.suggestion?.unified_user_id
  if (!uid) return
  const mid = row.member_suggestion?.member_id
  void postLink('confirm', row, uid, mid)
}

function rejectSuggestion(row: StaffRow) {
  const uid = row.suggestion?.unified_user_id
  if (!uid) return
  void postLink('reject', row, uid)
}

function confirmMemberOnly(row: StaffRow) {
  const uid = row.unified_user_id
  const mid = row.member_suggestion?.member_id
  if (!uid || !mid) return
  void postLink('confirm', row, uid, mid)
}

function openLinkModal(row: StaffRow) {
  linkTarget.value = row
  linkUnifiedId.value = row.suggestion?.unified_user_id ?? row.unified_user_id ?? ''
  linkMemberId.value = row.matched_member_id ?? row.member_suggestion?.member_id ?? ''
  linkError.value = ''
  unifiedSearch.value = row.bork_user_name
  unifiedOptions.value = []
  linkOpen.value = true
  void searchUnifiedUsers()
}

async function searchUnifiedUsers() {
  unifiedSearchPending.value = true
  try {
    const q = unifiedSearch.value.trim()
    const res = await $fetch<{ success: boolean; data: { _id: string; name: string }[] }>(
      `/api/daily-ops/bork-staff/unified-users?search=${encodeURIComponent(q)}&limit=30`
    )
    unifiedOptions.value = (res.data ?? []).map((u) => ({ label: u.name, value: u._id }))
    if (!linkUnifiedId.value && unifiedOptions.value.length === 1) {
      linkUnifiedId.value = unifiedOptions.value[0]!.value
    }
  } finally {
    unifiedSearchPending.value = false
  }
}

async function submitManualLink() {
  const row = linkTarget.value
  const uid = String(linkUnifiedId.value ?? '').trim()
  if (!row || !uid) {
    linkError.value = 'Pick a unified_user'
    return
  }
  const mid = linkMemberId.value.trim() || undefined
  linkOpen.value = false
  await postLink('confirm', row, uid, mid)
}

onMounted(() => {
  load()
})
</script>
