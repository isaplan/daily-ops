# Menu Builder (Drinks → Food) – Plan

## Goal

- **Drinks (then food) catalog** with: type, name, description, alcohol, cost price per batch, cost price per item, waste %, margin, price ex VAT, price inc VAT.
- **Import** from Excel, CSV, and optionally PDF so you can upload your current sheet quickly.
- **Storage** of menu items in the app (Nuxt + same MongoDB).
- **Historical menukaart**: ODF (e.g. `.odt`/menukaart docs) for price development over time.
- **Document-per-item** pattern for versions, recipes, and combined products (reuse/align with existing document import).

---

## Existing pieces we can reuse

| Piece | Location | Use |
|-------|----------|-----|
| CSV parser | `app/lib/utils/csv-parser.ts` | Parse CSV export of your Excel |
| Excel parser | `app/lib/utils/excel-parser.ts` | Parse .xlsx/.xls directly |
| PDF parser | `app/lib/utils/pdf-parser.ts` | Text/tables from PDF menukaart |
| Document parser service | `app/lib/services/documentParserService.ts` | Routes by format, returns headers + rows |
| Document classifier | `app/lib/utils/document-classifier.ts` | Can add `menu_catalog` / `menukaart` type |
| ParsedData pattern | `app/models/ParsedData.ts` | One record per **import file** (headers + rows); can map rows → menu items |
| Nuxt + MongoDB | `nuxt-app/server/utils/db.ts` | Same DB; new collection(s) for menu data |

**ODF**: Not implemented yet. ODS (spreadsheet) can be added via a library (e.g. SheetJS supports ODS) or a small ODS/ODT parser for menukaart text/tables. We add this when we do “historical menukaart”.

---

## How “document per item” fits

- **Import flow**: One **file** (Excel/CSV/PDF) → one **import job** (like ParsedData: headers + rows). Each **row** is turned into (or matched with) one **menu item** in a `menu_items` (or `drink_items`) collection.
- **Versions**: Each import creates/updates items. We can keep an **import history** (e.g. `menu_imports` with `importId`, `fileId`, `importedAt`) and optionally snapshot item state per import so we have versions over time.
- **Recipe / combined product**: A **menu item** can have:
  - `documentRefs`: links to “documents” (e.g. a PDF recipe, or a note) — same idea as “separate document per item”.
  - `type`: e.g. `drink` | `food` | `combined` so combined products are first-class.
- So: **one row per item** in the catalog, with optional **document refs** per item for recipe/version/combined-product detail.

---

## Proposed phasing

### Phase 1 – Drinks catalog + Excel/CSV import (start here)

1. **Data model (Nuxt)**  
   - New collection, e.g. `menu_items` (or `drink_items` for drinks-only first).  
   - Fields: `type`, `name`, `description`, `alcohol`, `costPriceBatch`, `costPriceItem`, `wastePercent`, `margin`, `priceExVat`, `priceIncVat`, `category` (e.g. drink/food), `sourceImportId?`, `createdAt`, `updatedAt`.  
   - Optional: `documentRefs[]` (for later recipe/version links).

2. **Import API (Nuxt)**  
   - `POST /api/menu/import` (or under `daily-menu-products`):  
     - Accept file upload (Excel or CSV) or raw CSV string.  
     - Parse with existing CSV/Excel utils (reuse logic from `documentParserService` or call it if we expose it, or implement a thin parser in Nuxt that maps your columns).  
     - Map each row to the schema above (with column mapping or fixed names).  
     - Upsert into `menu_items` (e.g. match by `name` + `type` or a stable key).  
     - Return: `{ success, imported, updated, errors[] }`.

3. **Column mapping**  
   - Your columns: type, name, description, alcohol, cost price per batch, cost price per item, waste %, margin, price ex VAT, price inc VAT.  
   - Parser: accept headers (from CSV/Excel) and map to our field names (with optional user override in UI later).  
   - For MVP: support a **fixed header set** (Dutch/English) so your current Excel/CSV works without configuration.

4. **UI (Daily Menu & Products)**  
   - Page under `/daily-menu-products`:  
     - “Import” button → file picker (Excel/CSV).  
     - Upload → call import API → show result (imported/updated count, errors per row if any).  
     - List of drinks (table/cards) from `menu_items` with filters (e.g. by type, alcohol).

5. **Optional: PDF import**  
   - If your source is sometimes PDF: re-use PDF parser to extract text/tables, then either:  
     - One-off “table → rows” extraction for a known PDF layout, or  
     - Store PDF as “document” and link to items manually in a later phase.

### Phase 2 – Document-per-item (versions, recipes, combined)

1. **Document refs on items**  
   - Add `documentRefs: [{ id, type: 'recipe' | 'menukaart' | 'note', name? }]` to `menu_items`.  
   - “Attach” an uploaded file (or note) to an item → store ref.

2. **Version history**  
   - Option A: Keep last N snapshots of each item per import (e.g. in `menu_item_snapshots`).  
   - Option B: Treat each import as a “version” and keep diff/history by `sourceImportId` + timestamp.  
   - This gives “price development” per item over time from imports.

3. **Recipes / combined products**  
   - Items with `type: 'combined'` or a flag; `documentRefs` can point to recipe PDF or internal “recipe” document.  
   - Combined product: one item that references multiple sub-items (we can add `componentIds: string[]` later).

### Phase 3 – Historical menukaart (ODF)

1. **ODS/ODT support**  
   - Add ODS parsing (e.g. via `xlsx` or an ODS library) for spreadsheet menukaart.  
   - For ODT (text): extract text/tables similarly to PDF if needed.

2. **Menukaart as document type**  
   - Classifier: e.g. filename contains “menukaart” / “menu” → `menukaart`.  
   - Parse → extract item names + prices (and dates if present) → store as **historical snapshot** (e.g. `menukaart_snapshots`: date, source file, items with prices).  
   - UI: “Price development” view: by item name, show timeline of prices from imports + menukaart snapshots.

---

## Next step

Start with **Phase 1**:

1. Add `menu_items` collection + types in Nuxt.  
2. Add `POST /api/menu/import` (Excel + CSV) with a fixed column map for your 10 columns.  
3. Add Drinks list + Import UI on `/daily-menu-products`.  

Then we can iterate on column mapping, PDF, and after that Phase 2 (document refs, versions) and Phase 3 (ODF menukaart). If you share a sample Excel/CSV header row (or a screenshot), we can lock the exact column names for the first import.
