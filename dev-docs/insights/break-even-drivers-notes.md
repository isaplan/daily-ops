# Break-even drivers — Insights draft notes (VK)

**Status:** WIP dump for Insights (2026-08-11). Not wired to UI charts yet.  
**Refs:** ADR-019, ADR-022, PERIOD_CACHE_ADR L4 · source = sealed `accounting_pnl_benchmark`

## What the €179k number is

- **Not** average revenue.
- Rolling 12m VK: `BE = (fixedLabor + fixedOH) / (1 − cogs% − flex%)`.
- Today day target ≈ monthly BE ÷ days-in-month (~€5.8k).
- Each **sealed month** has its own BE; do not apply rolling BE to judge a past month.

## Mental model (correct)

1. Cover **fixed** (FT labor + overhead).
2. Each €1 sales: only **COGS% + flex%** come out.
3. Rest of CM pays fixed; after fixed covered → profit.

`Profit ≈ Revenue × CM − Fixed` where `CM = 1 − cogs% − flex%`.

Naive `BE ≈ revenue − result` (= total costs) understates true BE when variable costs exist.  
Identity: `BE = revenue + |loss| / CM` (matches formula on sealed months).

## VK evidence (sealed)

| Period | Avg rev | Avg month BE | Notes |
|--------|--------:|-------------:|-------|
| H1 2025 | ~€164k | ~€174k | Flex≈0 in model (no lonen split) |
| Apr 2025 | €184k | **€146k** | Result **+€16k** — BE that month, not 179k |
| H1 2026 | ~€149k | ~€177k | Flex ~€23k/mo; OH higher |
| Jun 2026 | €161k | ~€195k | Result −€16k |
| Rolling UI | — | **~€180k** | Forward estimate for open Today |

**Why BE can exceed avg revenue:** 2026 YTD result negative → by definition need more sales than you’ve been averaging to hit zero.

## Drivers (why BE stayed high / rose)

1. **Flex / inhuur in 2026** — CM shrinks (~65% → ~50%). Biggest structural change vs 2025 model.
2. **Fixed overhead up** — Apr ’25 ~€32k → 2026 months ~€41–48k (overige + afschrijving).
3. **Softer 2026 revenue** — avg ~€149k vs ~€164k H1’25 → more months below BE.
4. **FT labor € down** (inhuur split out) — helps numerator, but flex% + OH offset it.

## Data gaps to improve 2025 calculations

Needed from Finance (per venue × month for 2025):

1. **Lonen grandchildren** — `salarisBediening/Keuken/Overhead` vs `inhuurFb/Afwas/Keuken/…`  
   Without these, 2025 treats **all labor as fixed** (flex%=0) → distorts rolling CM/BE.
2. **Sociale lasten / pensioen / labor overig** split on 2025 months (often 0 now).
3. **Clean Dec 2025** — result ~€275k and fixed OH ~€179k look like year-end bookings; split trading vs extraordinary or BE will stay noisy.
4. Optional: confirm **afschrijving / financieel** monthly allocation (2025 often 0).

## UI ideas (later)

- Insights card: month BE vs revenue timeline (VK/BEA/LAT).
- Toggle: rolling-12m vs actual-month BE.
- Driver waterfall: Δ fixed labor, Δ flex%, Δ OH, Δ CM.
- Flag months where `flex%=0` (legacy incomplete lonen).
