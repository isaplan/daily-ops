/**
 * @registry-id: TestDataPageRedirect
 * @created: 2026-01-27T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Test data page redirect - redirects to new nested route structure
 * @last-fix: [2026-01-28] Replaced tabs with redirect to nested routes
 */

import { redirect } from 'next/navigation'

export default function TestDataPage() {
  // Redirect to other/all-test-data as default
  redirect('/daily-ops/inbox/other/all-test-data')
}
