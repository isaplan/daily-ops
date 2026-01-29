# 📊 Inbox Data Mappings Documentation

**Last Updated:** 2026-01-29  
**Status:** ✅ Active

---

## 🎯 Overview

This document describes the field mappings from parsed email attachments to MongoDB collections.

---

## 📋 Eitje Hours Mapping

**Source:** CSV file from Eitje  
**Destination:** `test-eitje-hours` collection  
**Unique Key:** `date + employee_name + location_name + shift_type`

### Field Mappings

| Source Column (Dutch) | Target Field | Type | Required | Transform |
|----------------------|--------------|------|----------|-----------|
| `datum` | `date` | Date | ✅ Yes | Parse DD/MM/YYYY |
| `naam` | `employee_name` | String | ✅ Yes | - |
| `naam van vestiging` | `location_name` | String | ✅ Yes | - |
| `team naam` | `team_name` | String | No | - |
| `type` | `shift_type` | String | No | - |
| `uren` | `hours` | Number | No | Parse HH:MM to decimal |
| `gerealizeerde loonkosten` | `realized_labor_costs` | Number | No | Parse € format |
| `Loonkosten per uur` | `cost_per_hour` | Number | No | Parse € format |
| `contracttype` | `contract_type` | String | No | - |
| `uurloon` | `hourly_rate` | Number | No | Parse € format |
| `support ID` | `support_id` | String | No | - |

### Example Row

```csv
datum,naam,naam van vestiging,team naam,type,uren,gerealizeerde loonkosten,Loonkosten per uur,contracttype,uurloon,support ID
01/01/2026,Frederique Van Gulik,Bar Bea,Bediening,gewerkte uren,05:00,"€115,35","€23,07",uren contract,"€16,95",24583151
```

**Mapped to:**
```json
{
  "date": "2026-01-01T00:00:00.000Z",
  "employee_name": "Frederique Van Gulik",
  "location_name": "Bar Bea",
  "team_name": "Bediening",
  "shift_type": "gewerkte uren",
  "hours": 5.0,
  "realized_labor_costs": 115.35,
  "cost_per_hour": 23.07,
  "contract_type": "uren contract",
  "hourly_rate": 16.95,
  "support_id": "24583151",
  "source": "inbox",
  "importedAt": "2026-01-26T..."
}
```

---

## 📋 Eitje Contracts Mapping

**Source:** CSV file from Eitje  
**Destination:** `test-eitje-contracts` collection  
**Unique Key:** `employee_name + support_id`

### Field Mappings

| Source Column (Dutch) | Target Field | Type | Required | Transform |
|----------------------|--------------|------|----------|-----------|
| `naam` | `employee_name` | String | ✅ Yes | - |
| `contracttype` | `contract_type` | String | ✅ Yes | - |
| `uurloon` | `hourly_rate` | Number | No | Parse € format |
| `wekelijkse contracturen` | `weekly_contract_hours` | Number | No | Parse HH:MM to decimal |
| `contractvestiging` | `contract_location` | String | No | - |
| `Loonkosten per uur` | `cost_per_hour` | Number | No | Parse € format |
| `eind plus/min saldo` | `end_balance` | Number | No | Parse HH:MM to decimal |
| `eind verlofsaldo` | `end_leave_balance` | Number | No | Parse HH:MM to decimal |
| `* totaal gewerkte dagen` | `total_worked_days` | Number | No | - |
| `* totaal gewerkte uren` | `total_worked_hours` | Number | No | Parse HH:MM to decimal |
| `* ziekteuren` | `sick_hours` | Number | No | Parse HH:MM to decimal |
| `* bijzonder verlofuren` | `special_leave_hours` | Number | No | Parse HH:MM to decimal |
| `maandelijkse contracturen` | `monthly_contract_hours` | Number | No | Parse HH:MM to decimal |
| `contracturen in periode` | `contract_hours_in_period` | Number | No | Parse HH:MM to decimal |
| `vloer ID` | `floor_id` | String | No | - |
| `Nmbrs ID` | `nmbrs_id` | String | No | - |
| `e-mailadres` | `email` | String | No | - |
| `verjaardag` | `birthday` | Date | No | Parse DD/MM format |
| `achternaam` | `last_name` | String | No | - |
| `voornaam` | `first_name` | String | No | - |
| `support ID` | `support_id` | String | No | - |

---

## 📋 Test collection naming (test-source-type)

All Bork test collections follow the pattern **test-source-type**:

| Collection | Source file(s) | Document type |
|------------|----------------|---------------|
| `test-bork-sales` | sales.csv | sales |
| `test-bork-food-beverage` | foodbev.csv | food_beverage (skip 8 metadata lines; header row: Dranken laag, Dranken hoog, Keuken, Meldingen, Grand Total) |
| `test-bork-product-mix` | product mix (CSV) | product_mix |
| `test-bork-basis-rapport` | basisrapport.xlsx | product_sales_per_hour |
| `test-basis-report` | Basis Rapport*.xlsx (BORK registry) | basis_report |

**Basis Rapport Excel structure:** First 9 rows are metadata (title, date range, location, “Netto Sales”, “Grand Total”). Row 10 (0-based index 9) is the header row (e.g. Groep1, Groep3, Hoeveelheid, Totale prijs, Ex BTW). Parser uses `skipRows: 9` and `emptyHeadersAsColumnN: true` when filename indicates basis rapport; empty header cells become `column_0`, `column_1`, etc. Raw rows are stored in `test-basis-report`. Classifier: filename contains “basis rapport” or “basisrapport” or “basis report” → `basis_report`.

**Product Mix CSV structure:** Semicolon-delimited; first 10 lines are metadata (title, location, date range, “Grand Total” label). Line 11 is the header row (e.g. empty, …, Hoeveelheid, Totale prijs, Ex BTW, BTW). Parser uses `skipLines: 10` when filename indicates product_mix, and maps empty header cells to `column_0`, `column_1`, etc. so all columns are preserved. Raw rows are stored as-is in `test-bork-product-mix`.

---

## 📋 Bork Sales Mapping

**Source:** CSV file from Bork (Registry / Sales export)  
**Raw storage:** `test-bork-sales` (raw rows as-is for Bork Sales view)  
**Mapped collection (flat format):** `bork_sales` — used when CSV has Date/Product/Revenue columns

### Actual Sales.csv structure (first file)

- **Delimiter:** Semicolon (`;`) — auto-detected by parser.
- **Structure:** First line is not a flat header; it contains title and location. Rows 1–10 are metadata (Sales, Gastropub van Kinsbergen, date range `28/01/2026 - 28/01/2026`, address, year, etc.). Data rows from row 11: **hierarchical category + amount** (e.g. category level 1, 2, 3, then `€ 518,89`-style amounts).
- **Example data rows:** `Dranken laag`, `Warme Dranken`, `Thee`, `€ 116,73`, `€ 116,73`; `Grand Total;;;;€ 2.211,87;€ 2.211,87;;;;`.
- **Parsing:** Correct. Parser uses first line as header keys (empty, `Sales`, location name, etc.); all rows are stored as raw documents in `test-bork-sales` so the Bork Sales view shows data.

### Flat-format field mappings (for future CSV with Date/Product/Revenue)

| Source Column | Target Field | Type | Required | Transform |
|--------------|--------------|------|----------|-----------|
| `Date` / `Datum` | `date` | Date | ✅ Yes | Parse date |
| `Product` / `Productnaam` | `product_name` | String | No | - |
| `Quantity` / `Aantal` | `quantity` | Number | No | - |
| `Revenue` / `Omzet` | `revenue` | Number | No | Parse € format |
| `Salesperson` / `Verkoper` | `salesperson_name` | String | No | - |
| `Category` / `Categorie` | `category` | String | No | - |

**Note:** Current Bork Sales.csv is hierarchical (category tree + amounts). Raw rows are stored in `test-bork-sales`; the flat mapping above applies only when the file has those columns.

---

## 📋 Eitje Finance Mapping

**Source:** PDF file from Eitje  
**Destination:** `test-eitje-finance` collection  
**Status:** 🟡 To be confirmed with first file

### Expected Field Mappings

| Source Column | Target Field | Type | Required | Transform |
|--------------|--------------|------|----------|-----------|
| `Date` | `date` | Date | ✅ Yes | Parse date |
| `Amount` | `amount` | Number | No | Parse € format |
| `Description` | `description` | String | No | - |
| `Category` | `category` | String | No | - |

**Note:** PDF structure will be analyzed when first file is received.

---

## 🔧 Value Transformations

### Date Parsing
- **Format:** DD/MM/YYYY (Eitje format)
- **Example:** `01/01/2026` → `2026-01-01T00:00:00.000Z`

### Time Parsing
- **Format:** HH:MM
- **Example:** `05:00` → `5.0` (decimal hours)
- **Example:** `04:45` → `4.75` (decimal hours)

### Euro Currency Parsing
- **Format:** `€123,45` or `€123.45`
- **Example:** `€115,35` → `115.35`
- **Handles:** `n.v.t.` → `0`

---

## 📝 Notes

1. **Dutch Column Names:** Eitje files use Dutch column names. Mappings support both Dutch and English.
2. **Flexible Matching:** Column matching uses case-insensitive partial matching.
3. **Missing Values:** Optional fields default to `null` if not present.
4. **Upsert Logic:** Uses unique filters to prevent duplicates (updates existing records).

---

## 🚧 Coming Soon

- **Formitabele:** Format unknown - will be added when structure is known
- **Pasy:** Format unknown - will be added when structure is known

---

**Last Updated:** 2026-01-29
