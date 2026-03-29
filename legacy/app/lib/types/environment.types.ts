/**
 * @registry-id: environmentTypes
 * @created: 2026-01-16T16:15:00.000Z
 * @last-modified: 2026-01-24T00:00:00.000Z
 * @description: Type definitions for environment switching
 * @last-fix: [2026-01-24] Renamed environments to daily-work and daily-ops
 */

export type EnvironmentId = 'daily-work' | 'daily-ops'

export interface EnvironmentTheme {
  id: EnvironmentId
  label: string
  accent: string
  paletteId: string
}

export interface EnvironmentConfig {
  id: EnvironmentId
  label: string
  accent: string
}
