import type { DailyOpsSimplePnLAssumptions } from '~/types/daily-ops-revenue'

/** Keys for documents in the `app_settings` Mongo collection. */
export const APP_SETTING_KEYS = {
  PNL_ASSUMPTIONS: 'pnl_assumptions',
} as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS]

export type AppSettingCategory = 'calculations' | 'integrations' | 'ui'

export type AppSettingDocument<T = unknown> = {
  key: AppSettingKey
  category: AppSettingCategory
  value: T
  schemaVersion: number
  description?: string
  updatedAt: Date
  /** Future: member/user id when RBAC write checks land. */
  updatedBy?: string | null
}

export type PnlAssumptionsSettingValue = DailyOpsSimplePnLAssumptions

export type PnlAssumptionsSettingDto = {
  assumptions: PnlAssumptionsSettingValue
  source: 'mongo' | 'default'
  updatedAt: string | null
}
