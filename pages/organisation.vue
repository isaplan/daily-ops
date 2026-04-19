<template>
  <div class="max-w-4xl mx-auto space-y-12">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 mb-1">Organisation</h1>
      <p class="text-gray-600 text-sm">Manage your locations, teams, and members</p>
    </div>

    <!-- Locations -->
    <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Locations ({{ locations.length }})</h2>
        <UButton size="sm" variant="outline" @click="showLocationForm = !showLocationForm">
          {{ showLocationForm ? 'Cancel' : '+ Create Location' }}
        </UButton>
      </div>
      <div v-if="locationError" class="mb-4 text-sm text-red-600">{{ locationError }}</div>
      <form v-if="showLocationForm" class="mb-6 p-4 rounded-lg border border-gray-100 bg-gray-50 space-y-4" @submit.prevent="createLocation">
        <UFormField label="Location Name *">
          <UInput v-model="locationForm.name" placeholder="Location Name" required />
        </UFormField>
        <UFormField label="Address">
          <UInput v-model="locationForm.address" placeholder="Address" />
        </UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="City">
            <UInput v-model="locationForm.city" placeholder="City" />
          </UFormField>
          <UFormField label="Country">
            <UInput v-model="locationForm.country" placeholder="Country" />
          </UFormField>
        </div>
        <UButton type="submit" :loading="locationCreating">Create Location</UButton>
      </form>
      <div v-if="locations.length === 0 && !pendingLocations" class="text-sm text-gray-500 py-4">No locations yet. Create one above.</div>
      <ul v-else class="space-y-2">
        <li
          v-for="loc in locations"
          :key="loc._id"
          class="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-4 py-3 hover:bg-gray-50"
        >
          <div class="min-w-0 flex-1">
            <span class="font-medium text-gray-900">{{ loc.name }}</span>
            <span v-if="loc.address || loc.city" class="ml-2 text-sm text-gray-500">{{ [loc.address, loc.city, loc.country].filter(Boolean).join(', ') }}</span>
            <p v-if="connectedTeams(loc._id).length" class="mt-1 text-xs text-gray-500">
              {{ connectedTeams(loc._id).length }} team(s): {{ connectedTeams(loc._id).map((t) => t.name).join(', ') }}
            </p>
            <p v-else-if="!pendingTeams" class="mt-1 text-xs text-gray-400">No teams</p>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="red"
            icon="i-lucide-trash-2"
            :aria-label="`Delete ${loc.name}`"
            :loading="deletingLocationId === loc._id"
            @click="deleteLocation(loc._id, loc.name)"
          />
        </li>
      </ul>
    </section>

    <!-- Teams -->
    <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Teams ({{ teams.length }})</h2>
        <UButton size="sm" variant="outline" @click="showTeamForm = !showTeamForm">
          {{ showTeamForm ? 'Cancel' : '+ Create Team' }}
        </UButton>
      </div>
      <div v-if="teamError" class="mb-4 text-sm text-red-600">{{ teamError }}</div>
      <form v-if="showTeamForm" class="mb-6 p-4 rounded-lg border border-gray-100 bg-gray-50 space-y-4" @submit.prevent="createTeam">
        <UFormField label="Team Name *">
          <UInput v-model="teamForm.name" placeholder="Team Name" required />
        </UFormField>
        <UFormField label="Location *">
          <USelectMenu
            v-model="teamForm.location_id"
            :items="locationOptions"
            value-key="value"
            class="w-full"
          >
            <template #leading>
              <UIcon name="i-lucide-map-pin" class="size-4 text-gray-500" />
            </template>
          </USelectMenu>
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="teamForm.description" placeholder="Description" :rows="2" />
        </UFormField>
        <UButton type="submit" :loading="teamCreating">Create Team</UButton>
      </form>
      <div v-if="teams.length === 0 && !pendingTeams" class="text-sm text-gray-500 py-4">No teams yet. Create one above.</div>
      <ul v-else class="space-y-2">
        <li
          v-for="team in teams"
          :key="team._id"
          class="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-4 py-3 hover:bg-gray-50"
        >
          <div>
            <span class="font-medium text-gray-900">{{ team.name }}</span>
            <span v-if="team.description" class="ml-2 text-sm text-gray-500">{{ team.description }}</span>
            <span v-if="team.location_id" class="ml-2 text-xs text-gray-400">· {{ locationName(team.location_id) }}</span>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="red"
            icon="i-lucide-trash-2"
            :aria-label="`Delete ${team.name}`"
            :loading="deletingTeamId === team._id"
            @click="deleteTeam(team._id, team.name)"
          />
        </li>
      </ul>
    </section>

    <!-- Members -->
    <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 class="text-xl font-semibold text-gray-900">Members ({{ members.length }})</h2>
        <UButton size="sm" variant="outline" @click="showMemberForm = !showMemberForm">
          {{ showMemberForm ? 'Cancel' : '+ Create Member' }}
        </UButton>
      </div>
      <div v-if="memberError" class="mb-4 text-sm text-red-600">{{ memberError }}</div>
      <form v-if="showMemberForm" class="mb-6 p-4 rounded-lg border border-gray-100 bg-gray-50 space-y-4" @submit.prevent="createMember">
        <UFormField label="Name *">
          <UInput v-model="memberForm.name" placeholder="Name" required />
        </UFormField>
        <UFormField label="Email *">
          <UInput v-model="memberForm.email" type="email" placeholder="Email" required />
        </UFormField>
        <UFormField label="Slack username">
          <UInput v-model="memberForm.slack_username" placeholder="@username" />
        </UFormField>
        <UFormField label="Location">
          <USelectMenu
            v-model="memberForm.location_id"
            :items="memberLocationOptions"
            value-key="value"
            class="w-full"
            @update:model-value="memberForm.team_id = ''"
          >
            <template #leading>
              <UIcon name="i-lucide-map-pin" class="size-4 text-gray-500" />
            </template>
          </USelectMenu>
        </UFormField>
        <UFormField label="Team">
          <USelectMenu
            v-model="memberForm.team_id"
            :items="filteredTeamOptions"
            value-key="value"
            class="w-full"
          >
            <template #leading>
              <UIcon name="i-lucide-users" class="size-4 text-gray-500" />
            </template>
          </USelectMenu>
        </UFormField>
        <UButton type="submit" :loading="memberCreating">Create Member</UButton>
      </form>
      <div v-if="members.length === 0 && !pendingMembers" class="text-sm text-gray-500 py-4">No members yet. Create one above.</div>
      <ul v-else class="space-y-2">
        <li
          v-for="member in members"
          :key="member._id"
          class="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-4 py-3 hover:bg-gray-50"
        >
          <NuxtLink
            :to="`/members/${member._id}`"
            class="min-w-0 flex-1 hover:underline focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded"
          >
            <span class="font-medium text-gray-900">{{ member.name }}</span>
            <span
              v-if="member.is_active === false"
              class="ml-2 inline-flex rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700"
            >Inactive</span>
            <span class="ml-2 text-sm text-gray-500">{{ member.email }}</span>
            <span v-if="member.slack_username" class="ml-2 text-xs text-gray-400">@{{ member.slack_username }}</span>
          </NuxtLink>
          <UButton
            size="xs"
            variant="ghost"
            color="red"
            icon="i-lucide-trash-2"
            :aria-label="`Delete ${member.name}`"
            :loading="deletingMemberId === member._id"
            @click.prevent="deleteMember(member._id, member.name)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

type LocationItem = { _id: string; name: string; address?: string; city?: string; country?: string }
type TeamItem = { _id: string; name: string; location_id?: string; description?: string }
type MemberItem = { _id: string; name: string; email: string; slack_username?: string; is_active?: boolean }

const showLocationForm = ref(false)
const showTeamForm = ref(false)
const showMemberForm = ref(false)
const locationError = ref('')
const teamError = ref('')
const memberError = ref('')
const locationCreating = ref(false)
const teamCreating = ref(false)
const memberCreating = ref(false)
const deletingLocationId = ref<string | null>(null)
const deletingTeamId = ref<string | null>(null)
const deletingMemberId = ref<string | null>(null)

const locationForm = reactive({ name: '', address: '', city: '', country: '' })
const teamForm = reactive({ name: '', location_id: '', description: '' })
const memberForm = reactive({ name: '', email: '', slack_username: '', location_id: '', team_id: '' })

const { data: locationsData, pending: pendingLocations, refresh: refreshLocations } = await useFetch<{ success: boolean; data: LocationItem[] }>('/api/locations')
const { data: teamsData, pending: pendingTeams, refresh: refreshTeams } = await useFetch<{ success: boolean; data: TeamItem[] }>('/api/teams')
const { data: membersData, pending: pendingMembers, refresh: refreshMembers } = await useFetch<{ success: boolean; data: MemberItem[] }>('/api/members')

const locations = computed(() => locationsData.value?.data ?? [])
const teams = computed(() => teamsData.value?.data ?? [])
const members = computed(() => membersData.value?.data ?? [])

const teamsByLocation = computed(() => {
  const map = new Map<string, TeamItem[]>()
  for (const loc of locations.value) {
    map.set(loc._id, teams.value.filter((t: TeamItem) => t.location_id === loc._id))
  }
  return map
})

const locationOptions = computed(() =>
  locations.value.map((l: LocationItem) => ({ label: l.name, value: l._id }))
)
const memberLocationOptions = computed(() => [
  { label: 'None', value: '' },
  ...locations.value.map((l: LocationItem) => ({ label: l.name, value: l._id })),
])
const filteredTeamOptions = computed(() => {
  const list = memberForm.location_id
    ? teams.value.filter((t: TeamItem) => t.location_id === memberForm.location_id)
    : teams.value
  return [{ label: 'None', value: '' }, ...list.map((t: TeamItem) => ({ label: t.name, value: t._id }))]
})

function locationName(id: string) {
  return locations.value.find((l) => l._id === id)?.name ?? id
}

function connectedTeams(locationId: string) {
  return teamsByLocation.value.get(locationId) ?? []
}

async function createLocation() {
  locationError.value = ''
  locationCreating.value = true
  try {
    const res = await $fetch<{ success: boolean; error?: string }>('/api/locations', {
      method: 'POST',
      body: {
        name: locationForm.name,
        address: locationForm.address || undefined,
        city: locationForm.city || undefined,
        country: locationForm.country || undefined,
      },
    })
    if (res.success) {
      locationForm.name = ''
      locationForm.address = ''
      locationForm.city = ''
      locationForm.country = ''
      showLocationForm.value = false
      await refreshLocations()
    } else {
      locationError.value = res.error ?? 'Failed to create location'
    }
  } catch (e) {
    locationError.value = e instanceof Error ? e.message : 'Failed to create location'
  } finally {
    locationCreating.value = false
  }
}

async function createTeam() {
  teamError.value = ''
  if (!teamForm.location_id) {
    teamError.value = 'Please select a location'
    return
  }
  teamCreating.value = true
  try {
    const res = await $fetch<{ success: boolean; error?: string }>('/api/teams', {
      method: 'POST',
      body: {
        name: teamForm.name,
        location_id: teamForm.location_id,
        description: teamForm.description || undefined,
      },
    })
    if (res.success) {
      teamForm.name = ''
      teamForm.location_id = ''
      teamForm.description = ''
      showTeamForm.value = false
      await refreshTeams()
    } else {
      teamError.value = res.error ?? 'Failed to create team'
    }
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Failed to create team'
  } finally {
    teamCreating.value = false
  }
}

async function createMember() {
  memberError.value = ''
  memberCreating.value = true
  try {
    const res = await $fetch<{ success: boolean; error?: string }>('/api/members', {
      method: 'POST',
      body: {
        name: memberForm.name,
        email: memberForm.email,
        slack_username: memberForm.slack_username || undefined,
        location_id: memberForm.location_id || undefined,
        team_id: memberForm.team_id || undefined,
      },
    })
    if (res.success) {
      memberForm.name = ''
      memberForm.email = ''
      memberForm.slack_username = ''
      memberForm.location_id = ''
      memberForm.team_id = ''
      showMemberForm.value = false
      await refreshMembers()
    } else {
      memberError.value = res.error ?? 'Failed to create member'
    }
  } catch (e) {
    memberError.value = e instanceof Error ? e.message : 'Failed to create member'
  } finally {
    memberCreating.value = false
  }
}

async function deleteLocation(id: string, name: string) {
  if (!confirm(`Delete location "${name}"? It will be deactivated and removed from the list.`)) return
  deletingLocationId.value = id
  locationError.value = ''
  try {
    await $fetch(`/api/locations/${id}`, { method: 'DELETE' })
    await refreshLocations()
  } catch (e) {
    locationError.value = e instanceof Error ? e.message : 'Failed to delete location'
  } finally {
    deletingLocationId.value = null
  }
}

async function deleteTeam(id: string, name: string) {
  if (!confirm(`Delete team "${name}"? It will be deactivated and removed from the list.`)) return
  deletingTeamId.value = id
  teamError.value = ''
  try {
    await $fetch(`/api/teams/${id}`, { method: 'DELETE' })
    await refreshTeams()
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Failed to delete team'
  } finally {
    deletingTeamId.value = null
  }
}

async function deleteMember(id: string, name: string) {
  if (!confirm(`Delete member "${name}"? They will be deactivated and removed from the list.`)) return
  deletingMemberId.value = id
  memberError.value = ''
  try {
    await $fetch(`/api/members/${id}`, { method: 'DELETE' })
    await refreshMembers()
  } catch (e) {
    memberError.value = e instanceof Error ? e.message : 'Failed to delete member'
  } finally {
    deletingMemberId.value = null
  }
}
</script>
