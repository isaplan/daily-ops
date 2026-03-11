#!/usr/bin/env node
/**
 * Create menu "Drinks & Bites Winter 2025" in Menu Builder V2 with sections/subsections
 * from the Kinsbergen PDF. Run with dev server: node scripts/create-winter-2025-menu.mjs
 */
const API_BASE = process.env.API_BASE || 'http://localhost:8080'

function normalize(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
}
function tokenize(s) {
  return normalize(s).split(/\s+/).filter(Boolean)
}

function itemMatchesName(item, name) {
  const names = [
    item.name,
    item.data?.['Product Kinsbergen'],
    item.data?.['Product'],
    item.data?.Name,
    item.data?.name,
  ].filter(Boolean).map(String)
  const nameNorm = normalize(name)
  const nameTokens = tokenize(name)
  if (nameTokens.length === 0) return false
  for (const n of names) {
    const nNorm = normalize(n)
    if (nNorm === nameNorm) return true
    if (nNorm.includes(nameNorm) || nameNorm.includes(nNorm)) return true
    const nTokens = tokenize(n)
    const matchCount = nameTokens.filter((t) => nTokens.some((nt) => nt.includes(t) || t.includes(nt))).length
    if (matchCount >= Math.min(2, nameTokens.length)) return true
  }
  return false
}

function findId(items, productName) {
  const item = items.find((i) => itemMatchesName(i, productName))
  return item?._id ?? null
}

/** Sections and subsections with product names (from Kinsbergen PDF) */
const MENU_STRUCTURE = [
  {
    sectionName: 'Beers on draft',
    subsections: [
      { name: 'House beers', productNames: ['ZEEHELDEN Hoppy Blond', 'GLOEIKRIEK'] },
      { name: 'Premium lager', productNames: ['BIRRA MORETTI'] },
      { name: 'Gastropub specials', productNames: ['GUINNESS', 'MAGNERS APPLE CIDER'] },
      {
        name: 'Special beers on draft',
        productNames: [
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
        ],
      },
      { name: 'Draft tasting', productNames: ['KINSBERGEN DRAFT TASTING'] },
    ],
  },
  {
    sectionName: 'Special beers (bottles)',
    subsections: [
      {
        name: 'Bottled beers',
        productNames: [
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
        ],
      },
    ],
  },
  {
    sectionName: 'Ciders',
    subsections: [
      { name: 'Magners', productNames: ['MAGNERS APPLE DRAFT', 'MAGNERS PEAR', 'MAGNERS BERRY'] },
    ],
  },
  {
    sectionName: 'Low / no alcohol',
    subsections: [
      {
        name: 'Alcohol-free & low',
        productNames: [
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
        ],
      },
    ],
  },
  {
    sectionName: 'White wines',
    subsections: [
      {
        name: 'White',
        productNames: ['Sauvignon Blanc', 'Pinot Grigio', 'Verdejo', 'Chardonnay'],
      },
    ],
  },
  {
    sectionName: 'Red wines',
    subsections: [
      {
        name: 'Red',
        productNames: ['Tempranillo', 'Montepulciano', 'Primitivo', 'Merlot Rosso Veneto'],
      },
    ],
  },
  {
    sectionName: 'Rosé & sparkling',
    subsections: [
      { name: 'Rosé', productNames: ['Syrah Cinsault Grenache'] },
      { name: 'Sparkling', productNames: ['Cava Brut'] },
    ],
  },
  {
    sectionName: 'Dessert wines & Port',
    subsections: [
      {
        name: 'Dessert & Port',
        productNames: ['Oupa Se Wyn', 'Moscatel', 'Port Ruby', 'Port Tawny', 'Port White'],
      },
    ],
  },
  {
    sectionName: 'Spirits',
    subsections: [
      { name: 'Cognac', productNames: ['Chateau Montifaud'] },
      { name: 'Calvados', productNames: ['Calvados Toutain'] },
      { name: 'Grappa', productNames: ['Sari Invecchiata'] },
      { name: 'Armagnac', productNames: ['Domaine Du Tariquet'] },
      {
        name: 'Gin & tonic',
        productNames: [
          'Kinsbergen English Rose Gin',
          'Monkey47',
          'Brockmans',
          'Roku Gin',
          'Hendricks',
          'Nolets Silver',
          "Bobby's Gin",
          'Copperhead',
        ],
      },
      {
        name: 'Whiskey',
        productNames: [
          'Fryske Hynder',
          'Nikka',
          'Highland Park',
          'Glenfiddich',
          'Talisker',
          'Woodford Reserve',
          'John Walker',
        ],
      },
      {
        name: 'Rum',
        productNames: [
          'Diplomatico',
          'Abuelo',
          'Angostura',
          'The Kraken',
          'Don Papa',
          'Clement',
          'Flor de Cana',
          'Plantation',
        ],
      },
      {
        name: 'Tequila & mezcal',
        productNames: ['Patron', 'Don Julio'],
      },
      {
        name: 'Vodka',
        productNames: ['Grey Goose', 'Belvedere', 'Ketel One'],
      },
      { name: 'Jenever', productNames: ['Zuidam'] },
    ],
  },
  {
    sectionName: 'Soft drinks & water',
    subsections: [
      { name: 'Mixers & lemonade', productNames: ['Fever-Tree', 'Haagse Nieuwe'] },
      { name: 'Water', productNames: ['Chaudfontaine'] },
    ],
  },
  {
    sectionName: 'Coffee & tea',
    subsections: [
      { name: 'Coffee', productNames: ['Capriole'] },
      { name: 'Tea', productNames: ['Bradley'] },
    ],
  },
]

function nextId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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

  const menuName = 'Drinks & Bites Winter 2025'
  let menuId
  try {
    const createRes = await fetch(`${API_BASE}/api/menu/menus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: menuName,
        startDate: '2025-01-01',
        location: 'Kinsbergen',
      }),
    })
    const createJson = await createRes.json()
    if (!createRes.ok) throw new Error(createJson?.message || createRes.statusText)
    menuId = createJson.data?._id
    if (!menuId) throw new Error('No menu id in response')
    console.log('Created menu:', menuName, 'id:', menuId)
  } catch (e) {
    console.error('Failed to create menu:', e.message)
    process.exit(1)
  }

  const menuSectionsV2 = MENU_STRUCTURE.map((sec) => {
    const sectionId = nextId()
    const subsections = sec.subsections.map((sub) => {
      const productIds = sub.productNames
        .map((name) => findId(items, name))
        .filter(Boolean)
      return {
        id: nextId(),
        name: sub.name,
        productIds,
      }
    })
    return {
      id: sectionId,
      name: sec.sectionName,
      defaultWastePercent: 5,
      defaultMarginMultiplier: 4,
      defaultVatRate: 21,
      subsections,
    }
  })

  const totalProducts = menuSectionsV2.reduce(
    (acc, s) => acc + s.subsections.reduce((a, sub) => a + sub.productIds.length, 0),
    0
  )
  const totalSubs = menuSectionsV2.reduce((acc, s) => acc + s.subsections.length, 0)

  try {
    const patchRes = await fetch(`${API_BASE}/api/menu/menus/${menuId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuSectionsV2 }),
    })
    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}))
      throw new Error(err?.message || patchRes.statusText)
    }
    console.log('Updated menu with', menuSectionsV2.length, 'sections,', totalSubs, 'subsections,', totalProducts, 'products')
  } catch (e) {
    console.error('Failed to PATCH menu:', e.message)
    process.exit(1)
  }

  console.log('\nDone. Open Menu Builder V2 and open menu:', menuName)
  console.log('URL:', `${API_BASE}/daily-menu-products/menu-builder-v2`)
}

main()
