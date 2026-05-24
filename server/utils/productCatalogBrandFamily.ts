/**
 * @registry-id: productCatalogBrandFamily
 * @created: 2026-05-24T00:00:00.000Z
 * @last-modified: 2026-05-24T00:00:00.000Z
 * @description: Brand-level family names for product_catalog SKU clustering
 * @last-fix: [2026-05-24] General brand normalization for all catalog products
 *
 * @exports-to:
 * ✓ server/utils/productCatalog.ts
 */

const SIZE_PATTERN =
  /\s+((?:fluit|vaas|pint|glas|mug|fles|pitcher|kan)\b|\d+(?:[.,]\d+)?\s*(?:%|cl|ml|l)?)\s*$/i

const LEADING_PREFIXES = [
  'birra',
  'french',
  'tap',
  'draft',
  'draught',
  'house',
  'speciaal',
  'nieuw',
  'nieuwe',
  'oude',
  'verse',
  'premium',
  'bio',
  'dutch',
  'belgian',
  'italian',
  'fresh',
  'huisgemaakte',
  'huisgemaakt',
  'warme',
  'koude',
  'gegrilde',
  'gefrituurde',
  'klassieke',
  'vegetarische',
  'veganistische',
  'kleine',
  'grote',
] as const

/** Redundant beer words after the brand (not distinct product lines). */
const TRAILING_BEER_SUFFIXES = /\s+(?:pils|pilsner)\s*$/i

const STOP_WORDS = new Set([
  'de',
  'het',
  'een',
  'van',
  'met',
  'en',
  'the',
  'of',
  'op',
  'aan',
  'voor',
  'bij',
  'und',
  'and',
])

const TYPO_FIXES: Array<[RegExp, string]> = [
  [/morettie/g, 'moretti'],
  [/heiniken/g, 'heineken'],
  [/desperados/g, 'desperado'],
]

const CANONICAL_BRANDS: Array<{ test: (key: string) => boolean; name: string }> = [
  { test: (k) => /\bmoretti\b/.test(k), name: 'Birra Moretti' },
  { test: (k) => /\bcoca[\s-]*cola\b/.test(k) || k === 'cola', name: 'Coca-Cola' },
  { test: (k) => /\bfanta\b/.test(k), name: 'Fanta' },
  { test: (k) => /\bsprite\b/.test(k), name: 'Sprite' },
  { test: (k) => /\bheineken\b/.test(k), name: 'Heineken' },
  { test: (k) => /\bamstel\b/.test(k) && !/\bradler\b/.test(k), name: 'Amstel' },
  { test: (k) => /\bjupiler\b/.test(k), name: 'Jupiler' },
  { test: (k) => /\bgrolsch\b/.test(k), name: 'Grolsch' },
  { test: (k) => /\bcorona\b/.test(k), name: 'Corona' },
  { test: (k) => /\bguinness\b/.test(k), name: 'Guinness' },
  { test: (k) => /\bhoegaarden\b/.test(k), name: 'Hoegaarden' },
  { test: (k) => /\bdesperado\b/.test(k), name: 'Desperados' },
  { test: (k) => /\bkrombacher\b/.test(k), name: 'Krombacher' },
  { test: (k) => /\bsomersby\b/.test(k), name: 'Somersby' },
  { test: (k) => /\bstrongbow\b/.test(k), name: 'Strongbow' },
  { test: (k) => /\bkirin\b/.test(k), name: 'Kirin' },
  { test: (k) => /\bsan\s*miguel\b/.test(k), name: 'San Miguel' },
  { test: (k) => /\bperoni\b/.test(k), name: 'Peroni' },
  { test: (k) => /\bwarsteiner\b/.test(k), name: 'Warsteiner' },
  { test: (k) => /\bvedett\b/.test(k), name: 'Vedett' },
  { test: (k) => /\bduvel\b/.test(k), name: 'Duvel' },
  { test: (k) => /\bkronenbourg\b/.test(k) || /\b1664\b/.test(k), name: 'Kronenbourg 1664' },
]

export function parseProductVariantLabel(displayName: string): {
  family_name: string
  size_label: string | null
} {
  const trimmed = displayName.trim()
  const m = trimmed.match(SIZE_PATTERN)
  if (m && m.index != null && m.index > 0) {
    return {
      family_name: trimmed.slice(0, m.index).trim() || trimmed,
      size_label: (m[1] ?? '').replace(/\s+/g, ' ').trim() || null,
    }
  }
  return { family_name: trimmed, size_label: null }
}

function applyTypoFixes(s: string): string {
  let out = s
  for (const [re, rep] of TYPO_FIXES) {
    out = out.replace(re, rep)
  }
  return out
}

function stripLeadingPrefixes(key: string): string {
  let s = key
  const prefixRe = new RegExp(`^(${LEADING_PREFIXES.join('|')})\\s+`, 'i')
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(prefixRe, '').trim()
  }
  return s
}

export function normalizeProductBrandKey(stem: string): string {
  let s = applyTypoFixes(stem.toLowerCase())
  s = s.replace(/\([^)]*\)/g, ' ')
  s = s.replace(/\b0[.,]0\s*%?\b/g, ' ')
  s = s.replace(/\balcohol\s*vrij\b|\balcoholvrij\b|\balvrij\b|\bzero\b/gi, ' ')
  s = s.replace(/[''`]/g, "'")
  s = s.replace(/[^\w\s%&'-]/g, ' ')
  s = stripLeadingPrefixes(s)
  while (TRAILING_BEER_SUFFIXES.test(s)) {
    s = s.replace(TRAILING_BEER_SUFFIXES, '').trim()
  }
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Stable key for grouping variants (size / venue wording / word order). */
export function productBrandFingerprint(stem: string): string {
  const key = normalizeProductBrandKey(stem)
  if (!key) return ''
  const tokens = key.split(/\s+/).filter((t) => t && !STOP_WORDS.has(t))
  if (tokens.length <= 1) return tokens[0] ?? key
  return [...tokens].sort().join(' ')
}

function titleCaseBrand(key: string): string {
  return key
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\d/.test(w)) return w
      if (w.length <= 3 && w === w.toUpperCase()) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

function resolveCanonicalBrand(fingerprint: string): string | null {
  for (const { test, name } of CANONICAL_BRANDS) {
    if (test(fingerprint)) return name
  }
  return null
}

/** Brand-level family for grouping SKUs (one Bork key per size/location still). */
export function resolveProductFamilyName(displayName: string): string {
  const { family_name } = parseProductVariantLabel(displayName)
  const trimmed = family_name.trim()
  if (!trimmed) return displayName.trim()

  const fingerprint = productBrandFingerprint(trimmed)
  if (!fingerprint) return trimmed

  const canonical = resolveCanonicalBrand(fingerprint)
  if (canonical) return canonical

  return titleCaseBrand(fingerprint)
}

export function applyCatalogFamilyFields(displayName: string): {
  family_name: string
  size_label: string | null
} {
  const parsed = parseProductVariantLabel(displayName)
  return {
    family_name: resolveProductFamilyName(displayName),
    size_label: parsed.size_label,
  }
}
