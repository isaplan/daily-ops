<template>
  <div class="max-w-4xl mx-auto w-full">
      <UButton variant="ghost" size="sm" class="mb-4 text-blue-600 hover:text-blue-800" to="/organisation">
        ← Back
      </UButton>

      <template v-if="pending && !member">
        <div class="text-gray-500">Loading member...</div>
      </template>

      <template v-else-if="memberError || !member">
        <p class="text-red-600">{{ memberError }}</p>
      </template>

      <template v-else>
        <!-- Header card: same as Next.js (name, email, slack, location, team) -->
        <div class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ member.name }}</h1>
              <div class="space-y-1 text-gray-600">
                <p v-if="member.email">📧 {{ member.email }}</p>
                <p v-if="member.slack_username">💬 Slack: {{ member.slack_username }}</p>
              </div>
              <div v-if="member.location_name || member.team_name" class="mt-3 text-sm text-gray-600">
                <span v-if="member.location_name">Location: {{ member.location_name }}</span>
                <span v-if="member.location_name && member.team_name"> · </span>
                <span v-if="member.team_name">Team: {{ member.team_name }}</span>
              </div>
            </div>
            <div class="flex shrink-0 gap-2">
              <UButton v-if="!isEditing" size="sm" variant="outline" @click="startEdit">Edit profile</UButton>
              <template v-else>
                <UButton
                  size="sm"
                  :loading="saving"
                  class="!bg-gray-900 !text-white hover:!bg-gray-800"
                  @click="saveMember"
                >
                  Save
                </UButton>
                <UButton size="sm" variant="outline" :disabled="saving" @click="cancelEdit">Cancel</UButton>
              </template>
            </div>
          </div>
          <form v-if="isEditing" class="mt-4 pt-4 border-t border-gray-100 space-y-4" @submit.prevent="saveMember">
            <UFormField label="Name *"><UInput v-model="editForm.name" placeholder="Name" required /></UFormField>
            <UFormField label="Email *"><UInput v-model="editForm.email" type="email" placeholder="Email" required /></UFormField>
            <UFormField label="Slack username"><UInput v-model="editForm.slack_username" placeholder="@username" /></UFormField>
            <UFormField label="Location">
              <USelectMenu v-model="editForm.location_id" :items="locationOptions" value-attribute="value" class="w-full" @update:model-value="editForm.team_id = ''">
                <template #leading><UIcon name="i-lucide-map-pin" class="size-4 text-gray-500" /></template>
              </USelectMenu>
            </UFormField>
            <UFormField label="Team">
              <USelectMenu v-model="editForm.team_id" :items="filteredTeamOptions" value-attribute="value" class="w-full">
                <template #leading><UIcon name="i-lucide-users" class="size-4 text-gray-500" /></template>
              </USelectMenu>
            </UFormField>
            <div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
          </form>
          <div class="mt-6 pt-4 border-t border-gray-100 flex justify-end">
            <UButton
              size="sm"
              variant="ghost"
              color="red"
              icon="i-lucide-trash-2"
              :loading="deleting"
              @click="deleteMember"
            >
              Delete
            </UButton>
          </div>
        </div>

        <!-- Worker Info Card: show contract, rates, contact details if available -->
        <div v-if="hasWorkerData" class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 class="text-xl font-bold text-gray-900 mb-4">Worker Information</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Contract Details -->
            <div>
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Contract Details</h3>
              <div class="space-y-2 text-sm">
                <div v-if="member.contract_type" class="flex justify-between">
                  <span class="text-gray-600">Type:</span>
                  <span class="font-medium">{{ member.contract_type }}</span>
                </div>
                <div v-if="member.contract_start_date" class="flex justify-between">
                  <span class="text-gray-600">Start Date:</span>
                  <span class="font-medium">{{ formatDate(member.contract_start_date) }}</span>
                </div>
                <div v-if="member.contract_end_date" class="flex justify-between">
                  <span class="text-gray-600">End Date:</span>
                  <span class="font-medium" :class="isContractExpired ? 'text-red-600' : 'text-green-600'">
                    {{ formatDate(member.contract_end_date) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Compensation -->
            <div>
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Compensation</h3>
              <div class="space-y-2 text-sm">
                <div v-if="member.hourly_rate" class="flex justify-between">
                  <span class="text-gray-600">Hourly Rate:</span>
                  <span class="font-medium">€{{ member.hourly_rate.toFixed(2) }}</span>
                </div>
                <div v-if="member.weekly_hours" class="flex justify-between">
                  <span class="text-gray-600">Weekly Hours:</span>
                  <span class="font-medium">{{ member.weekly_hours.toFixed(1) }}h</span>
                </div>
                <div v-if="member.monthly_hours" class="flex justify-between">
                  <span class="text-gray-600">Monthly Hours:</span>
                  <span class="font-medium">{{ member.monthly_hours.toFixed(1) }}h</span>
                </div>
              </div>
            </div>

            <!-- Contact Information -->
            <div>
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Contact Information</h3>
              <div class="space-y-2 text-sm">
                <div v-if="member.phone" class="flex justify-between">
                  <span class="text-gray-600">Phone:</span>
                  <span class="font-medium">{{ member.phone }}</span>
                </div>
                <div v-if="member.birthday" class="flex justify-between">
                  <span class="text-gray-600">Birthday:</span>
                  <span class="font-medium">{{ member.birthday }}</span>
                </div>
                <div v-if="member.age" class="flex justify-between">
                  <span class="text-gray-600">Age:</span>
                  <span class="font-medium">{{ member.age }} years</span>
                </div>
              </div>
            </div>

            <!-- Address -->
            <div v-if="hasAddressData">
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Address</h3>
              <div class="space-y-2 text-sm">
                <div v-if="member.street" class="text-gray-900">{{ member.street }}</div>
                <div v-if="member.postcode || member.city" class="text-gray-900">
                  <span v-if="member.postcode">{{ member.postcode }}</span>
                  <span v-if="member.postcode && member.city">&nbsp;</span>
                  <span v-if="member.city">{{ member.city }}</span>
                </div>
              </div>
            </div>

            <!-- IDs -->
            <div v-if="member.nmbrs_id || member.support_id">
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Identifiers</h3>
              <div class="space-y-2 text-sm">
                <div v-if="member.nmbrs_id" class="flex justify-between">
                  <span class="text-gray-600">Nmbrs ID:</span>
                  <span class="font-medium font-mono">{{ member.nmbrs_id }}</span>
                </div>
                <div v-if="member.support_id" class="flex justify-between">
                  <span class="text-gray-600">Support ID:</span>
                  <span class="font-medium font-mono">{{ member.support_id }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Eitje: every location + team this person appears on (worked + planned) -->
        <div
          v-if="member.eitje_places"
          class="mb-6 overflow-hidden rounded-2xl border border-[hsl(45,25%,82%)] bg-gradient-to-br from-[hsl(45,20%,99%)] via-white to-[hsl(200,35%,98%)] p-6 shadow-sm"
        >
          <div class="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 class="text-xl font-bold tracking-tight text-gray-900">Locations & teams</h2>
              <p class="text-sm text-gray-600">
                From synced Eitje data: <span class="font-medium text-gray-800">clocked</span> hours and
                <span class="font-medium text-gray-800">planned</span> rooster, combined per place.
              </p>
            </div>
            <div class="text-xs text-gray-500 sm:text-right">
              <p>
                Rolling {{ member.eitje_places.months_back }} months ·
                {{ formatIsoDate(member.eitje_places.range_start) }} – {{ formatIsoDate(member.eitje_places.range_end) }}
              </p>
              <p v-if="member.eitje_places.data_source === 'raw_fallback'" class="mt-1 text-amber-800/90">
                Built from stored shift rows (daily totals had no match for this support ID / name).
              </p>
            </div>
          </div>

          <div
            v-if="member.eitje_places.merged.length"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div
              v-for="(row, idx) in member.eitje_places.merged"
              :key="`${row.location_name}-${row.team_name}-${idx}`"
              class="group relative rounded-xl border border-gray-200/80 bg-white/90 p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:border-[hsl(45,30%,70%)] hover:shadow-md"
            >
              <div class="absolute right-3 top-3 size-2 rounded-full bg-[hsl(45,55%,55%)] opacity-60 group-hover:opacity-100" aria-hidden="true" />
              <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Location</p>
              <p class="text-base font-semibold leading-snug text-gray-900">{{ row.location_name }}</p>
              <p class="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Team</p>
              <p class="text-sm font-medium text-gray-800">{{ row.team_name }}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200/80"
                  title="Time registration (clocked)"
                >
                  <span class="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Worked {{ row.worked_hours.toFixed(1) }}h
                </span>
                <span
                  class="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-200/80"
                  title="Planning shifts"
                >
                  <span class="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                  Planned {{ row.planned_hours.toFixed(1) }}h
                </span>
              </div>
              <p class="mt-3 text-[11px] text-gray-500">
                {{ row.worked_records }} worked rows · {{ row.planned_records }} planned rows
              </p>
            </div>
          </div>
          <p v-else class="rounded-lg border border-dashed border-gray-200 bg-white/60 px-4 py-6 text-center text-sm text-gray-600">
            No shifts in Eitje for this person in the last {{ member.eitje_places.months_back }} months (checked by support ID, unified user ids, and name).
            If they do work in Eitje, confirm sync and that support ID {{ member.support_id || '—' }} matches their Eitje profile.
          </p>
        </div>

        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Connections</h2>

          <template v-if="connectionsPending">
            <div class="space-y-4">
              <div class="h-8 w-48 rounded bg-gray-100 animate-pulse" />
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div v-for="i in 4" :key="i" class="rounded-lg border border-gray-100 p-4">
                  <div class="h-4 w-24 rounded bg-gray-100 animate-pulse mb-2" />
                  <div class="h-8 w-16 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="connectionsError">
            <p class="text-red-600">{{ connectionsError }}</p>
          </template>

          <template v-else>
            <!-- Summary cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div class="rounded-lg border border-gray-200 p-4">
                <p class="text-sm font-medium text-gray-500 mb-1">Notes</p>
                <p class="text-3xl font-bold text-blue-700">{{ connections?.notes ?? 0 }}</p>
              </div>
              <div class="rounded-lg border border-gray-200 p-4">
                <p class="text-sm font-medium text-gray-500 mb-1">Todos</p>
                <p class="text-3xl font-bold text-green-700">{{ connections?.todos ?? 0 }}</p>
              </div>
              <div class="rounded-lg border border-gray-200 p-4">
                <p class="text-sm font-medium text-gray-500 mb-1">Decisions</p>
                <p class="text-3xl font-bold text-purple-700">{{ connections?.decisions ?? 0 }}</p>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="connectionNotes.length" class="mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Notes ({{ connectionNotes.length }})</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NuxtLink
                  v-for="note in connectionNotes"
                  :key="note._id"
                  :to="`/notes/${note.slug || note._id}`"
                  class="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow block"
                >
                  <h4 class="font-semibold text-gray-900">{{ note.title }}</h4>
                  <p v-if="note.content" class="text-sm text-gray-500 mt-1 line-clamp-2">{{ note.content }}</p>
                  <p v-if="note.created_at" class="text-xs text-gray-400 mt-2">{{ formatDate(note.created_at) }}</p>
                </NuxtLink>
              </div>
            </div>

            <!-- Todos -->
            <div v-if="connectionTodos.length" class="mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Todos ({{ connectionTodos.length }})</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NuxtLink
                  v-for="todo in connectionTodos"
                  :key="todo._id + todo.noteId"
                  :to="`/notes/${todo.noteSlug || todo.noteId}`"
                  class="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow block"
                >
                  <div class="flex items-start gap-2">
                    <UIcon :name="todo.checked ? 'i-lucide-circle-check' : 'i-lucide-circle'" class="size-4 shrink-0 mt-0.5" :class="todo.checked ? 'text-gray-400' : 'text-gray-600'" />
                    <span class="text-sm flex-1" :class="todo.checked ? 'text-gray-500 line-through' : 'text-gray-900'">{{ todo.text }}</span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">{{ todo.noteTitle }}</p>
                </NuxtLink>
              </div>
            </div>

            <!-- Decisions -->
            <div v-if="connectionDecisions.length">
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Decisions ({{ connectionDecisions.length }})</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NuxtLink
                  v-for="dec in connectionDecisions"
                  :key="dec._id + dec.noteId"
                  :to="`/notes/${dec.noteSlug || dec.noteId}`"
                  class="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow block"
                >
                  <p class="text-sm text-gray-900">{{ dec.text }}</p>
                  <p class="text-xs text-gray-500 mt-1">{{ dec.noteTitle }}</p>
                </NuxtLink>
              </div>
            </div>

            <p v-if="!connectionNotes.length && !connectionTodos.length && !connectionDecisions.length" class="text-center py-8 text-gray-500">
              No connections found
            </p>
          </template>
        </div>
      </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

type LocationItem = { _id: string; name: string; location_id?: string }
type TeamItem = { _id: string; name: string; location_id?: string }
type MemberItem = {
  _id: string
  name: string
  email: string
  slack_username?: string
  location_id?: string
  team_id?: string
  location_name?: string
  team_name?: string
  is_active?: boolean
  contract_type?: string
  contract_start_date?: string | null
  contract_end_date?: string | null
  hourly_rate?: number
  weekly_hours?: number
  monthly_hours?: number
  phone?: string
  age?: number
  birthday?: string
  postcode?: string
  city?: string
  street?: string
  nmbrs_id?: string
  support_id?: string
  eitje_places?: {
    months_back: number
    range_start: string
    range_end: string
    data_source?: 'aggregation' | 'raw_fallback' | 'none'
    merged: Array<{
      location_name: string
      team_name: string
      worked_hours: number
      planned_hours: number
      worked_records: number
      planned_records: number
    }>
  }
}
type ConnectionNote = { _id: string; slug?: string; title: string; content?: string; created_at?: string | null }
type ConnectionTodo = { _id: string; text: string; checked: boolean; noteId: string; noteSlug?: string; noteTitle: string }
type ConnectionDecision = { _id: string; text: string; noteId: string; noteSlug?: string; noteTitle: string }
type ConnectionsData = {
  notes: number
  todos: number
  decisions: number
  channels: number
  details: {
    notes: ConnectionNote[]
    todos: ConnectionTodo[]
    decisions: ConnectionDecision[]
    channels: unknown[]
  }
}

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id as string)

const { data: memberData, pending, error: memberFetchError } = await useFetch<{ success: boolean; data: MemberItem }>(
  () => (id.value ? `/api/members/${id.value}` : ''),
  { watch: [id] }
)
const member = computed(() => memberData.value?.data ?? null)
const memberError = computed(() => {
  if (member.value) return ''
  const e = memberFetchError.value
  return (e && (typeof e === 'string' ? e : (e as Error)?.message)) || 'Member not found'
})

const { data: connectionsData, pending: connectionsPending, error: connectionsFetchError } = await useFetch<{ success: boolean; data: ConnectionsData }>(
  () => (id.value ? `/api/members/${id.value}/connections` : ''),
  { watch: [id] }
)
const connections = computed(() => connectionsData.value?.data ?? null)
const connectionsError = computed(() => {
  const e = connectionsFetchError.value
  return e ? (typeof e === 'string' ? e : (e as Error)?.message) : ''
})
const connectionNotes = computed(() => connections.value?.details?.notes ?? [])
const connectionTodos = computed(() => connections.value?.details?.todos ?? [])
const connectionDecisions = computed(() => connections.value?.details?.decisions ?? [])

function formatDate(val: string | null | undefined) {
  if (!val) return ''
  try {
    return new Date(val).toLocaleDateString()
  } catch {
    return ''
  }
}

/** YYYY-MM-DD from API → locale date */
function formatIsoDate(val: string | null | undefined) {
  if (!val) return ''
  try {
    const [y, m, d] = val.split('-').map(Number)
    if (!y || !m || !d) return val
    return new Date(y, m - 1, d).toLocaleDateString()
  } catch {
    return val ?? ''
  }
}

const hasWorkerData = computed(() => {
  if (!member.value) return false
  return !!(
    member.value.contract_type ||
    member.value.contract_start_date ||
    member.value.contract_end_date ||
    member.value.hourly_rate ||
    member.value.phone ||
    member.value.age ||
    member.value.birthday ||
    member.value.street ||
    member.value.postcode ||
    member.value.city ||
    !!(member.value.support_id && member.value.support_id.trim()) ||
    !!(member.value.nmbrs_id && member.value.nmbrs_id.trim())
  )
})

const hasAddressData = computed(() => {
  if (!member.value) return false
  return !!(member.value.street || member.value.postcode || member.value.city)
})

const isContractExpired = computed(() => {
  if (!member.value?.contract_end_date) return false
  try {
    return new Date(member.value.contract_end_date) < new Date()
  } catch {
    return false
  }
})

const { data: locationsData } = await useFetch<{ success: boolean; data: LocationItem[] }>('/api/locations')
const { data: teamsData } = await useFetch<{ success: boolean; data: TeamItem[] }>('/api/teams')
const locations = computed(() => locationsData.value?.data ?? [])
const teams = computed(() => teamsData.value?.data ?? [])

const locationOptions = computed(() => [
  { label: 'None', value: '' },
  ...locations.value.map((l: LocationItem) => ({ label: l.name, value: l._id })),
])
const filteredTeamOptions = computed(() => {
  const locId = editForm.location_id
  const list = locId ? teams.value.filter((t: TeamItem) => t.location_id === locId) : teams.value
  return [{ label: 'None', value: '' }, ...list.map((t: TeamItem) => ({ label: t.name, value: t._id }))]
})

const isEditing = ref(false)
const saving = ref(false)
const saveError = ref('')
const deleting = ref(false)
const editForm = reactive({
  name: '',
  email: '',
  slack_username: '',
  location_id: '',
  team_id: '',
})

function syncEditForm() {
  if (!member.value) return
  editForm.name = member.value.name
  editForm.email = member.value.email
  editForm.slack_username = member.value.slack_username ?? ''
  editForm.location_id = member.value.location_id ?? ''
  editForm.team_id = member.value.team_id ?? ''
}

function startEdit() {
  syncEditForm()
  saveError.value = ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function saveMember() {
  if (!id.value) return
  saveError.value = ''
  saving.value = true
  try {
    const res = await $fetch<{ success: boolean; data?: MemberItem; error?: string }>(`/api/members/${id.value}`, {
      method: 'PUT',
      body: {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        slack_username: editForm.slack_username.trim() || undefined,
        location_id: editForm.location_id || undefined,
        team_id: editForm.team_id || undefined,
      },
    })
    if (res.success && res.data) {
      const full = await $fetch<{ success: boolean; data: MemberItem }>(`/api/members/${id.value}`)
      memberData.value = full.success && full.data ? full : { success: true, data: res.data }
      isEditing.value = false
    } else {
      saveError.value = res.error ?? 'Failed to update member'
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to update member'
  } finally {
    saving.value = false
  }
}

async function deleteMember() {
  if (!member.value || !confirm(`Delete member "${member.value.name}"? They will be deactivated.`)) return
  deleting.value = true
  try {
    await $fetch(`/api/members/${id.value}`, { method: 'DELETE' })
    await router.push('/organisation')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to delete member'
  } finally {
    deleting.value = false
  }
}
</script>
