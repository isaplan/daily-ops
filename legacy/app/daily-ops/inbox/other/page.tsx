/**
 * @registry-id: OtherParentPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Other parent page - displays navigation to Other child pages
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OtherPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Other</h1>
        <p className="text-muted-foreground">
          Other data management and viewing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>All Test Data</CardTitle>
            <CardDescription>View all test data</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/other/all-test-data" className="text-primary hover:underline">
              View All Test Data →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
