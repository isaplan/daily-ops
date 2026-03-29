/**
 * Bork API Settings page – same setup as Eitje API (Credentials + Sync).
 * Credentials are per location (baseUrl, apiKey).
 */

import BorkApiSettingsClient from './BorkApiSettingsClient'

type PageProps = {
  params?: Promise<Record<string, string | string[]>>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function BorkApiSettingsPage(props: PageProps) {
  const params = props.params != null ? await props.params : undefined
  const searchParams = props.searchParams != null ? await props.searchParams : undefined
  return <BorkApiSettingsClient params={params} searchParams={searchParams} />
}
