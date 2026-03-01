# Menu import – example documents in DB

After the header-based dump import, each CSV row is stored as one document in the `menu_items` collection. Keys in `data` come from the detected header row (or `col0`, `col1`, … when no header is found).

---

## 1. Coca Cola (fris & siropen)

**Source:** `fris & siropen calculaties -Tabel 1.csv`  
**Product group:** `soft`

```json
{
  "_id": "<ObjectId>",
  "productGroup": "soft",
  "sourceFile": "fris & siropen calculaties -Tabel 1.csv",
  "rowIndex": 11,
  "data": {
    "#": "",
    "Type": "Fles",
    "Product Kinsbergen": "Cola",
    "%": "",
    "Omschrijving": "",
    "Eenheid Prijs": "€ 0,60",
    "Per Stuk prijs": "€ 0,63",
    "Kostprijs per stuk (waste %)": "5,0",
    "Netto Marge": "€ 3,14",
    "Netto Kaartprijs": "€ 3,80",
    "Bruto Kaartprijs": "",
    "Verkoop prijs oude kaart": "€ 3,40",
    "1 Jan - 30 Jun": " 1.976 "
  },
  "createdAt": "<ISODate>",
  "updatedAt": "<ISODate>"
}
```

*(Exact keys depend on the header row that was detected; multi-line headers are normalized to a single line, e.g. `"Netto Marge"` / `"Netto Kaartprijs"` / `"Bruto Kaartprijs"`.)*

---

## 2. Texels Skuumkoppe (bier)

**Source:** `bier calculaties -Tabel 1.csv`  
**Product group:** `beer`

```json
{
  "_id": "<ObjectId>",
  "productGroup": "beer",
  "sourceFile": "bier calculaties -Tabel 1.csv",
  "rowIndex": 58,
  "data": {
    "Status": "",
    "#": "",
    "Type": "Fles",
    "Product Kinsbergen": "Texels Skuumkoppe 0%",
    "%": "",
    "Type_2": "Dunkel Weizen",
    "Leverancier": "",
    "Inkoop Prijs": "€ 33,99",
    "aantal per Items ": "24",
    "Inhoud per Stuk": "",
    "Per Stuk prijs": "€ 1,55",
    "Kostprijs per stuk (waste %)": "€ 1,63",
    "Netto Kaartprijs": "€ 5,41",
    "Calculatie Kaartprijs": "€ 5,90",
    "Netto Marge": "3,27",
    "Netto Kaartprijs_2": "€ 5,32",
    "Bruto Kaartprijs Klein": "€ 5,80"
  },
  "createdAt": "<ISODate>",
  "updatedAt": "<ISODate>"
}
```

*(If the same header name appears twice, the parser appends `_2`, `_3`, etc.)*

---

## 3. Pornstar Martini (cocktail)

**Source:** `cocktail calculaties-Tabel 1.csv`  
**Product group:** `cocktail`

```json
{
  "_id": "<ObjectId>",
  "productGroup": "cocktail",
  "sourceFile": "cocktail calculaties-Tabel 1.csv",
  "rowIndex": 22,
  "data": {
    "#": "1",
    "Type": "Vodka",
    "Product Kinsbergen": "Pornstar Martini",
    "Eenheid Prijs": "",
    "Per Stuk prijs": "€ 2,55",
    "Kostprijs per stuk (waste %)": "€ 2,68",
    "Netto Marge": "3,5",
    "Netto Kaartprijs": "€ 9,50",
    "Bruto Kaartprijs": "€ 11,50",
    "Verkoop prijs oude kaart": "€ 12,50",
    "1 Jan - 30 Jun": " 895 ",
    "Totaal Ex BTW": "Pornstar Martini",
    "Sterk": "€ 2,55",
    "Sterk_2": "Vodka",
    "Sterk_3": "€ 0,33",
    "Passion Liq": "€ 0,62",
    "Limoensap ": "€ 0,11",
    "Citroensap": "€ 0,21",
    "Eggwhite": "€ 0,12",
    "Garnering 1": "€ 0,14",
    "Rietje": "€ 0,05",
    "Loon": "€ 0,67",
    "Marge Fictief": "4,0",
    "Netto Calculatie Prijs": "€ 10,22",
    "Bruto Calculatie Prijs": "€ 11,14"
  },
  "createdAt": "<ISODate>",
  "updatedAt": "<ISODate>"
}
```

---

## 4. Espresso (koffie & thee)

**Source:** `koffie & thee calculaties-Tabel 1.csv`  
**Product group:** `coffee_tea`

```json
{
  "_id": "<ObjectId>",
  "productGroup": "coffee_tea",
  "sourceFile": "koffie & thee calculaties-Tabel 1.csv",
  "rowIndex": 13,
  "data": {
    "#": "",
    "Type": "",
    "Product Kinsbergen": "Espresso",
    "%": "",
    "Type_2": "",
    "Eenheid Prijs": "€ 0,72",
    "Per Stuk prijs": "€ 0,75",
    "Kostprijs per stuk (waste %)": "3,8",
    "Netto Marge": "€ 2,89",
    "Netto Kaartprijs": "€ 3,50",
    "Bruto Kaartprijs": "",
    "Verkoop prijs oude kaart": "€ 3,30",
    "Espresso": "€ 0,72",
    "Enkel Shot ": "€ 0,29",
    "Loon": "€ 0,33"
  },
  "createdAt": "<ISODate>",
  "updatedAt": "<ISODate>"
}
```

---

## Summary

| Item              | productGroup | sourceFile                          | rowIndex | Main keys in `data`                          |
|-------------------|-------------|--------------------------------------|----------|----------------------------------------------|
| Coca Cola         | `soft`      | fris & siropen calculaties -Tabel 1.csv | 11       | Type, Product Kinsbergen, Netto/Bruto Kaartprijs |
| Texels Skuumkoppe | `beer`      | bier calculaties -Tabel 1.csv        | 58       | Type, Product Kinsbergen, Inkoop, Per Stuk, Bruto |
| Pornstar Martini  | `cocktail`  | cocktail calculaties-Tabel 1.csv    | 22       | #, Type, Product Kinsbergen, recipe columns, Marge |
| Espresso          | `coffee_tea`| koffie & thee calculaties-Tabel 1.csv| 13       | Product Kinsbergen, Eenheid/Per Stuk prijs, Netto/Bruto |

- **Upsert key:** `productGroup` + `sourceFile` + `rowIndex` (re-import updates the same row).
- **Preview in list:** Uses `data['Product Kinsbergen']`, `data['Product']`, or `data['Type']` when present.
