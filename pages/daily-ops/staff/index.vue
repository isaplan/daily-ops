<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-gray-900">
        Daily Ops / Staff
      </h1>
      <p class="text-base text-gray-600">
        Team profiles · weekly worked vs contract hours
      </p>
    </header>

    <section class="min-w-0">
      <div v-if="initialLoading" class="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <USkeleton v-for="i in 3" :key="`sk-${i}`" class="h-24 w-full rounded-lg" />
      </div>
      <div v-else class="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4 text-left shadow-none">
          <p class="text-sm font-medium text-gray-500">Total staff</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{{ summary?.total_staff ?? '—' }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4 text-left shadow-none">
          <p class="text-sm font-medium text-gray-500">Active (30d)</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{{ summary?.with_recent_activity ?? '—' }}</p>
        </div>
        <div class="rounded-lg border-2 border-gray-900 bg-white p-4 text-left shadow-none">
          <p class="text-sm font-medium text-gray-500">Matched profiles</p>
          <p class="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{{ summary?.matched ?? '—' }}</p>
        </div>
      </div>
    </section>

    <div class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
      <div class="inline-flex min-w-[min(100%,280px)] items-center gap-2 rounded-md border-2 border-gray-900 bg-white px-2 py-1 sm:max-w-md">
        <label for="staff-search" class="sr-only">Search</label>
        <UIcon name="i-lucide-search" class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
        <UInput
          id="staff-search"
          v-model="searchInput"
          variant="none"
          placeholder="Name, support id…"
          class="min-w-0 flex-1 rounded-none px-1 py-1.5 text-sm font-semibold"
          @keyup.enter="applyFilters"
        />
      </div>

      <div
        class="relative z-0 inline-flex shrink-0 items-center gap-1 rounded-md border-2 border-gray-900 bg-white p-0.5"
        role="group"
        aria-label="Search actions"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          @click="clearFilters"
        >
          <UIcon name="i-lucide-rotate-ccw" class="size-4 shrink-0" aria-hidden="true" />
          Clear
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 disabled:opacity-50"
          :disabled="tableBusy"
          @click="applyFilters"
        >
          <UIcon
            :name="tableBusy ? 'i-lucide-loader-circle' : 'i-lucide-check'"
            class="size-4 shrink-0"
            :class="tableBusy ? 'animate-spin' : ''"
            aria-hidden="true"
          />
          Apply
        </button>
      </div>
    </div>

    <div class="flex min-w-0 items-stretch">
      <div class="min-w-0 flex-1">
        <div v-if="initialLoading" class="space-y-3 rounded-lg border-2 border-gray-900 bg-white p-4">
          <div v-for="i in 8" :key="i" class="h-10 animate-pulse rounded bg-gray-100" />
        </div>
        <UAlert v-else-if="loadError" color="error" :title="loadError" />
        <div
          v-else-if="rows.length"
          class="overflow-hidden rounded-lg border-2 border-gray-900 bg-white"
          :class="tableBusy ? 'opacity-60' : ''"
        >
          <div
            class="scrollbar-hide max-h-[calc(100dvh-18rem)] min-h-[12rem] overflow-auto overscroll-x-contain touch-pan-x"
          >
            <table class="w-full min-w-[42rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr class="text-gray-700">
                  <th
                    class="sticky left-0 top-0 z-30 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 font-semibold whitespace-nowrap shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)]"
                  >
                    Name
                  </th>
                  <th
                    class="sticky top-0 z-20 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    Contract
                  </th>
                  <th
                    class="sticky top-0 z-20 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    Last worked
                  </th>
                  <th
                    class="sticky top-0 z-20 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 text-right font-semibold whitespace-nowrap"
                  >
                    Hours (30d)
                  </th>
                  <th
                    class="sticky top-0 z-20 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 text-right font-semibold whitespace-nowrap"
                  >
                    €/h
                  </th>
                  <th
                    class="sticky top-0 z-20 border-b-2 border-gray-900 bg-gray-50 px-4 py-3 text-right font-semibold whitespace-nowrap"
                  />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(r, i) in rows"
                  :key="`${r.member_id}-${i}`"
                  class="group cursor-pointer border-b border-gray-100 last:border-0"
                  :class="r.member_id === profileMemberId ? 'bg-gray-100' : 'hover:bg-gray-50'"
                  @click="openProfile(r.member_id)"
                >
                  <td
                    class="sticky left-0 z-10 border-b border-gray-100 px-4 py-3 font-semibold whitespace-nowrap text-gray-900 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] last:border-0"
                    :class="r.member_id === profileMemberId ? 'bg-gray-100' : 'bg-white group-hover:bg-gray-50'"
                  >
                    {{ r.employee_name }}
                  </td>
                  <td class="border-b border-gray-100 px-4 py-3 text-gray-700 last:border-0">{{ r.contract_type || '—' }}</td>
                  <td class="border-b border-gray-100 px-4 py-3 tabular-nums text-gray-700 last:border-0">{{ r.last_worked || '—' }}</td>
                  <td class="border-b border-gray-100 px-4 py-3 text-right tabular-nums last:border-0">{{ fmtHours(r.hours_30d) }}</td>
                  <td class="border-b border-gray-100 px-4 py-3 text-right tabular-nums last:border-0">{{ money(r.hourly_rate) }}</td>
                  <td class="border-b border-gray-100 px-4 py-3 text-right last:border-0">
                    <UButton
                      size="xs"
                      variant="outline"
                      color="neutral"
                      class="border-gray-900 font-semibold"
                      @click.stop="openProfile(r.member_id)"
                    >
                      View
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="pagination && pagination.total > pageSize" class="flex justify-center border-t border-gray-200 p-4">
            <UPagination
              :page="page"
              :total="pagination.total"
              :items-per-page="pageSize"
              @update:page="(p) => { page = p; load() }"
            />
          </div>
        </div>
        <p v-else class="text-gray-600">No staff found.</p>
      </div>

      <template v-if="profileMemberId">
        <div
          class="relative ml-4 hidden w-2 shrink-0 cursor-col-resize self-stretch bg-gray-100 hover:bg-gray-300 md:block"
          role="separator"
          @mousedown.prevent="startResizeProfile"
        />
        <aside
          class="hidden min-h-0 shrink-0 flex-col self-stretch overflow-hidden rounded-lg border-2 border-gray-900 bg-white md:flex"
          :style="{ width: `${profileAsideWidthPx}px` }"
        >
          <div class="flex shrink-0 items-center justify-between border-b-2 border-gray-900 bg-gray-50 px-3 py-2">
            <span class="truncate text-sm font-semibold text-gray-900">Profile</span>
            <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="closeProfile" />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <StaffMemberProfilePanel :key="profileMemberId" :member-id="profileMemberId" />
          </div>
        </aside>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="profileMemberId"
        class="fixed inset-0 z-[100] flex flex-col bg-white md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Staff profile"
      >
        <div class="flex shrink-0 items-center justify-between border-b-2 border-gray-900 bg-gray-50 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <span class="truncate text-sm font-semibold text-gray-900">Profile</span>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="closeProfile" />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <StaffMemberProfilePanel :key="`mobile-${profileMemberId}`" :member-id="profileMemberId" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import StaffMemberProfilePanel from '~/components/daily-ops/staff/StaffMemberProfilePanel.vue'

definePageMeta({ keepalive: true })

const PROFILE_ASIDE_WIDTH_LS = 'daily-ops-staff-profile-aside-px-v1'
const STAFF_PATH = '/daily-ops/staff'

const route = useRoute()
const { dashboardQuery } = useDailyOpsDashboardRoute()

type ApiStaffRow = {
  member_id: string
  employee_name: string
  contract_type: string | null
  hourly_rate: number | null
  recent_activity: { last_worked: string | null; total_hours: number }
}

type StaffRow = {
  member_id: string
  employee_name: string
  contract_type: string
  last_worked: string | null
  hours_30d: number | null
  hourly_rate: number | null
}

const profileMemberId = ref<string | null>(
  typeof route.query.member === 'string' ? route.query.member : null,
)
const profileAsideWidthPx = ref(400)
let profileResizeListeners: { move: (e: MouseEvent) => void; up: () => void } | null = null

function staffQuery(extra?: Record<string, string>) {
  const q: Record<string, string> = { ...dashboardQuery.value }
  if (extra) Object.assign(q, extra)
  else delete q.member
  return q
}

onMounted(() => {
  if (import.meta.client) {
    const raw = localStorage.getItem(PROFILE_ASIDE_WIDTH_LS)
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN
    if (Number.isFinite(n) && n >= 280 && n <= 720) profileAsideWidthPx.value = n
    window.addEventListener('keydown', onProfileEscape)
  }
  load()
})

onBeforeUnmount(() => {
  if (profileResizeListeners) {
    document.removeEventListener('mousemove', profileResizeListeners.move)
    document.removeEventListener('mouseup', profileResizeListeners.up)
  }
  if (import.meta.client) {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onProfileEscape)
  }
})

function onProfileEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && profileMemberId.value) closeProfile()
}

watch(profileMemberId, (id) => {
  if (!import.meta.client) return
  const mobileOpen = id != null && window.matchMedia('(max-width: 767px)').matches
  document.body.style.overflow = mobileOpen ? 'hidden' : ''
})

function startResizeProfile(e: MouseEvent) {
  const startX = e.clientX
  const startW = profileAsideWidthPx.value
  const onMove = (ev: MouseEvent) => {
    profileAsideWidthPx.value = Math.min(720, Math.max(280, startW + (startX - ev.clientX)))
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

function openProfile(memberId: string) {
  const id = String(memberId ?? '').trim()
  if (!id) return
  profileMemberId.value = id
  void navigateTo({ path: STAFF_PATH, query: staffQuery({ member: id }) }, { replace: true })
}

function closeProfile() {
  profileMemberId.value = null
  void navigateTo({ path: STAFF_PATH, query: staffQuery() }, { replace: true })
}

const initialLoading = ref(true)
const tableBusy = ref(false)
const loadError = ref<string | null>(null)
const rows = ref<StaffRow[]>([])
const summary = ref<{ total_staff: number; matched: number; with_recent_activity: number } | null>(null)
const pagination = ref<{ skip: number; limit: number; total: number } | null>(null)
const page = ref(1)
const pageSize = 25
const searchInput = ref('')
const searchActive = ref('')

function mapRow(r: ApiStaffRow): StaffRow {
  const h = r.recent_activity.total_hours
  return {
    member_id: r.member_id,
    employee_name: r.employee_name,
    contract_type: r.contract_type ?? '—',
    last_worked: r.recent_activity.last_worked,
    hours_30d: h > 0 ? h : null,
    hourly_rate: r.hourly_rate,
  }
}

function money(n: number | null) {
  return n != null && Number.isFinite(n) ? `€${n.toFixed(2)}` : '—'
}

function fmtHours(n: number | null) {
  return n != null && Number.isFinite(n) ? n.toFixed(1) : '—'
}

async function load() {
  const isFirst = initialLoading.value
  if (!isFirst) tableBusy.value = true
  loadError.value = null
  try {
    const q: Record<string, string> = {
      skip: String((page.value - 1) * pageSize),
      limit: String(pageSize),
    }
    if (searchActive.value.trim()) q.search = searchActive.value.trim()
    const res = await $fetch<{
      success: boolean
      data: ApiStaffRow[]
      summary: { total_staff: number; with_recent_activity: number; missing_critical_data: number }
      pagination: { skip: number; limit: number; total: number }
    }>(`/api/daily-ops/staff?${new URLSearchParams(q)}`)
    rows.value = res.data.map(mapRow)
    summary.value = {
      total_staff: res.summary.total_staff,
      matched: res.summary.total_staff - res.summary.missing_critical_data,
      with_recent_activity: res.summary.with_recent_activity,
    }
    pagination.value = res.pagination
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
    rows.value = []
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
  page.value = 1
  load()
}

watch(
  () => route.query.member,
  (q) => {
    profileMemberId.value = typeof q === 'string' ? q : null
  },
  { immediate: true },
)
</script>
