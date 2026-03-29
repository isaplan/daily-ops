/**
 * @registry-id: BorkParentPage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork (Trivec) parent page - displays navigation to Bork child pages
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function BorkPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bork (Trivec)</h1>
        <p className="text-muted-foreground">
          Bork (Trivec) data management and viewing
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Sales</CardTitle>
            <CardDescription>View sales data from Bork</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/bork/sales" className="text-primary hover:underline">
              View Sales →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Mix</CardTitle>
            <CardDescription>View product mix data from Bork</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/bork/product-mix" className="text-primary hover:underline">
              View Product Mix →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food & Beverage</CardTitle>
            <CardDescription>View food & beverage data from Bork</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/bork/food-beverage" className="text-primary hover:underline">
              View Food & Beverage →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Basis Report</CardTitle>
            <CardDescription>View basis report data from Bork</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/bork/basis-report" className="text-primary hover:underline">
              View Basis Report →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Per Hour</CardTitle>
            <CardDescription>View sales per hour data from Bork</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/daily-ops/inbox/bork/sales-per-hour" className="text-primary hover:underline">
              View Sales Per Hour →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
