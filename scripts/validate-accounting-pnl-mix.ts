/**
 * Validate accounting P&L food/bev mix vs headline totals.
 * Run: npx tsx scripts/validate-accounting-pnl-mix.ts
 */

import {
  ACCOUNTING_PNL_VENUES,
  ACCOUNTING_PNL_YEARS,
  accountingPnlMonthsForYear,
  accountingPnlVenueRow,
  accountingPnlYearTotals,
  type AccountingPnlVenueId,
  type AccountingPnlYear,
} from '../utils/accountingPnlData'
import { accountingPnlMixForRow } from '../utils/accountingPnlMixData'

const venues = ACCOUNTING_PNL_VENUES.map((v) => v.id)
const issues: string[] = []

for (const year of ACCOUNTING_PNL_YEARS) {
  if (year === 2026) continue
  for (const venueId of venues) {
    const annual = accountingPnlYearTotals(year, venueId)
    if (!annual) {
      issues.push(`${year} ${venueId}: missing annual row`)
      continue
    }
    const annualMix = accountingPnlMixForRow(year, venueId, null, annual)
    const revMix = annualMix.revenueFood + annualMix.revenueBeverage
    const revDiff = revMix - annual.revenue
    if (Math.abs(revDiff) > 500) {
      issues.push(
        `${year} ${venueId} annual: food+bev ${revMix} vs revenue ${annual.revenue} (Δ ${revDiff})`,
      )
    }

    let monthRevMix = 0
    for (const month of accountingPnlMonthsForYear(year)) {
      const row = accountingPnlVenueRow(year, venueId, month)
      if (!row) {
        issues.push(`${year} ${venueId} m${month}: missing month row`)
        continue
      }
      const mix = accountingPnlMixForRow(year, venueId, month, row)
      if (mix.revenueFood + mix.revenueBeverage <= 0) {
        issues.push(`${year} ${venueId} m${month}: no food/bev mix`)
      }
      monthRevMix += mix.revenueFood + mix.revenueBeverage
      const cogsSplit = mix.cogsFood + mix.cogsBeverage
      if (Math.abs(cogsSplit - row.cogs) > 2 && mix.cogsFood > 0) {
        issues.push(
          `${year} ${venueId} m${month}: cogs split ${cogsSplit} vs total ${row.cogs}`,
        )
      }
    }

    const annualFromMonths = accountingPnlMonthsForYear(year).reduce(
      (sum, m) => {
        const row = accountingPnlVenueRow(year, venueId as AccountingPnlVenueId, m)
        if (!row) return sum
        const mix = accountingPnlMixForRow(year, venueId as AccountingPnlVenueId, m, row)
        return sum + mix.revenueFood + mix.revenueBeverage
      },
      0,
    )
    if (Math.abs(annualFromMonths - revMix) > 500) {
      issues.push(
        `${year} ${venueId}: monthly mix sum ${annualFromMonths} vs annual mix ${revMix}`,
      )
    }
  }
}

if (issues.length) {
  process.stderr.write(`Mix validation: ${issues.length} issue(s)\n`)
  for (const line of issues) process.stderr.write(`  - ${line}\n`)
  process.exit(1)
}

process.stdout.write('Mix validation OK — 2024/2025 revenue food+bev complete for all venues.\n')
