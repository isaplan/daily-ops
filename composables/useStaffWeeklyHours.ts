import type { Ref } from 'vue'
import type { StaffWeeklyHoursPayload, StaffWeeklyHoursPreset } from '~/types/daily-ops-staff'

export function useStaffWeeklyHours(memberId: Ref<string | null>) {
  const preset = ref<StaffWeeklyHoursPreset>('ytd')
  const data = ref<StaffWeeklyHoursPayload | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function refresh() {
    const id = String(memberId.value ?? '').trim()
    if (!id) {
      data.value = null
      error.value = null
      return
    }
    pending.value = true
    error.value = null
    try {
      const res = await $fetch<{ success: boolean; data: StaffWeeklyHoursPayload }>(
        `/api/daily-ops/staff/member/${encodeURIComponent(id)}/weekly-hours`,
        { query: { preset: preset.value } }
      )
      data.value = res.success ? res.data : null
    } catch (e) {
      data.value = null
      error.value = e instanceof Error ? e.message : 'Failed to load weekly hours'
    } finally {
      pending.value = false
    }
  }

  watch([memberId, preset], () => {
    void refresh()
  }, { immediate: true })

  return { preset, data, pending, error, refresh }
}
