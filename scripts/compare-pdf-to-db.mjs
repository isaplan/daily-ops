#!/usr/bin/env node
/**
 * Compare drinks from Kinsbergen PDF to menu items in DB.
 * Run: node scripts/compare-pdf-to-db.mjs
 * Requires: dev server running (pnpm dev) so API is available, or set API_BASE.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8080'

// Drink/product names extracted from kinsbergen-drank-kaart-maart-2025.pdf (main list, before "BITES")
const PDF_DRINKS = [
  'ZEEHELDEN Hoppy Blond',
  'GLOEIKRIEK',
  'BIRRA MORETTI',
  'GUINNESS',
  'MAGNERS APPLE CIDER',
  'IJWIT | BROUWERIJ \'T IJ White Ale',
  'TREMENS | DELIRIUM Strong Ale',
  'MANEBLUSSER Blond',
  'LAGUNITAS IPA',
  'BOLLEKE | DE KONINCK Amber blond',
  'PAÍS TROPICAL | OEDIPUS IPA',
  'BOCK WISSELTAP | TEXELS/OEDIPUS Bock',
  'TRIPEL | AFFLIGEM Tripel',
  'ELVIS JUICE | BREWDOG Grapefruit IPA',
  'SKUUMKOPPE | TEXELS Dunkelweizen',
  'PAULANER Weizen',
  'KINSBERGEN DRAFT TASTING',
  'KRIEK | BOON Kriek',
  'GLUTEN FREE IPA | BREWDOG IPA',
  'CORONA EXTRA',
  'CLASSIC | GOUDEN CAROLUS Dubbel',
  'PARANOIA | DELIRIUM Hazy IPA',
  'BULLEBAK | EEUWIGE JEUGD Weizen Tripel',
  'KUTBIER | BOEGBEELD Blond',
  'ORVAL',
  'BON CHEF | 2 CHEFS BREWING NEIPA',
  'JE MOEDER | VET&LAZY Tripel',
  'DIKKE LUL DRIE BIER | UILTJE Hoppy Pale Ale',
  'BELHAMEL | EEUWIGE JEUGD NEIPA',
  'DOUBLE JUICE PUNCH | FRONTAAL NEDIPA',
  'REDHEAD ALE | STADSHAVEN Red Ale',
  'SAILORS LAGER | STADSHAVEN Lager',
  'WIT | LOWLANDER White Ale',
  'GLADJANUS | EEUWIGE JEUGD White IPA',
  'MAGNERS APPLE DRAFT',
  'MAGNERS PEAR',
  'MAGNERS BERRY',
  'PAULANER 0,0% Weizen',
  'BRUGSE SPORTZOT Blond',
  'RADLER | AMSTEL Citrus Radler',
  'BIRRA MORETTI 0,0% Lager',
  'CORONA CERO',
  'PLAYGROUND | VAN DE STREEK IPA',
  'VRIJWIT | BROUWERIJ \'T IJ White Ale',
  'SKUUMKOPPE 0% | TEXELS Dunkel Weizen',
  'JUICE PUNCH 0.5 | FRONTAAL NEIPA',
  'VRIJER | EEUWIGE JEUGD Blond',
  'BIG BOB | OERSOEP IPA',
  'ALCOHOL-FREE SPARKLING ROSE',
  'Lowlander',
  'Guinness',
  'Sauvignon Blanc',
  'Pinot Grigio',
  'Verdejo',
  'Chardonnay',
  'Tempranillo',
  'Montepulciano',
  'Primitivo',
  'Merlot Rosso Veneto',
  'Syrah Cinsault Grenache',
  'Cava Brut',
  'Oupa Se Wyn',
  'Moscatel',
  'Port Ruby',
  'Port Tawny',
  'Port White',
  'Chateau Montifaud',
  'Calvados Toutain',
  'Sari Invecchiata',
  'Domaine Du Tariquet',
  'Fever-Tree',
  'Kinsbergen English Rose Gin',
  'Monkey47',
  'Brockmans',
  'Roku Gin',
  'Hendricks',
  'Nolets Silver',
  'Bobby\'s Gin',
  'Copperhead',
  'Fryske Hynder',
  'Nikka',
  'Highland Park',
  'Glenfiddich',
  'Talisker',
  'Woodford Reserve',
  'John Walker',
  'Diplomatico',
  'Abuelo',
  'Angostura',
  'The Kraken',
  'Don Papa',
  'Clement',
  'Flor de Cana',
  'Plantation',
  'Patron',
  'Don Julio',
  'Grey Goose',
  'Belvedere',
  'Ketel One',
  'Haagse Nieuwe',
  'Capriole',
  'Bradley',
  'Chaudfontaine',
  'Zuidam',
]

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s) {
  return normalize(s)
    .split(/\s+/)
    .filter(Boolean)
}

/** Check if PDF name matches a DB product (name or data.Product / Product Kinsbergen / Name) */
function dbProductMatchesName(item, pdfName) {
  const names = [
    item.name,
    item.data?.['Product Kinsbergen'],
    item.data?.['Product'],
    item.data?.Name,
    item.data?.name,
  ].filter(Boolean).map(String)

  const pdfNorm = normalize(pdfName)
  const pdfTokens = tokenize(pdfName)
  if (pdfTokens.length === 0) return false

  for (const n of names) {
    const nNorm = normalize(n)
    if (nNorm === pdfNorm) return true
    if (nNorm.includes(pdfNorm) || pdfNorm.includes(nNorm)) return true
    const nTokens = tokenize(n)
    const matchCount = pdfTokens.filter((t) => nTokens.some((nt) => nt.includes(t) || t.includes(nt))).length
    if (matchCount >= Math.min(2, pdfTokens.length)) return true
  }
  return false
}

async function main() {
  let items = []
  try {
    const res = await fetch(`${API_BASE}/api/menu/items?limit=2000`)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.message || res.statusText)
    items = json.data || []
  } catch (e) {
    console.error('Failed to fetch items. Is the dev server running (pnpm dev)?', e.message)
    process.exit(1)
  }

  const matched = []
  const missing = []

  for (const pdfName of PDF_DRINKS) {
    const found = items.some((item) => dbProductMatchesName(item, pdfName))
    if (found) matched.push(pdfName)
    else missing.push(pdfName)
  }

  console.log('=== Kinsbergen PDF vs DB (drinks) ===\n')
  console.log('Total in PDF list:', PDF_DRINKS.length)
  console.log('Total items in DB:', items.length)
  console.log('Matched:', matched.length)
  console.log('Missing in DB:', missing.length)
  console.log('')
  if (missing.length) {
    console.log('--- Missing in DB ---')
    missing.forEach((m) => console.log(' ', m))
  }
  if (matched.length && missing.length > 0) {
    console.log('\n--- Found in DB ---')
    matched.forEach((m) => console.log(' ', m))
  }
}

main()
