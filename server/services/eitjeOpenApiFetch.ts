/**
 * @registry-id: eitjeOpenApiFetch
 * @created: 2026-04-05T12:00:00.000Z
 * @last-modified: 2026-04-07T22:00:00.000Z
 * @description: Low-level JSON fetch for Eitje Open API with credential header fallbacks
 * @last-fix: [2026-04-07] Primary auth: legacy Partner plus Api header quad from v2-api-client; Basic as fallback
 *
 * @exports-to:
 * ✓ server/services/eitjeSyncService.ts
 * ✓ server/utils/eitjeApiCredentials.ts
 */

export type EitjeStoredCredentials = {
  baseUrl: string
  partner_username: string
  partner_password: string
  api_username: string
  api_password: string
  /**
   * False when partner fields were missing in storage and were filled from API username/password.
   * Used only for Basic/OpenAPI fallback attempts after the legacy four-header scheme.
   */
  partnerCredentialsDistinct: boolean
}

/** Ensure requests hit `/open_api` when the host is Eitje but the path was omitted. */
export function normalizeEitjeBaseUrl (raw: string): string {
  const t = raw.trim()
  const noTrail = t.replace(/\/$/, '')
  if (!noTrail) return 'https://open-api.eitje.app/open_api'
  try {
    const href = noTrail.includes('://') ? noTrail : `https://${noTrail}`
    const u = new URL(href)
    const host = u.hostname.toLowerCase()
    const pathNorm = (u.pathname || '').replace(/\/$/, '') || ''
    if (host.includes('eitje.app') && pathNorm === '') {
      return `${u.origin}/open_api`
    }
  } catch {
    /* ignore */
  }
  return noTrail
}

function basicAuth (user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`
}

export type EitjeFetchResult = {
  ok: boolean
  status: number
  data: unknown
  url: string
  authAttempt: string
}

/** Same as legacy `legacy/app/lib/eitje/v2-api-client.ts` createHeaders() — this is what worked in Next.js. */
export function legacyEitjeV2Headers (creds: EitjeStoredCredentials): Record<string, string> {
  return {
    'Partner-Username': creds.partner_username,
    'Partner-Password': creds.partner_password,
    'Api-Username': creds.api_username,
    'Api-Password': creds.api_password,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

/** Legacy headers first; Basic + X-OpenAPI only as fallbacks for other deployments. */
export async function eitjeFetchJson (
  creds: EitjeStoredCredentials,
  pathOrUrl: string,
  opts?: { query?: Record<string, string | undefined> }
): Promise<EitjeFetchResult> {
  const base = normalizeEitjeBaseUrl(creds.baseUrl).replace(/\/$/, '')
  const path = pathOrUrl.startsWith('http') ? pathOrUrl : `${base}/${pathOrUrl.replace(/^\//, '')}`
  const url = new URL(path)
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== '') url.searchParams.set(k, v)
    }
  }

  const hasPartnerValues = Boolean(creds.partner_username?.trim() && creds.partner_password?.trim())
  const useDualAuth = hasPartnerValues && creds.partnerCredentialsDistinct

  const dualHeaders: Record<string, string> = {
    Authorization: basicAuth(creds.api_username, creds.api_password),
    'X-OpenAPI-Partner-Username': creds.partner_username,
    'X-OpenAPI-Partner-Password': creds.partner_password,
  }

  const attempts: { label: string; headers: Record<string, string> }[] = [
    { label: 'legacy_partner_api_headers', headers: legacyEitjeV2Headers(creds) },
  ]

  if (useDualAuth) {
    attempts.push({ label: 'api_basic_plus_partner_headers', headers: dualHeaders })
  }

  attempts.push({
    label: 'api_basic_only',
    headers: {
      Authorization: basicAuth(creds.api_username, creds.api_password),
      Accept: 'application/json',
    },
  })

  if (useDualAuth) {
    attempts.push({
      label: 'partner_basic_only',
      headers: {
        Authorization: basicAuth(creds.partner_username, creds.partner_password),
        Accept: 'application/json',
      },
    })
  }

  if (hasPartnerValues && !useDualAuth) {
    attempts.push({ label: 'api_basic_plus_partner_headers_imputed', headers: dualHeaders })
  }

  let last: EitjeFetchResult = {
    ok: false,
    status: 0,
    data: null,
    url: url.toString(),
    authAttempt: 'none',
  }

  for (const a of attempts) {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...a.headers,
      },
    })
    const text = await res.text()
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) as unknown : null
    } catch {
      // keep raw text
    }
    last = { ok: res.ok, status: res.status, data, url: url.toString(), authAttempt: a.label }
    if (res.ok) return last
  }

  return last
}
