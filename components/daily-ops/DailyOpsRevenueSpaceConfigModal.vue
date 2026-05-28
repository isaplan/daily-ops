<template>
  <UModal
    v-model="open"
    :ui="{
      overlay: 'bg-black/60',
      content: 'w-[calc(100vw-2rem)] max-w-2xl',
    }"
  >
    <template #content>
      <div class="max-h-[85vh] overflow-y-auto rounded-lg bg-white p-6">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Revenue space config</h2>
            <p class="mt-1 text-xs text-gray-500">
              Map Bork table numbers to spaces per location. Rebuilds last 60 days after save.
            </p>
          </div>
          <UButton
            size="sm"
            icon="i-lucide-x"
            aria-label="Close"
            class="shrink-0 bg-gray-900! text-white!"
            @click="open = false"
          />
        </div>

        <UFormField label="Location" class="mb-4">
          <USelectMenu
            v-model="selectedLocationId"
            :items="locationOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div v-if="pending" class="py-8 text-center text-sm text-gray-500">Loading spaces…</div>
        <div v-else-if="loadError" class="mb-4 text-sm text-red-600">{{ loadError }}</div>

        <div v-else class="space-y-4">
          <div
            v-for="(space, index) in draftSpaces"
            :key="space.id"
            class="rounded-lg border border-gray-200 p-4"
          >
            <div class="mb-3 flex items-center justify-between gap-2">
              <UInput
                v-model="space.name"
                placeholder="Space name"
                class="flex-1"
                :disabled="space.id === 'overig'"
              />
              <UButton
                v-if="space.id !== 'overig'"
                size="xs"
                variant="ghost"
                color="red"
                icon="i-lucide-trash-2"
                aria-label="Delete space"
                @click="removeSpace(index)"
              />
            </div>
            <UFormField
              v-if="space.id !== 'overig'"
              label="Table ranges / numbers"
              description="e.g. 1-40, 152, 1001-1030"
            >
              <UTextarea
                v-model="space.tablesInput"
                :rows="2"
                placeholder="1-40, 152-154, 1001"
              />
            </UFormField>
            <p v-else class="text-xs text-gray-500">Catch-all for tables not matched by other spaces.</p>
          </div>

          <UButton size="sm" variant="outline" icon="i-lucide-plus" @click="addSpace">
            Add space
          </UButton>

          <div v-if="saveError" class="text-sm text-red-600">{{ saveError }}</div>
          <div v-if="saveMessage" class="text-sm text-green-700">{{ saveMessage }}</div>

          <div class="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
            <UButton
              class="bg-gray-900! text-white!"
              :loading="saving"
              :disabled="!selectedLocationId || draftSpaces.length === 0"
              @click="saveOnly"
            >
              Save
            </UButton>
            <UButton
              variant="outline"
              :loading="rebuilding"
              :disabled="!selectedLocationId || draftSpaces.length === 0"
              @click="saveAndRebuild"
            >
              Save &amp; rebuild last 60 days
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { LocationRevenueSpace } from '~/types/location-revenue-spaces'

type DraftSpace = LocationRevenueSpace & { tablesInput: string }
type LocationOption = { label: string; value: string }

const props = defineProps<{
  initialLocationId?: string | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  saved: []
}>()

const { data: locationsData } = useFetch<{ success: boolean; data: Array<{ _id: string; name: string }> }>(
  '/api/locations',
  { server: false, lazy: true },
)

const locationOptions = computed<LocationOption[]>(() =>
  (locationsData.value?.data ?? []).map((l) => ({ label: l.name, value: l._id })),
)

const selectedLocationId = ref<string>('')
const draftSpaces = ref<DraftSpace[]>([])
const pending = ref(false)
const saving = ref(false)
const rebuilding = ref(false)
const loadError = ref('')
const saveError = ref('')
const saveMessage = ref('')

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      if (props.initialLocationId) {
        selectedLocationId.value = props.initialLocationId
      } else if (!selectedLocationId.value && locationOptions.value[0]) {
        selectedLocationId.value = locationOptions.value[0].value
      }
      void loadSpaces()
    }
  },
)

watch(locationOptions, (opts) => {
  if (!selectedLocationId.value && opts[0]) selectedLocationId.value = opts[0].value
})

watch(selectedLocationId, () => {
  if (open.value) void loadSpaces()
})

function toDraft(spaces: LocationRevenueSpace[]): DraftSpace[] {
  return spaces.map((space) => ({
    ...space,
    tablesInput: formatTablesInput(space),
  }))
}

function formatTablesInput(space: LocationRevenueSpace): string {
  const parts = [
    ...space.tableRanges.map((r) => (r.min === r.max ? String(r.min) : `${r.min}-${r.max}`)),
    ...space.individualTables.map(String),
  ]
  return parts.join(', ')
}

function parseTablesInput(input: string): Pick<LocationRevenueSpace, 'tableRanges' | 'individualTables'> {
  const tableRanges: LocationRevenueSpace['tableRanges'] = []
  const individualTables: number[] = []
  for (const part of input.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const min = Number(rangeMatch[1])
      const max = Number(rangeMatch[2])
      if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
        tableRanges.push({ min: Math.trunc(min), max: Math.trunc(max) })
      }
      continue
    }
    const n = Number(part)
    if (Number.isFinite(n) && n > 0) individualTables.push(Math.trunc(n))
  }
  return { tableRanges, individualTables }
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'space'
}

async function loadSpaces() {
  if (!selectedLocationId.value) return
  pending.value = true
  loadError.value = ''
  saveMessage.value = ''
  try {
    const res = await $fetch<{ success: boolean; data: { spaces: LocationRevenueSpace[]; seeded: boolean } }>(
      `/api/locations/${selectedLocationId.value}/revenue-spaces`,
    )
    draftSpaces.value = toDraft(res.data.spaces)
    if (res.data.seeded) saveMessage.value = 'Default spaces seeded for this location.'
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load spaces'
    draftSpaces.value = []
  } finally {
    pending.value = false
  }
}

function addSpace() {
  draftSpaces.value.push({
    id: `new-${Date.now()}`,
    name: '',
    tableRanges: [],
    individualTables: [],
    tablesInput: '',
  })
}

function removeSpace(index: number) {
  draftSpaces.value.splice(index, 1)
}

function buildPayload(): LocationRevenueSpace[] {
  return draftSpaces.value
    .filter((s) => s.name.trim() || s.id === 'overig')
    .map((space) => {
      if (space.id === 'overig') {
        return { id: 'overig', name: 'Overig', tableRanges: [], individualTables: [] }
      }
      const parsed = parseTablesInput(space.tablesInput)
      return {
        id: space.id.startsWith('new-') ? slugify(space.name) : space.id,
        name: space.name.trim(),
        tableRanges: parsed.tableRanges,
        individualTables: parsed.individualTables,
      }
    })
}

async function saveOnly() {
  if (!selectedLocationId.value) return
  saving.value = true
  saveError.value = ''
  saveMessage.value = ''
  try {
    await $fetch(`/api/locations/${selectedLocationId.value}/revenue-spaces`, {
      method: 'PUT',
      body: { spaces: buildPayload() },
    })
    saveMessage.value = 'Spaces saved.'
    emit('saved')
    await loadSpaces()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save spaces'
  } finally {
    saving.value = false
  }
}

async function saveAndRebuild() {
  if (!selectedLocationId.value) return
  rebuilding.value = true
  saveError.value = ''
  saveMessage.value = ''
  try {
    await $fetch(`/api/locations/${selectedLocationId.value}/revenue-spaces`, {
      method: 'PUT',
      body: { spaces: buildPayload() },
    })
    const rebuild = await $fetch<{ built: number; errors: number; startDate: string; endDate: string }>(
      '/api/daily-ops/snapshot/rebuild-spaces',
      { method: 'POST', body: { locationId: selectedLocationId.value, days: 60 } },
    )
    saveMessage.value = `Saved. Rebuilt ${rebuild.built} snapshot(s) for ${rebuild.startDate}–${rebuild.endDate}.`
    emit('saved')
    await loadSpaces()
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save and rebuild'
  } finally {
    rebuilding.value = false
  }
}
</script>
