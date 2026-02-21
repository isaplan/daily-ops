export type EnvironmentId = 'daily-ops' | 'daily-work' | 'daily-notes'

export const ENVIRONMENT_LABELS: Record<EnvironmentId, string> = {
  'daily-ops': 'Daily Ops',
  'daily-work': 'Daily Work',
  'daily-notes': 'Daily Notes',
}
