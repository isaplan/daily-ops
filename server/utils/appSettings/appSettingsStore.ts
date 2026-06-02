/**
 * @registry-id: appSettingsStore
 * @created: 2026-05-31T12:00:00.000Z
 * @last-modified: 2026-05-31T12:00:00.000Z
 * @description: Generic Mongo store for org-wide app settings (calculations, assumptions, etc.)
 * @last-fix: [2026-05-31] Initial app_settings collection read/write helpers
 * @role-ref: PUT handlers must restrict writes to admin|owner when RBAC is implemented
 *
 * @exports-to:
 * ✓ server/utils/appSettings/pnlAssumptionsSetting.ts
 * ✓ server/api/app-settings/pnl-assumptions.get.ts
 * ✓ server/api/app-settings/pnl-assumptions.put.ts
 */

import type { Db } from 'mongodb'
import type {
  AppSettingCategory,
  AppSettingDocument,
  AppSettingKey,
} from '~/types/app-settings'

export const APP_SETTINGS_COLLECTION = 'app_settings'

export async function getAppSettingDocument<T>(
  db: Db,
  key: AppSettingKey,
): Promise<AppSettingDocument<T> | null> {
  const doc = await db.collection(APP_SETTINGS_COLLECTION).findOne({ key })
  if (!doc || doc.value == null) return null
  return doc as unknown as AppSettingDocument<T>
}

export async function getAppSettingValue<T>(
  db: Db,
  key: AppSettingKey,
  fallback: T,
): Promise<{ value: T; source: 'mongo' | 'default'; updatedAt: Date | null }> {
  const doc = await getAppSettingDocument<T>(db, key)
  if (!doc) {
    return { value: fallback, source: 'default', updatedAt: null }
  }
  return {
    value: doc.value,
    source: 'mongo',
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : null,
  }
}

export async function setAppSettingValue<T>(
  db: Db,
  input: {
    key: AppSettingKey
    category: AppSettingCategory
    value: T
    schemaVersion: number
    description?: string
    updatedBy?: string | null
  },
): Promise<AppSettingDocument<T>> {
  const now = new Date()
  const update = {
    key: input.key,
    category: input.category,
    value: input.value,
    schemaVersion: input.schemaVersion,
    description: input.description,
    updatedAt: now,
    updatedBy: input.updatedBy ?? null,
  }
  await db.collection(APP_SETTINGS_COLLECTION).updateOne(
    { key: input.key },
    { $set: update, $setOnInsert: { createdAt: now } },
    { upsert: true },
  )
  return update as AppSettingDocument<T>
}
