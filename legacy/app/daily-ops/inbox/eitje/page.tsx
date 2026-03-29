/**
 * @registry-id: EitjeParentPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Eitje parent page - displays navigation to Eitje child pages
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function EitjePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Eitje</h1>
        <p className="text-muted-foreground">
          Eitje data management and viewing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Hours</CardTitle>
            <CardDescription>View hours data from Eitje</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/eitje/hours" className="text-primary hover:underline">
              View Hours →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contracts</CardTitle>
            <CardDescription>View contract data from Eitje</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/eitje/contracts" className="text-primary hover:underline">
              View Contracts →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finance</CardTitle>
            <CardDescription>View finance data from Eitje</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/eitje/finance" className="text-primary hover:underline">
              View Finance →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
