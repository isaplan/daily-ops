# Menu Builder V2 – Logic, calculations, DB, versioning

Single reference for what does what and why. No code examples.

## Logic

- **Builder mode:** Sections and subsections (CRUD). Add products to a subsection via search/filter and bulk add. Per-subsection product table: Show on Printed Menu yes/no, reorder (up/down), optional edit (names/descriptions). Data is read from menu and menu_items; writes go to menu (PATCH) or bulk (POST).
- **Calculation mode:** Per-subsection view. Shows cost, margin, menu price from product data and overrides. Section (or global) defaults apply when no row override. Save menu = persist current state. Save version = create a snapshot for retrace.
- **Section defaults:** Waste %, margin multiplier, VAT at section level. Applied when a subsection row has no override.
- **Show on Printed Menu:** Stored in `productOverrides[productId].showOnPrintedMenu`. Only items with `showOnPrintedMenu !== false` are included in the “Printed menu only” export. Full menu (all items) is used for calculations and checkout.

## Calculations

- **Where:** `useMenuRowCalculation` (composable). Formula: cost per item → + waste → cost+waste; then nett = cost+waste × margin multiplier (or derived from fixed menu price); menu price = nett × (1+BTW).
- **Cost per item:** From product data (batch price / batch qty or item price) or from row override (`costPerItem`, or `batchCost`/`itemsPerBatch`). See `getCostPerItemFromProduct`.
- **Margin:** Multiplier (e.g. 4×). Margin Final in V1 is the ratio (nett / cost+waste) when using Menu Price Final.
- **Application order:** Section defaults (or global) then row overrides.

## DB storage

- **menus:** Menu document. `menuSectionsV2` = sections with nested subsections; each section can have `defaultWastePercent`, `defaultMarginMultiplier`, `defaultVatRate`; each subsection has `productIds`, `productOverrides` (displayName, showOnPrintedMenu, cost, margin, etc.). `copiedFromMenuId` = source menu when created via Copy.
- **menu_items:** Products (from import). Menus store only references and overrides.
- **menu_versions:** Snapshots. Each document: `menuId`, `savedAt`, `snapshot` (menuSectionsV2 or menuSections). Used for retrace only.

## Versioning

- **Version** = snapshot of menu state at save time (sections + overrides). Stored in `menu_versions`.
- **Autosave:** Not implemented; user clicks Save to PATCH.
- **Save version:** POST to `/api/menu/menus/[id]/versions` creates a snapshot. GET list at `/api/menu/menus/[id]/versions`. Load snapshot (read-only) can be added for retrace.
