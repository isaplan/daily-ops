/**
 * @registry-id: borkVatCalculation
 * @created: 2026-05-13T00:00:00.000Z
 * @last-modified: 2026-05-13T12:00:00.000Z
 * @description: Extract ex/inc/vat from a single Bork OrderLine using the raw line's
 *   TotalEx and TotalInc fields (no fixed divisor). Fallback path uses VatPerc only
 *   when TotalEx is missing on the source row.
 * @last-fix: [2026-05-13] DEBUG_VAT: coerce DEBUG to string (boolean env breaks .includes).
 *
 * @architecture:
 *   - Source: raw Bork OrderLine. Confirmed live shape (2026-05-13 inspection):
 *     { Price, Qty, TotalEx, TotalInc, VatNr, VatPerc, ... }
 *   - Never invents a divisor (e.g. 1.21). The line itself carries ex/inc/vat.
 *   - Used in a single accumulation pass — see borkRebuildAggregationV2Service.ts.
 *   - When `DEBUG=bork:vat` env flag is set, prints first 3 lines per service invocation
 *     for visual spot-check. Logs gated, removable post-stability.
 *
 * @exports-to:
 *   ✓ server/services/borkRebuildAggregationV2Service.ts => single line-revenue extractor
 *   ✓ scripts/backfill-bork-vat-fields.ts => validation pass
 */

export type BorkLineRevenue = {
  ex: number
  inc: number
  vat: number
  qty: number
  /** True when ex/vat were derived from VatPerc fallback (not the line's TotalEx) */
  fallback: boolean
}

const DEBUG_VAT = String(process.env.DEBUG ?? '').includes('bork:vat')
let debugSamplePrinted = 0

/**
 * Extract ex/inc/vat revenue from one Bork OrderLine.
 *
 * Preferred path: use line.TotalEx and line.TotalInc directly (confirmed available
 * on every line in live data, see scripts/inspect-bork-vat-shape.ts).
 *
 * Fallback (rare): when TotalEx is missing or zero on a non-zero-quantity line,
 * compute ex from VatPerc. We never assume a default rate.
 */
export function extractLineRevenue(line: unknown): BorkLineRevenue {
  if (!line || typeof line !== 'object') {
    return { ex: 0, inc: 0, vat: 0, qty: 0, fallback: false }
  }

  const l = line as {
    Price?: number
    Qty?: number
    TotalEx?: number
    TotalInc?: number
    VatPerc?: number
  }

  const qty = Number(l.Qty ?? 0)
  const rawInc = Number(l.TotalInc ?? (Number(l.Price ?? 0) * qty))
  const rawEx = Number(l.TotalEx ?? 0)
  const vatPerc = Number(l.VatPerc ?? 0)

  let ex: number
  let inc: number
  let vat: number
  let fallback = false

  if (rawEx !== 0 || rawInc === 0) {
    ex = rawEx
    inc = rawInc
    vat = inc - ex
  } else if (vatPerc > 0) {
    inc = rawInc
    ex = inc / (1 + vatPerc / 100)
    vat = inc - ex
    fallback = true
  } else {
    inc = rawInc
    ex = rawInc
    vat = 0
    fallback = true
  }

  if (DEBUG_VAT && debugSamplePrinted < 3) {
    console.info('[bork:vat] line sample', {
      ProductName: (l as { ProductName?: string }).ProductName,
      qty,
      rawEx,
      rawInc,
      vatPerc,
      computed: { ex, inc, vat, fallback },
    })
    debugSamplePrinted += 1
  }

  return { ex, inc, vat, qty, fallback }
}

/** Resets debug sampler counter — call once at the start of a rebuild for fresh samples. */
export function resetBorkVatDebugSampler(): void {
  debugSamplePrinted = 0
}
