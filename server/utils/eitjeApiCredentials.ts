/**
 * @registry-id: eitjeApiCredentials
 * @created: 2026-04-05T14:00:00.000Z
 * @last-modified: 2026-04-07T20:55:00.000Z
 * @description: Find + normalize Eitje rows in api_credentials (legacy/root/additionalConfig shapes)
 * @last-fix: [2026-04-07] partnerCredentialsDistinct flag; normalize Eitje baseUrl via open_api path
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ server/api/eitje/v2/credentials.get.ts
 */

import type { Db } from 'mongodb'
import { normalizeEitjeBaseUrl, type EitjeStoredCredentials } from '../services/eitjeOpenApiFetch'

function pickStr (...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function nested (row: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  let cur: unknown = row
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return {}
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur && typeof cur === 'object' ? (cur as Record<string, unknown>) : {}
}

/** Next/Mongo sometimes store `additionalConfig` as a JSON string. */
function asObject (v: unknown): Record<string, unknown> {
  if (!v) return {}
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as unknown
      return p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  if (typeof v === 'object') return v as Record<string, unknown>
  return {}
}

function mergedCredentialSources (row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...nested(row, 'secrets'),
    ...nested(row, 'envConfig'),
    ...nested(row, 'config'),
    ...nested(row, 'credentials'),
    ...asObject(row.additional_config),
    ...asObject(row.additionalConfig),
  }
}

/** Provider values / shapes seen in the wild (Next seed, manual Compass, etc.). */
const EITJE_PROVIDER_CLAUSE: Record<string, unknown> = {
  $or: [
    { provider: { $in: ['eitje', 'Eitje', 'eitje-open-api', 'eitje_open_api', 'EITJE'] } },
    { type: 'eitje' },
    { source: 'eitje' },
    { integration: 'eitje' },
  ],
}

/**
 * Prefer active-ish docs; include rows where `isActive` is missing (legacy).
 */
export async function findEitjeCredentialDocument (db: Db): Promise<Record<string, unknown> | null> {
  const coll = db.collection('api_credentials')
  const prefer = await coll.findOne(
    { ...EITJE_PROVIDER_CLAUSE, $nor: [{ isActive: false }] },
    { sort: { updatedAt: -1, createdAt: -1 } }
  )
  if (prefer) return prefer as Record<string, unknown>
  const any = await coll.findOne(
    { ...EITJE_PROVIDER_CLAUSE },
    { sort: { updatedAt: -1, createdAt: -1 } }
  )
  if (any) return any as Record<string, unknown>

  const byUrl = await coll.findOne(
    {
      provider: { $nin: ['bork', 'Bork'] },
      baseUrl: { $regex: /eitje\.app/i },
    },
    { sort: { updatedAt: -1, createdAt: -1 } }
  )
  if (byUrl) return byUrl as Record<string, unknown>

  const guessed = await coll.findOne(
    {
      provider: { $nin: ['bork', 'Bork'] },
      $or: [
        { 'additionalConfig.api_username': { $exists: true } },
        { 'additionalConfig.partner_username': { $exists: true } },
        { 'additional_config.api_username': { $exists: true } },
        { api_username: { $exists: true } },
        { partner_username: { $exists: true } },
      ],
    },
    { sort: { updatedAt: -1, createdAt: -1 } }
  )
  return guessed as Record<string, unknown> | null
}

/**
 * Maps api_credentials document → credentials the Open API client can use.
 * Reads additionalConfig, then root, then common nested blobs.
 */
export function documentToEitjeStoredCredentials (row: Record<string, unknown>): EitjeStoredCredentials | null {
  const ac = mergedCredentialSources(row)

  const api_username = pickStr(
    ac.api_username,
    ac.apiUsername,
    ac.API_USERNAME,
    ac.api_user,
    ac.apiUser,
    ac.venue_username,
    ac.venueUsername,
    ac.username,
    ac.user,
    row.api_username,
    row.apiUsername,
    row.api_user,
    row.username
  )
  const api_password = pickStr(
    ac.api_password,
    ac.apiPassword,
    ac.API_PASSWORD,
    ac.api_pass,
    ac.venue_password,
    ac.venuePassword,
    ac.password,
    row.api_password,
    row.apiPassword,
    row.api_pass,
    row.password
  )

  const partner_username = pickStr(
    ac.partner_username,
    ac.partnerUsername,
    ac.PARTNER_USERNAME,
    ac.partner_user,
    ac.partnerUser,
    row.partner_username,
    row.partnerUsername
  )
  const partner_password = pickStr(
    ac.partner_password,
    ac.partnerPassword,
    ac.PARTNER_PASSWORD,
    ac.partner_pass,
    row.partner_password,
    row.partnerPassword
  )
  const hadRealPartnerInDb = Boolean(partner_username && partner_password)

  const baseUrlRaw = pickStr(
    typeof row.baseUrl === 'string' ? row.baseUrl : '',
    typeof ac.baseUrl === 'string' ? ac.baseUrl : '',
    typeof ac.base_url === 'string' ? ac.base_url : ''
  )
  const baseUrl = normalizeEitjeBaseUrl(baseUrlRaw || 'https://open-api.eitje.app/open_api')

  if (!api_username || !api_password) return null

  let pu = partner_username
  let pp = partner_password
  if (!pu || !pp) {
    pu = api_username
    pp = api_password
  }

  return {
    baseUrl,
    partner_username: pu,
    partner_password: pp,
    api_username,
    api_password,
    partnerCredentialsDistinct: hadRealPartnerInDb,
  }
}

/**
 * Shape for GET /credentials UI — **not** the same as sync validation: show every field we can read
 * so the Nuxt form populates even if one secret uses a legacy key we do not yet map for fetch.
 */
export function documentToCredentialsApiShape (row: Record<string, unknown>): {
  baseUrl: string
  additionalConfig: Record<string, string>
} {
  const ac = mergedCredentialSources(row)
  const stored = documentToEitjeStoredCredentials(row)

  const partner_username = pickStr(
    ac.partner_username,
    ac.partnerUsername,
    ac.PARTNER_USERNAME,
    ac.partner_user,
    row.partner_username,
    row.partnerUsername,
    stored?.partner_username
  )
  const partner_password = pickStr(
    ac.partner_password,
    ac.partnerPassword,
    ac.PARTNER_PASSWORD,
    ac.partner_pass,
    row.partner_password,
    row.partnerPassword,
    stored?.partner_password
  )
  const api_username = pickStr(
    ac.api_username,
    ac.apiUsername,
    ac.api_user,
    ac.venue_username,
    row.api_username,
    row.apiUsername,
    stored?.api_username
  )
  const api_password = pickStr(
    ac.api_password,
    ac.apiPassword,
    ac.api_pass,
    ac.venue_password,
    row.api_password,
    row.apiPassword,
    stored?.api_password
  )

  const baseUrl = normalizeEitjeBaseUrl(
    pickStr(
      typeof row.baseUrl === 'string' ? row.baseUrl : '',
      typeof ac.baseUrl === 'string' ? ac.baseUrl : '',
      typeof ac.base_url === 'string' ? ac.base_url : '',
      stored?.baseUrl
    ) || 'https://open-api.eitje.app/open_api'
  )

  return {
    baseUrl,
    additionalConfig: {
      partner_username,
      partner_password,
      api_username,
      api_password,
    },
  }
}
