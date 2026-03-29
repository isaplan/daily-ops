/**
 * @registry-id: EitjeApiSettingsPage
 * @created: 2026-01-24T00:00:00.000Z
 * @last-modified: 2026-01-30T00:00:00.000Z
 * @description: Eitje API settings page (migrated to /daily-ops/settings/eitje-api)
 * @last-fix: [2026-01-30] Next.js 15: server wrapper awaits params/searchParams, client in EitjeApiSettingsClient
 */

import EitjeApiSettingsClient from './EitjeApiSettingsClient'

type PageProps = {
  params?: Promise<Record<string, string | string[]>>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function EitjeApiSettingsPage(props: PageProps) {
  const params = props.params != null ? await props.params : undefined
  const searchParams = props.searchParams != null ? await props.searchParams : undefined
  return <EitjeApiSettingsClient params={params} searchParams={searchParams} />
}

