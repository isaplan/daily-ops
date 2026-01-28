# 📊 Inbox Data Mappings Documentation

**Last Updated:** 2026-01-26  
**Status:** ✅ Active

---

## 🎯 Overview

This document describes the field mappings from parsed email attachments to MongoDB collections.

---

## 📋 Eitje Hours Mapping

**Source:** CSV file from Eitje  
**Destination:** `eitje_hours` collection  
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
**Destination:** `eitje_contracts` collection  
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

## 📋 Bork Sales Mapping

**Source:** CSV/Excel file from Bork  
**Destination:** `bork_sales` collection  
**Unique Key:** `date + product_name`  
**Status:** 🟡 To be confirmed with first file

### Expected Field Mappings

| Source Column | Target Field | Type | Required | Transform |
|--------------|--------------|------|----------|-----------|
| `Date` / `Datum` | `date` | Date | ✅ Yes | Parse date |
| `Product` / `Productnaam` | `product_name` | String | No | - |
| `Quantity` / `Aantal` | `quantity` | Number | No | - |
| `Revenue` / `Omzet` | `revenue` | Number | No | Parse € format |
| `Salesperson` / `Verkoper` | `salesperson_name` | String | No | - |
| `Category` / `Categorie` | `category` | String | No | - |

**Note:** Actual column names will be confirmed when first Bork Sales file is received.

---

## 📋 Eitje Finance Mapping

**Source:** PDF file from Eitje  
**Destination:** `eitje_finance` collection  
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

**Last Updated:** 2026-01-26
