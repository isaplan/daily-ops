<template>
  <div class="container mx-auto py-8 px-4 max-w-4xl">
    <div class="mb-6">
      <h1 class="text-3xl font-bold tracking-tight">Eitje API Settings</h1>
      <p class="text-muted-foreground mt-2">
        Configure your Eitje API connection and automated sync schedules
      </p>
    </div>

    <div class="space-y-6">
      <UAlert
        v-if="connectionStatus !== 'idle' && activeTab === 'cron-jobs'"
        class="mb-2"
        :color="connectionStatus === 'success' ? 'green' : 'red'"
        :title="connectionStatus === 'success' ? 'Sync result' : 'Sync failed'"
        :description="connectionMessage"
        :icon="connectionStatus === 'success' ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
      />
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
              <p class="font-semibold text-gray-900">API Credentials</p>
              <p class="text-sm text-gray-500">Enter your Eitje API credentials to connect to the platform</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="space-y-2">
              <label for="baseUrl" class="text-sm font-medium text-gray-700">Base URL</label>
              <UInput
                id="baseUrl"
                v-model="credentials.baseUrl"
                type="text"
                placeholder="https://open-api.eitje.app/open_api"
              />
            </div>

            <div class="space-y-2">
              <label for="partner_username" class="text-sm font-medium text-gray-700">Partner Username</label>
              <UInput
                id="partner_username"
                v-model="credentials.partner_username"
                type="text"
                placeholder="Your partner username"
              />
            </div>

            <div class="space-y-2">
              <label for="partner_password" class="text-sm font-medium text-gray-700">Partner Password</label>
              <UInput
                id="partner_password"
                v-model="credentials.partner_password"
                type="password"
                placeholder="Your partner password"
              />
            </div>

            <div class="space-y-2">
              <label for="api_username" class="text-sm font-medium text-gray-700">API Username</label>
              <UInput
                id="api_username"
                v-model="credentials.api_username"
                type="text"
                placeholder="Your API username"
              />
            </div>

            <div class="space-y-2">
              <label for="api_password" class="text-sm font-medium text-gray-700">API Password</label>
              <UInput
                id="api_password"
                v-model="credentials.api_password"
                type="password"
                placeholder="Your API password"
              />
            </div>

            <UAlert
              v-if="connectionStatus !== 'idle'"
              :color="connectionStatus === 'success' ? 'green' : 'red'"
              :title="connectionStatus === 'success' ? 'Connection successful!' : 'Connection failed'"
              :description="connectionMessage"
              :icon="connectionStatus === 'success' ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
            />

            <div class="flex gap-2">
              <UButton :loading="isSavingCredentials" @click="saveCredentials">
                <template #leading>
                  <UIcon name="i-lucide-save" />
                </template>
                Save Credentials
              </UButton>
              <UButton
                color="gray"
                variant="ghost"
                :loading="isTestingConnection"
                @click="testConnection"
              >
                <template #leading>
                  <UIcon name="i-lucide-test-tube" />
                </template>
                Test Connection
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <div v-else-if="activeTab === 'cron-jobs'" class="space-y-6">
        <UCard>
          <template #header>
            <div class="space-y-1">
              <p class="font-semibold text-gray-900">Daily Data Sync</p>
              <p class="text-sm text-gray-500">Automated sync for daily labor and revenue data</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Daily Data Sync</p>
                <p class="text-sm text-gray-600">Sync today's data at set times</p>
                <p class="text-xs text-gray-500">Sync runs at 01:00, 08:00, 15:00, 18:00, 19:00, 20:00, 21:00, 23:00 (Europe/Amsterdam)</p>
              </div>
              <USwitch
                :model-value="Boolean(dailyCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('daily-data', checked)"
              />
            </div>

            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Endpoints being synced:</p>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">time_registration_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">revenue_days</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">planning_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">availability_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">leave_requests</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">events</span>
                </div>
              </div>
            </div>

            <p v-if="dailyCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(dailyCronStatus.lastRunUTC || dailyCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-if="dailyCronStatus?.lastSyncMessage" class="text-xs text-gray-500 mt-1">
              {{ dailyCronStatus.lastSyncOk ? 'Sync: ' : 'Last error: ' }}{{ dailyCronStatus.lastSyncMessage }}
            </p>
            <p v-if="!dailyCronStatus" class="text-sm text-gray-600">
              Cron job not configured yet. Toggle the switch to create it.
            </p>
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
              <p class="text-sm text-gray-500">Sync environments, teams, users, and shift types</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Master Data Sync</p>
                <p class="text-sm text-gray-600">Sync master data daily</p>
              </div>
              <USwitch
                :model-value="Boolean(masterCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('master-data', checked)"
              />
            </div>

            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Endpoints being synced:</p>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">environments</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">teams</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">users</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">shift_types</span>
                </div>
              </div>
            </div>

            <p v-if="masterCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(masterCronStatus.lastRunUTC || masterCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-if="masterCronStatus?.lastSyncMessage" class="text-xs text-gray-500 mt-1">
              {{ masterCronStatus.lastSyncOk ? 'Sync: ' : 'Last error: ' }}{{ masterCronStatus.lastSyncMessage }}
            </p>
            <p v-if="!masterCronStatus" class="text-sm text-gray-600">
              Cron job not configured yet. Toggle the switch to create it.
            </p>
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
              <p class="text-sm text-gray-500">Sync last 30 days of data to catch any missed changes</p>
            </div>
          </template>

          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-gray-900">Enable Historical Data Sync</p>
                <p class="text-sm text-gray-600">Sync last 30 days daily</p>
              </div>
              <USwitch
                :model-value="Boolean(historicalCronStatus?.isActive)"
                @update:model-value="(checked) => handleCronToggle('historical-data', checked)"
              />
            </div>

            <div class="border-t pt-4">
              <p class="text-sm font-semibold mb-2 block text-gray-900">Endpoints being synced:</p>
              <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">time_registration_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">revenue_days</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">planning_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">availability_shifts</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">leave_requests</span>
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-check-circle" class="h-3 w-3 text-green-600" />
                  <span class="text-gray-600">events</span>
                </div>
              </div>
            </div>

            <p v-if="historicalCronStatus?.lastRun" class="text-sm text-gray-600">
              Last run: {{ new Date(String(historicalCronStatus.lastRunUTC || historicalCronStatus.lastRun)).toLocaleString() }}
            </p>
            <p v-if="historicalCronStatus?.lastSyncMessage" class="text-xs text-gray-500 mt-1">
              {{ historicalCronStatus.lastSyncOk ? 'Sync: ' : 'Last error: ' }}{{ historicalCronStatus.lastSyncMessage }}
            </p>
            <p v-if="!historicalCronStatus" class="text-sm text-gray-600">
              Cron job not configured yet. Toggle the switch to create it.
            </p>
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
import { ref, onMounted, reactive } from 'vue'
import { useHead } from '#imports'

useHead({ title: 'Eitje API Settings' })

type EitjeSyncDetail = {
  ok?: boolean
  message?: string
  timeRegistration?: { upserted?: number; fetched?: number; error?: string }
  aggregation?: { inserted?: number; deletedPeriods?: number; error?: string }
  master?: { endpoints?: Array<{ name: string; fetched?: number; upserted?: number; error?: string }> }
}

type CronConfig = {
  isActive?: boolean
  lastRun?: string
  lastRunUTC?: string
  lastSyncAt?: string | null
  lastSyncOk?: boolean | null
  lastSyncMessage?: string | null
  lastSyncDetail?: EitjeSyncDetail | null
}

type CredentialsState = {
  baseUrl: string
  partner_username: string
  partner_password: string
  api_username: string
  api_password: string
}

const activeTab = ref<string>('credentials')

const credentials = reactive<CredentialsState>({
  baseUrl: 'https://open-api.eitje.app/open_api',
  partner_username: '',
  partner_password: '',
  api_username: '',
  api_password: '',
})

const isSavingCredentials = ref(false)
const isTestingConnection = ref(false)
const connectionStatus = ref<'idle' | 'success' | 'error'>('idle')
const connectionMessage = ref('')

const dailyCronStatus = ref<CronConfig | null>(null)
const masterCronStatus = ref<CronConfig | null>(null)
const historicalCronStatus = ref<CronConfig | null>(null)
const runningNowJob = ref<string | null>(null)

const loadCredentials = async () => {
  try {
    const response = await $fetch<{ success: boolean; credentials?: Record<string, unknown> }>('/api/eitje/v2/credentials')
    if (!response.success || !response.credentials) return

    const additionalConfig = (response.credentials.additionalConfig as Record<string, unknown> | undefined) ?? {}
    credentials.baseUrl = String(response.credentials.baseUrl ?? 'https://open-api.eitje.app/open_api')
    credentials.partner_username = String(additionalConfig.partner_username ?? '')
    credentials.partner_password = String(additionalConfig.partner_password ?? '')
    credentials.api_username = String(additionalConfig.api_username ?? '')
    credentials.api_password = String(additionalConfig.api_password ?? '')
  } catch (error) {
    console.error('Failed to load credentials:', error)
  }
}

const loadCronStatus = async () => {
  try {
    const [daily, master, historical] = await Promise.all([
      $fetch<{ success: boolean; data?: CronConfig }>('/api/eitje/v2/cron?jobType=daily-data'),
      $fetch<{ success: boolean; data?: CronConfig }>('/api/eitje/v2/cron?jobType=master-data'),
      $fetch<{ success: boolean; data?: CronConfig }>('/api/eitje/v2/cron?jobType=historical-data'),
    ])
    dailyCronStatus.value = daily.data ?? null
    masterCronStatus.value = master.data ?? null
    historicalCronStatus.value = historical.data ?? null
  } catch (error) {
    console.error('Failed to load cron status:', error)
  }
}

const saveCredentials = async () => {
  isSavingCredentials.value = true
  try {
    const response = await $fetch<{ success: boolean; error?: string }>('/api/eitje/v2/credentials', {
      method: 'POST',
      body: {
        baseUrl: credentials.baseUrl,
        additionalConfig: {
          partner_username: credentials.partner_username,
          partner_password: credentials.partner_password,
          api_username: credentials.api_username,
          api_password: credentials.api_password,
        },
      },
    })
    if (response.success) {
      connectionStatus.value = 'success'
      connectionMessage.value = 'Credentials saved successfully'
    } else {
      connectionStatus.value = 'error'
      connectionMessage.value = response.error || 'Failed to save credentials'
    }
  } catch (error: unknown) {
    connectionStatus.value = 'error'
    connectionMessage.value = error instanceof Error ? error.message : 'Failed to save credentials'
  } finally {
    isSavingCredentials.value = false
  }
}

const testConnection = async () => {
  isTestingConnection.value = true
  connectionStatus.value = 'idle'
  try {
    const response = await $fetch<{ success: boolean; message?: string; error?: string }>('/api/eitje/v2/sync', {
      method: 'POST',
      body: { endpoint: 'environments' },
    })
    if (response.success) {
      connectionStatus.value = 'success'
      connectionMessage.value = response.message || 'Connection successful!'
    } else {
      connectionStatus.value = 'error'
      connectionMessage.value = response.error || response.message || 'Connection failed'
    }
  } catch (error: unknown) {
    connectionStatus.value = 'error'
    connectionMessage.value = error instanceof Error ? error.message : 'Connection test failed'
  } finally {
    isTestingConnection.value = false
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
          enabledEndpoints: jobType === 'daily-data' || jobType === 'historical-data' ? {
            hours: true,
            revenue: true,
            planning: false,
          } : undefined,
          enabledMasterEndpoints: jobType === 'master-data' ? {
            environments: true,
            teams: true,
            users: true,
            shiftTypes: true,
          } : undefined,
        }

        await $fetch('/api/eitje/v2/cron', {
          method: 'POST',
          body: {
            action: 'update',
            jobType,
            config: defaultConfig,
          },
        })
      }
    }

    await $fetch('/api/eitje/v2/cron', {
      method: 'POST',
      body: {
        action: enabled ? 'start' : 'stop',
        jobType,
      },
    })

    await loadCronStatus()
  } catch (error: unknown) {
    connectionStatus.value = 'error'
    connectionMessage.value = error instanceof Error ? error.message : 'Action failed'
  }
}

const runNow = async (jobType: string) => {
  runningNowJob.value = jobType
  try {
    const response = await $fetch<{
      success: boolean
      message?: string
      sync?: EitjeSyncDetail & { jobType?: string; master?: EitjeSyncDetail['master'] }
    }>('/api/eitje/v2/cron', {
      method: 'POST',
      body: { action: 'run-now', jobType },
    })
    await loadCronStatus()
    connectionStatus.value = response.success ? 'success' : 'error'
    const detail = response.sync
    const parts: string[] = [response.message || (response.success ? 'Sync completed' : 'Sync failed')]
    if (detail?.timeRegistration) {
      parts.push(
        `Fetched ${detail.timeRegistration.fetched ?? 0}, upserted ${detail.timeRegistration.upserted ?? 0}`,
      )
    }
    if (detail?.aggregation) {
      parts.push(`Aggregation rows: ${detail.aggregation.inserted ?? 0}`)
    }
    if (detail?.master?.endpoints?.length) {
      parts.push(
        detail.master.endpoints.map((e) => `${e.name}: ${e.fetched ?? 0}`).join('; '),
      )
    }
    connectionMessage.value = parts.join(' · ')
  } catch (error: unknown) {
    connectionStatus.value = 'error'
    connectionMessage.value = error instanceof Error ? error.message : 'Run now failed'
  } finally {
    runningNowJob.value = null
  }
}

onMounted(async () => {
  await Promise.all([loadCredentials(), loadCronStatus()])
})
</script>