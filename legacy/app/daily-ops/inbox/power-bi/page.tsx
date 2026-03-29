/**
 * @registry-id: PowerBIParentPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Power-BI parent page - displays navigation to Power-BI child pages
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PowerBIPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Power-BI</h1>
        <p className="text-muted-foreground">
          Power-BI data management and viewing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>View Power-BI reports</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/power-bi/reports" className="text-primary hover:underline">
              View Reports →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
