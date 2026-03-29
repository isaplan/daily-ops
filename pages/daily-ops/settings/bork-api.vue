<template>
  <div class="container mx-auto py-8 px-4 max-w-4xl">
    <div class="mb-6">
      <h1 class="text-3xl font-bold tracking-tight">Bork API Settings</h1>
      <p class="text-muted-foreground mt-2">
        Configure your Bork API connection and automated sync schedules (all locations)
      </p>
    </div>

    <div class="space-y-6">
      <div class="flex gap-2 border-b">
        <button
          :class="[
            'px-4 py-2 font-medium text-sm border-b-2 transition-colors',
            activeTab === 'credentials'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          ]"
          @click="activeTab = 'credentials'"
        >
          Credentials
        </button>
        <button
          :class="[
            'px-4 py-2 font-medium text-sm border-b-2 transition-colors',
            activeTab === 'cron-jobs'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          ]"
          @click="activeTab = 'cron-jobs'"
        >
          Cron Jobs
        </button>
      </div>

      <div v-if="activeTab === 'credentials'" class="space-y-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="font-semibold text-gray-900">API Credentials (per location)</p>
              <p class="text-sm text-gray-500">Each location has its own base URL and API key. Edit and save per location; leave API key blank to keep current.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div v-for="c in credentials" :key="c._id" class="rounded-lg border p-4 space-y-3">
              <div class="font-medium text-gray-900">{{ c.locationName ?? c.locationId }}</div>
              <div class="grid gap-2 sm:grid-cols-2">
                <div class="space-y-1">
                  <label class="text-xs font-medium text-gray-700">Base URL</label>
                  <UInput
                    :value="editing[c._id]?.baseUrl || c.baseUrl"
                    type="text"
                    placeholder="https://xxx.trivecgateway.com"
                    @update:model-value="(v) => updateEditing(c._id, v, editing[c._id]?.apiKey || '')"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-medium text-gray-700">API Key</label>
                  <UInput
                    :value="editing[c._id]?.apiKey || ''"
                    type="password"
                    :placeholder="c.hasApiKey ? 'Leave blank to keep current' : 'Your API key (appid)'"
                    @update:model-value="(v) => updateEditing(c._id, editing[c._id]?.baseUrl || c.baseUrl, v)"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  size="sm"
                  :loading="savingId === c._id"
                  @click="saveCredential(c)"
                >
                  <template #leading>
                    <UIcon name="i-lucide-save" />
                  </template>
                  Save
                </UButton>
                <UButton
                  size="sm"
                  color="gray"
                  variant="ghost"
                  :loading="testingId === c._id"
                  @click="testCredential(c)"
                >
                  <template #leading>
                    <UIcon name="i-lucide-test-tube" />
                  </template>
                  Test
                </UButton>
                <UIcon
                  v-if="testResult[c._id] === 'success'"
                  name="i-lucide-check-circle"
                  class="h-4 w-4 text-green-600"
                />
                <UIcon
                  v-if="testResult[c._id] === 'error'"
                  name="i-lucide-x-circle"
                  class="h-4 w-4 text-red-600"
                />
              </div>
            </div>

            <UAlert
              v-if="credentials.length === 0"
              color="red"
              title="No credentials found"
              description="No Bork credentials found. Add credentials per location below. Ensure this app uses the same MONGODB_URI and MONGODB_DB_NAME where locations and api_credentials (provider: bork) are stored."
            />

            <div class="border-t pt-4 mt-4">
              <UButton
                color="gray"
                variant="ghost"
                size="sm"
                @click="isAddDialogOpen = true"
              >
                <template #leading>
                  <UIcon name="i-lucide-plus" />
                </template>
                Add credential
              </UButton>
            </div>
          </div>
        </UCard>

        <UModal v-model="isAddDialogOpen" title="Add credential for another location">
          <UCard class="w-full">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold leading-6 text-gray-900">Add credential for another location</h3>
              </div>
            </template>

            <div class="grid gap-4 py-4">
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">Location</label>
                <USelect
                  v-model="addForm.locationId"
                  :options="locationOptions"
                  option-attribute="name"
                  value-attribute="_id"
                  placeholder="Select location"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">Base URL</label>
                <UInput
                  v-model="addForm.baseUrl"
                  type="text"
                  placeholder="https://xxx.trivecgateway.com"
                />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">API Key</label>
                <UInput
                  v-model="addForm.apiKey"
                  type="password"
                  placeholder="API key"
                />
              </div>
            </div>

            <template #footer>
              <div class="flex gap-2">
                <UButton
                  :loading="addingCredential"
                  :disabled="!addForm.locationId || !addForm.baseUrl.trim() || !addForm.apiKey.trim()"
                  @click="addCredential"
                >
                  Add credential
                </UButton>
                <UButton color="gray" @click="isAddDialogOpen = false">Cancel</UButton>
              </div>
            </template>
          </UCard>
        </UModal>
      </div>

      <div v-else-if="activeTab === 'cron-jobs'" class="space-y-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="font-semibold text-gray-900">Daily Data Sync</p>
              <p class="text-sm text-gray-500">Automated sync for today's sales data. Runs for all locations with Bork credentials.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Daily Data Sync</p>
                <p class="text-sm text-gray-600">Sync today's data at set times for all locations</p>
                <p class="text-xs text-gray-500">Sync runs at 01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 23:00 (Europe/Amsterdam)</p>
              </div>
              <USwitch
                :model-value="Boolean(dailyCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('daily-data', checked)"
              />
            </div>
            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Scope</p>
              <p class="text-sm text-gray-600">All locations with Bork credentials; sales (tickets) for today</p>
            </div>
            <p v-if="dailyCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(dailyCronStatus.lastRunUTC || dailyCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-else class="text-sm text-gray-600">Cron job not configured yet. Toggle the switch to create it.</p>
            <UButton
              color="gray"
              variant="ghost"
              size="sm"
              :loading="runningNowJob === 'daily-data'"
              :disabled="!dailyCronStatus"
              @click="runNow('daily-data')"
            >
              Run Now
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="font-semibold text-gray-900">Master Data Sync</p>
              <p class="text-sm text-gray-500">Sync product groups, payment methods, cost centers, and users. Runs for all locations.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Master Data Sync</p>
                <p class="text-sm text-gray-600">Sync master data daily for all locations</p>
              </div>
              <USwitch
                :model-value="Boolean(masterCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('master-data', checked)"
              />
            </div>
            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Endpoints (all locations)</p>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">product_groups</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">payment_methods</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">cost_centers</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">users</span>
                </div>
              </div>
            </div>
            <p v-if="masterCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(masterCronStatus.lastRunUTC || masterCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-else class="text-sm text-gray-600">Cron job not configured yet. Toggle the switch to create it.</p>
            <UButton
              color="gray"
              variant="ghost"
              size="sm"
              :loading="runningNowJob === 'master-data'"
              :disabled="!masterCronStatus"
              @click="runNow('master-data')"
            >
              Run Now
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="font-semibold text-gray-900">Historical Data Sync</p>
              <p class="text-sm text-gray-500">Sync last 30 days of sales data to catch any missed changes. Runs for all locations.</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Historical Data Sync</p>
                <p class="text-sm text-gray-600">Sync last 30 days daily for all locations</p>
              </div>
              <USwitch
                :model-value="Boolean(historicalCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('historical-data', checked)"
              />
            </div>
            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Scope</p>
              <p class="text-sm text-gray-600">All locations; sales (tickets) for last 30 days</p>
            </div>
            <p v-if="historicalCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(historicalCronStatus.lastRunUTC || historicalCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-else class="text-sm text-gray-600">Cron job not configured yet. Toggle the switch to create it.</p>
            <UButton
              color="gray"
              variant="ghost"
              size="sm"
              :loading="runningNowJob === 'historical-data'"
              :disabled="!historicalCronStatus"
              @click="runNow('historical-data')"
            >
              Run Now
            </UButton>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { useHead } from '#imports'

useHead({ title: 'Bork API Settings' })

type CredentialItem = {
  _id: string
  locationId: string
  locationName: string | null
  baseUrl: string
  hasApiKey: boolean
}

type LocationItem = {
  _id: string
  name: string
}

type CronConfig = {
  isActive?: boolean
  lastRun?: string
  lastRunUTC?: string
}

const activeTab = ref<string>('credentials')

const credentials = ref<CredentialItem[]>([])
const locations = ref<LocationItem[]>([])
const editing = reactive<Record<string, { baseUrl: string; apiKey: string }>>({})
const testResult = reactive<Record<string, 'success' | 'error' | undefined>>({})

const addForm = reactive({
  locationId: '',
  baseUrl: '',
  apiKey: '',
})

const isAddDialogOpen = ref(false)
const addingCredential = ref(false)
const savingId = ref<string | null>(null)
const testingId = ref<string | null>(null)

const dailyCronStatus = ref<CronConfig | null>(null)
const masterCronStatus = ref<CronConfig | null>(null)
const historicalCronStatus = ref<CronConfig | null>(null)
const runningNowJob = ref<string | null>(null)

const locationOptions = computed(() => locations.value)

const updateEditing = (id: string, baseUrl: string, apiKey: string) => {
  editing[id] = { baseUrl, apiKey }
}

const loadCredentials = async () => {
  try {
    const response = await $fetch<{ success: boolean; credentials?: CredentialItem[]; error?: string }>('/api/bork/v2/credentials')
    if (!response.success) {
      credentials.value = []
      return
    }
    credentials.value = response.credentials ?? []
    for (const item of credentials.value) {
      if (!editing[item._id]) {
        editing[item._id] = { baseUrl: item.baseUrl, apiKey: '' }
      }
    }
  } catch (error) {
    console.error('Failed to load credentials:', error)
    credentials.value = []
  }
}

const loadLocations = async () => {
  try {
    const response = await $fetch<{ success: boolean; locations?: LocationItem[] }>('/api/bork/v2/locations')
    locations.value = response.locations ?? []
    if (!addForm.locationId && locations.value[0]?._id) {
      addForm.locationId = locations.value[0]._id
    }
  } catch (error) {
    console.error('Failed to load locations:', error)
  }
}

const loadCronStatus = async () => {
  try {
    const [daily, master, historical] = await Promise.all([
      $fetch<{ success: boolean; data?: CronConfig }>('/api/bork/v2/cron?jobType=daily-data'),
      $fetch<{ success: boolean; data?: CronConfig }>('/api/bork/v2/cron?jobType=master-data'),
      $fetch<{ success: boolean; data?: CronConfig }>('/api/bork/v2/cron?jobType=historical-data'),
    ])
    dailyCronStatus.value = daily.data ?? null
    masterCronStatus.value = master.data ?? null
    historicalCronStatus.value = historical.data ?? null
  } catch (error) {
    console.error('Failed to load cron status:', error)
  }
}

const addCredential = async () => {
  if (!addForm.locationId || !addForm.baseUrl.trim() || !addForm.apiKey.trim()) {
    return
  }
  addingCredential.value = true
  try {
    await $fetch('/api/bork/v2/credentials', {
      method: 'POST',
      body: {
        locationId: addForm.locationId,
        baseUrl: addForm.baseUrl.trim(),
        apiKey: addForm.apiKey.trim(),
      },
    })
    addForm.apiKey = ''
    isAddDialogOpen.value = false
    await loadCredentials()
  } catch (error) {
    console.error('Failed to add credential:', error)
  } finally {
    addingCredential.value = false
  }
}

const saveCredential = async (c: CredentialItem) => {
  savingId.value = c._id
  try {
    const e = editing[c._id]
    if (!e.baseUrl.trim()) {
      return
    }
    await $fetch('/api/bork/v2/credentials', {
      method: 'POST',
      body: {
        _id: c._id,
        locationId: c.locationId,
        baseUrl: e.baseUrl.trim(),
        apiKey: e.apiKey.trim() || undefined,
      },
    })
    editing[c._id].apiKey = ''
    await loadCredentials()
  } catch (error) {
    console.error('Failed to save credential:', error)
  } finally {
    savingId.value = null
  }
}

const testCredential = async (c: CredentialItem) => {
  testingId.value = c._id
  try {
    const response = await $fetch<{ success: boolean }>('/api/bork/v2/master-sync', {
      method: 'POST',
      body: {
        locationId: c.locationId,
        endpoint: 'product_groups',
      },
    })
    testResult[c._id] = response.success ? 'success' : 'error'
  } catch (error) {
    console.error('Failed to test credential:', error)
    testResult[c._id] = 'error'
  } finally {
    testingId.value = null
  }
}

const handleCronToggle = async (jobType: string, enabled: boolean) => {
  try {
    if (enabled) {
      const current = jobType === 'daily-data'
        ? dailyCronStatus.value
        : jobType === 'master-data'
          ? masterCronStatus.value
          : historicalCronStatus.value

      if (!current) {
        const defaultConfig = {
          isActive: true,
          schedule: jobType === 'daily-data' ? '0 1,8,15,18,19,20,21,23 * * *' :
                   jobType === 'master-data' ? '0 0 * * *' :
                   '0 1 * * *',
        }

        await $fetch('/api/bork/v2/cron', {
          method: 'POST',
          body: {
            action: 'update',
            jobType,
            config: defaultConfig,
          },
        })
      }
    }

    await $fetch('/api/bork/v2/cron', {
      method: 'POST',
      body: {
        action: enabled ? 'start' : 'stop',
        jobType,
      },
    })

    await loadCronStatus()
  } catch (error: unknown) {
    console.error('Cron action failed:', error)
  }
}

const runNow = async (jobType: string) => {
  runningNowJob.value = jobType
  try {
    await $fetch('/api/bork/v2/cron', {
      method: 'POST',
      body: { action: 'run-now', jobType },
    })
    await loadCronStatus()
  } catch (error: unknown) {
    console.error('Run now failed:', error)
  } finally {
    runningNowJob.value = null
  }
}

onMounted(async () => {
  await Promise.all([loadCredentials(), loadLocations(), loadCronStatus()])
})
</script>