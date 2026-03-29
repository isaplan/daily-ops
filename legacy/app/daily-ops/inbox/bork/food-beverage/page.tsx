/**
 * @registry-id: BorkFoodBeveragePage
 * @created: 2026-01-28T00:00:00.000Z
 * @last-modified: 2026-01-28T00:00:00.000Z
 * @description: Bork food & beverage data page - displays food & beverage data from inbox attachments
 * @last-fix: [2026-01-28] Initial implementation
 */

'use client'

import { FoodBeverageDataView } from '@/components/test-data/FoodBeverageDataView'

export default function BorkFoodBeveragePage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Food & Beverage</h1>
        <p className="text-muted-foreground">
          Raw food & beverage data from inbox attachments - exact copy, no transformations
        </p>
      </div>

      <FoodBeverageDataView />
    </div>
  )
}
