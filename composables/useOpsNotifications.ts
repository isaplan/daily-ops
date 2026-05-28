import type { OpsNotificationsCountDto, OpsNotificationsResponseDto } from '~/types/ops-notifications'

export function useOpsNotificationsCount() {
  const { data, pending, refresh, error } = useAsyncData(
    'ops-notifications-count',
    () => $fetch<OpsNotificationsCountDto>('/api/ops-notifications/count'),
    { server: false, lazy: true },
  )

  const count = computed(() => data.value?.total ?? 0)
  const criticalCount = computed(() => data.value?.criticalCount ?? 0)

  return { count, criticalCount, pending, refresh, error }
}

export function useOpsNotificationsList(lookbackDays = 30, includeHidden = false) {
  const { data, pending, error, refresh } = useAsyncData(
    () => `ops-notifications-list-${lookbackDays}-${includeHidden ? 'with-hidden' : 'default'}`,
    () =>
      $fetch<OpsNotificationsResponseDto>('/api/ops-notifications', {
        query: {
          lookbackDays: String(lookbackDays),
          includeHidden: includeHidden ? '1' : '0',
        },
      }),
    { server: false },
  )

  return {
    report: computed(() => data.value ?? null),
    pending,
    error,
    refresh,
  }
}
