# Menu Item – Unified Schema (Drinks & Food)

One schema fits: **wine (opslag)**, **cocktails (recipe + margin)**, **koffie (by-portion from batch)**, and **simple** items (cost + waste + margin → price).

---

## 1. VAT (BTW) rule

- **Alcohol ≤ 0.5% or none** → **VAT low** / **BTW 9%** (`vatRate: 9`).
- **Alcohol > 0.5%** → **VAT high** / **BTW 21%** (`vatRate: 21`).

So we derive VAT from alcohol content: store `alcoholPercent?: number` (0–100). When calculating gross price:

- If `alcoholPercent == null` or `alcoholPercent <= 0.5` → use **9%**.
- If `alcoholPercent > 0.5` → use **21%**.

We can also store **`vatRate: 9 | 21`** (or **`vatCategory: 'low' | 'high'`**) on the item when we set it (from import or UI), so calculations don’t depend on re-evaluating alcohol every time. Formula: **priceIncVat = priceExVat × (1 + vatRate / 100)**.

---

## 2. CSV analysis (wijnkaart sheet)

Your `Kinsbergen_Daily-Ops-Drankkaart_OKT2025(wijnkaart_calculatie_1NOV).csv`:

- **Rows 1–5**: Title and multi-line headers (skip when parsing).
- **Header block**: Inkoop (Eenheid Prijs, Kostprijs per stuk), Verkoop (Netto Marge, Netto Kaartprijs, Bruto Kaartprijs), **Opslag methode** (25, 27, “Calculaties Inslag 25%”, “Calculaties Inslag 30%”), “Inkoop Eenheid 1 Jan - 30 Jun”, etc.
- **Data columns** (by index after normalising headers):
  - `#` (row number)
  - `Type` (Witte Wijn, Rode Wijn, rose, mousserend, …)
  - `Product Kinsbergen` (name)
  - `Regio`
  - `Land`
  - `Jaar`
  - `Eenheid Prijs` (€) → **unit purchase price**
  - `Kostprijs per stuk (waste %)` (€) → **cost per piece after waste**
  - (empty)
  - `Netto Marge` (e.g. 2.7) → **margin multiplier**
  - `Netto Kaartprijs` (€)
  - `Bruto Kaartprijs` (€)
  - Then: 25, 27 (opslag factors?), “Marge Fictief” 4.0 / 3.3, “Netto Calculatie Prijs” for 25% and 30% inslag, and “Inkoop Eenheid/per Stuk 1 Jan - 30 Jun”.

**Pricing logic (wijnfles)**  
- **Opslag methode**: target **cost of sales %** (e.g. 25% → margin multiplier 4) or **margin multiplier** (e.g. 3.3 for ~30% inslag).  
- Formula: `netto calculatie prijs = kostprijs per stuk × marge` (so target CoS 25% ≈ ×4, 30% ≈ ×3.3).  
- You also have a **fixed** “25” / “27” column (possible extra markup).  
- Stored: inkoop, kostprijs per stuk, one or more **target scenarios** (25%, 30%), and **actual** netto/bruto kaartprijs.

---

## 3. Calculation types (how we translate your sheets)

| Sheet / type   | Calculation method | Main inputs | Output |
|----------------|--------------------|------------|--------|
| **Wijnfles**   | `opslag`           | Unit price, cost per piece (after waste), target CoS % or margin multiplier | Net/gross menu price; optional scenario prices (25%, 30%) |
| **Cocktails**  | `recipe_margin`    | Recipe cost (or sum of components), waste %, margin | Cost per item → netto → + VAT = menu price |
| **Koffie**     | `by_portion`       | Batch (e.g. 1 kg), portion sizes (single 8 g, double 12 g), cost per batch | Cost per portion → + margin + VAT |
| **Simple**     | `simple`           | Cost per item, waste %, margin | Netto + VAT (same as your original list) |

---

## 4. Unified schema (one document per product)

All amounts in **euros**, stored as numbers (no currency in value). Percentages as **0–100** (e.g. 25 for 25%).

```ts
// VAT: 9% (low) for alcohol ≤ 0.5% or none; 21% (high) for alcohol > 0.5%
const VAT_LOW = 9
const VAT_HIGH = 21
type VatRate = 9 | 21

// Category / type (drinks vs food, and sub-type)
type MenuItemCategory = 'wine' | 'beer' | 'spirit' | 'cocktail' | 'coffee' | 'soft' | 'food' | 'other'

type CalculationMethod = 'simple' | 'opslag' | 'recipe_margin' | 'by_portion'

interface MenuItem {
  _id: ObjectId
  // ---- Identity ----
  name: string
  description?: string
  type: MenuItemCategory
  subType?: string              // e.g. "Witte Wijn", "Rode Wijn", "rose", "mousserend"
  alcohol?: boolean             // legacy / quick flag
  alcoholPercent?: number       // 0–100; used to derive vatRate: ≤0.5 or null => 9%, >0.5 => 21%
  vatRate?: VatRate             // 9 | 21 (BTW low | high); set from alcoholPercent or override
  // ---- Provenance / display ----
  regio?: string
  land?: string
  jaar?: string                 // vintage / year
  sortOrder?: number
  sourceImportId?: string
  // ---- Calculation method ----
  calculationMethod: CalculationMethod

  // ---- SIMPLE: cost + waste + margin → price ----
  costPricePerItem?: number
  wastePercent?: number
  marginMultiplier?: number     // e.g. 2.7 => netto = cost * 2.7
  priceExVat?: number
  priceIncVat?: number

  // ---- OPSLAG (wine bottle): target CoS % or margin, calculated scenarios ----
  unitPrice?: number            // eenheid prijs (purchase per unit)
  costPerPieceAfterWaste?: number
  wastePercentOpslag?: number   // used to derive costPerPieceAfterWaste from unitPrice if needed
  targetCostOfSalesPercent?: number   // e.g. 25
  targetMarginMultiplier?: number     // e.g. 4 (for 25% CoS) or 3.3 (for 30%)
  opslagScenarios?: Array<{
    label: string               // e.g. "25%", "30%"
    costOfSalesPercent?: number
    marginMultiplier?: number
    calculatedNetPrice?: number
  }>
  priceExVat?: number           // actual netto kaartprijs
  priceIncVat?: number          // actual bruto kaartprijs

  // ---- RECIPE_MARGIN (cocktails): recipe cost + waste + margin ----
  recipeCost?: number           // total cost from recipe
  recipeComponents?: Array<{
    name: string
    quantity?: string           // e.g. "30 ml", "1 dash"
    cost?: number
  }>
  wastePercent?: number
  marginMultiplier?: number
  priceExVat?: number
  priceIncVat?: number

  // ---- BY_PORTION (koffie): batch → portions ----
  batchSizeUnit?: 'g' | 'kg' | 'ml' | 'L'
  batchSize?: number            // e.g. 1000 (grams per bag)
  batchCost?: number
  portions?: Array<{
    name: string                // e.g. "single", "double"
    sizePerUnit: number         // e.g. 8 (g), 12 (g)
    unit?: 'g' | 'ml'
    costPerPortion?: number     // derived: (sizePerUnit / batchSize) * batchCost
    marginMultiplier?: number
    priceExVat?: number
    priceIncVat?: number
  }>
  defaultPriceExVat?: number     // e.g. single
  defaultPriceIncVat?: number

  // ---- Optional ----
  documentRefs?: Array<{ id: string; type: 'recipe' | 'menukaart' | 'note'; name?: string }>
  createdAt: Date
  updatedAt: Date
}
```

- **Single set of price fields**: Each method uses the same `priceExVat` / `priceIncVat` for the “main” menu price; `by_portion` can additionally store per-portion prices in `portions[].priceExVat` / `priceIncVat`.
- **VAT**: Use `vatRate` (9 or 21) when calculating `priceIncVat` from `priceExVat`: `priceIncVat = priceExVat * (1 + vatRate/100)`. If `vatRate` is missing, derive from `alcoholPercent`: ≤ 0.5 or null → 9%, else 21%.
- **Opslag**: `opslagScenarios` stores the “Calculaties Inslag 25% / 30%” columns; we can also store “Marge Fictief” and “Netto Calculatie Prijs” there.
- **Koffie**: One item (e.g. “Espresso”) with `calculationMethod: 'by_portion'`, `batchSize: 1000`, `batchSizeUnit: 'g'`, `portions: [{ name: 'single', sizePerUnit: 8, unit: 'g' }, { name: 'double', sizePerUnit: 12, unit: 'g' }]`. Cost per portion = `(sizePerUnit / batchSize) * batchCost`; then apply margin + VAT per portion.
- **Cocktails**: `calculationMethod: 'recipe_margin'`, `recipeCost` (or sum of `recipeComponents[].cost`), `wastePercent`, `marginMultiplier` → netto → + VAT.

---

## 5. CSV column mapping (wijnkaart)

For import we map your CSV columns to the schema (skip title rows, detect header row):

| CSV (Dutch)              | Schema field                 | Notes |
|--------------------------|-----------------------------|-------|
| #                        | sortOrder                   | Row number |
| Type                     | subType                     | Witte Wijn, Rode Wijn, … |
| Product Kinsbergen       | name                        | |
| Regio                    | regio                       | |
| Land                     | land                        | |
| Jaar                     | jaar                        | |
| Eenheid Prijs            | unitPrice                   | Strip €, parse number |
| Kostprijs per stuk       | costPerPieceAfterWaste      | |
| Netto Marge              | targetMarginMultiplier      | Or store in opslagScenarios |
| Netto Kaartprijs         | priceExVat                  | |
| Bruto Kaartprijs         | priceIncVat                 | |
| (25 / 27 columns)        | opslagScenarios[].label / calculatedNetPrice | Optional |
| Marge Fictief 4.0 / 3.3  | opslagScenarios[].marginMultiplier | |
| Netto Calculatie Prijs    | opslagScenarios[].calculatedNetPrice | For 25% and 30% |

Set `calculationMethod: 'opslag'`, `type: 'wine'`, `alcohol: true`, and `vatRate: 21` (wine > 0.5% alcohol).

---

## 6. Koffie (by_portion) – example

- **Batch**: 1 kg bag = 1000 g, cost e.g. € 12.  
- **Portions**: single = 8 g, double = 12 g.  
- Cost single = (8 / 1000) * 12 = € 0.096; double = (12 / 1000) * 12 = € 0.144.  
- Then apply margin (e.g. 3) and VAT → menu price per portion.

Stored as one item with `calculationMethod: 'by_portion'`, `batchSize: 1000`, `batchSizeUnit: 'g'`, `batchCost: 12`, `vatRate: 9` (koffie = low/no alcohol), `portions: […]`. We can compute and cache `costPerPortion` and `priceExVat` / `priceIncVat` per portion.

---

## 7. Cocktails (recipe_margin) – example

- Recipe: ingredients with quantities and costs → **recipeCost** (or sum of `recipeComponents[].cost`).
- **wastePercent** (e.g. 5) → cost after waste.
- **marginMultiplier** (e.g. 3) → netto = costAfterWaste * 3.
- **VAT** → priceIncVat.

So we only need to store `recipeCost` (or components), `wastePercent`, `marginMultiplier`, `vatRate: 21` (cocktails are high alcohol), and the resulting `priceExVat` / `priceIncVat`. Recipe details can live in `recipeComponents[]` and/or in linked documents (`documentRefs`).

---

## 8. Summary

- **One collection**, e.g. `menu_items`, with **one document per product**.
- **VAT**: alcohol ≤ 0.5% or none → **BTW 9%** (`vatRate: 9`); alcohol > 0.5% → **BTW 21%** (`vatRate: 21`). Store `alcoholPercent` and/or `vatRate`; derive the other if needed.
- **calculationMethod** selects which fields and which formula we use (simple, opslag, recipe_margin, by_portion).
- **Wijnkaart CSV**: map columns into `opslag` items; set `vatRate: 21` for wine.
- **Koffie**: one item per product with `by_portion`, `vatRate: 9`, and `portions` (single/double grams).
- **Cocktails**: `recipe_margin` with `vatRate: 21`, recipe cost + waste + margin → prices.
- **Simple** items use the original list fields; set `vatRate` from alcohol (or default 9 for soft/food, 21 for alcohol).

Next step: implement this as TypeScript types and a MongoDB schema (or Nuxt server types), then add the wijnkaart CSV importer using the column mapping above.
