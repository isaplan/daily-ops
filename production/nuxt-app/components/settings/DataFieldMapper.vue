<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-gray-900">Map Data / Connect Data to DB</h3>
        <p class="text-sm text-gray-500">
          Define how raw source fields map to unified database fields for {{ dataSourceLabel }}.
        </p>
      </div>
      <UButton variant="outline" :loading="loading" @click="reload">Refresh</UButton>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      title="Mapping error"
      :description="errorMessage"
    />

    <div class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <h4 class="font-semibold text-gray-900">Raw Data Fields</h4>
        </template>
        <div class="space-y-3">
          <div v-for="field in rawFields" :key="field.field" class="rounded border border-gray-200 p-3">
            <p class="text-sm font-medium text-gray-900">{{ field.field }}</p>
            <p class="text-xs text-gray-500">Sample: {{ field.sampleValue || '-' }}</p>
            <p class="mt-1 text-xs" :class="isMapped(field.field) ? 'text-green-600' : 'text-amber-600'">
              {{ isMapped(field.field) ? 'Mapped' : 'Not mapped' }}
            </p>
          </div>
          <p v-if="!rawFields.length && !loading" class="text-sm text-gray-500">
            No sample fields available yet.
          </p>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h4 class="font-semibold text-gray-900">Create Mapping</h4>
        </template>
        <div class="space-y-3">
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-800">Source Field</label>
            <USelectMenu
              v-model="form.sourceField"
              :items="sourceFieldOptions"
              value-attribute="value"
              class="w-full"
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-800">Target Field</label>
            <USelectMenu
              v-model="form.targetField"
              :items="targetFieldOptions"
              value-attribute="value"
              class="w-full"
            />
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-800">Data Type</label>
              <USelectMenu
                v-model="form.dataType"
                :items="dataTypeOptions"
                value-attribute="value"
                class="w-full"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-gray-800">Required</label>
              <USwitch v-model="form.isRequired" />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-gray-800">Transformation Rule (optional)</label>
            <UInput v-model="form.transformation" placeholder="e.g. trim|lowercase" />
          </div>
          <UButton :loading="saving" @click="saveMapping">Save Mapping</UButton>
        </div>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-gray-900">Current Mappings</h4>
          <UBadge :color="missingRequiredCount > 0 ? 'warning' : 'success'" variant="soft">
            {{ missingRequiredCount > 0 ? `${missingRequiredCount} required missing` : 'Complete' }}
          </UBadge>
        </div>
      </template>

      <div v-if="mappings.length" class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b text-gray-600">
              <th class="pb-2 pr-3 font-medium">Source</th>
              <th class="pb-2 pr-3 font-medium">Target</th>
              <th class="pb-2 pr-3 font-medium">Type</th>
              <th class="pb-2 pr-3 font-medium">Required</th>
              <th class="pb-2 pr-3 font-medium">Transformation</th>
              <th class="pb-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mapping in mappings" :key="mapping.sourceField + mapping.targetField" class="border-b last:border-0">
              <td class="py-2 pr-3 font-mono text-xs">{{ mapping.sourceField }}</td>
              <td class="py-2 pr-3 font-mono text-xs">{{ mapping.targetField }}</td>
              <td class="py-2 pr-3">{{ mapping.dataType }}</td>
              <td class="py-2 pr-3">{{ mapping.isRequired ? 'Yes' : 'No' }}</td>
              <td class="py-2 pr-3">{{ mapping.transformation || '-' }}</td>
              <td class="py-2 text-right">
                <UButton size="xs" color="error" variant="soft" @click="removeMapping(mapping.sourceField)">
                  Remove
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="text-sm text-gray-500">No mappings configured yet.</p>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { $fetch } from 'ofetch'
import { computed, onMounted, reactive, ref } from 'vue'

type RawField = {
  field: string
  sampleValue: string
}

type FieldMapping = {
  sourceField: string
  targetField: string
  dataType: 'string' | 'number' | 'boolean' | 'date'
  transformation: string | null
  isRequired: boolean
}

const props = defineProps<{
  dataSource: 'eitje' | 'bork'
}>()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const rawFields = ref<RawField[]>([])
const mappings = ref<FieldMapping[]>([])

const dataSourceLabel = computed(() => props.dataSource === 'eitje' ? 'Eitje' : 'Bork')

const form = reactive<FieldMapping>({
  sourceField: '',
  targetField: '',
  dataType: 'string',
  transformation: null,
  isRequired: false,
})

const targetFieldOptions = [
  { label: 'unified_user.primaryId', value: 'unified_user.primaryId' },
  { label: 'unified_user.name', value: 'unified_user.name' },
  { label: 'unified_team.primaryId', value: 'unified_team.primaryId' },
  { label: 'unified_team.name', value: 'unified_team.name' },
  { label: 'unified_location.primaryId', value: 'unified_location.primaryId' },
  { label: 'unified_location.name', value: 'unified_location.name' },
  { label: 'eitje_time_registration_aggregation.total_hours', value: 'eitje_time_registration_aggregation.total_hours' },
  { label: 'eitje_time_registration_aggregation.total_cost', value: 'eitje_time_registration_aggregation.total_cost' },
]

const dataTypeOptions = [
  { label: 'string', value: 'string' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'date', value: 'date' },
]

const sourceFieldOptions = computed(() =>
  rawFields.value.map(field => ({ label: field.field, value: field.field })),
)

const missingRequiredCount = computed(() =>
  mappings.value.filter(mapping => mapping.isRequired && !mapping.targetField).length,
)

const isMapped = (sourceField: string) =>
  mappings.value.some(mapping => mapping.sourceField === sourceField)

const reload = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [sampleRes, mapRes] = await Promise.all([
      $fetch<{ success: boolean; fields?: RawField[] }>(`/api/data-sources/${props.dataSource}/raw-sample`),
      $fetch<{ success: boolean; mappings?: FieldMapping[] }>(`/api/data-sources/${props.dataSource}/field-mapping`),
    ])
    rawFields.value = sampleRes.fields ?? []
    mappings.value = mapRes.mappings ?? []
    if (!form.sourceField && rawFields.value.length) form.sourceField = rawFields.value[0]?.field ?? ''
    if (!form.targetField && targetFieldOptions.length) form.targetField = targetFieldOptions[0]?.value ?? ''
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load mapping data'
  } finally {
    loading.value = false
  }
}

const saveMapping = async () => {
  if (!form.sourceField || !form.targetField) {
    errorMessage.value = 'Source and target fields are required.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/data-sources/${props.dataSource}/field-mapping`, {
      method: 'POST',
      body: {
        sourceField: form.sourceField,
        targetField: form.targetField,
        dataType: form.dataType,
        transformation: form.transformation || null,
        isRequired: form.isRequired,
      },
    })
    await reload()
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to save mapping'
  } finally {
    saving.value = false
  }
}

const removeMapping = async (sourceField: string) => {
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/data-sources/${props.dataSource}/field-mapping`, {
      method: 'POST',
      body: { sourceField, delete: true },
    })
    await reload()
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to remove mapping'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  reload()
})
</script>
