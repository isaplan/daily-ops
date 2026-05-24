/**
 * Resolve DB collection suffixes for versioned Bork aggregates.
 *
 * Defaults to `_v2` so V2 reads/writes target versioned collections.
 * Works in Nitro (useRuntimeConfig) and standalone scripts (process.env only).
 *
 * @last-fix: [2026-05-21] Guard useRuntimeConfig for tsx/scripts outside Nuxt
 */

type BorkSuffixRuntime = {
  borkAggVersionSuffix?: string
  borkAggV2Suffix?: string
}

function suffixFromRuntime(cfg: BorkSuffixRuntime): string {
  if (typeof cfg.borkAggVersionSuffix === 'string' && cfg.borkAggVersionSuffix !== '') {
    return cfg.borkAggVersionSuffix
  }
  if (typeof cfg.borkAggV2Suffix === 'string' && cfg.borkAggV2Suffix !== '') {
    return cfg.borkAggV2Suffix
  }
  return ''
}

function readNuxtRuntimeBorkSuffix(): string {
  try {
    const g = globalThis as { useRuntimeConfig?: () => BorkSuffixRuntime }
    if (typeof g.useRuntimeConfig !== 'function') return ''
    return suffixFromRuntime(g.useRuntimeConfig())
  } catch {
    return ''
  }
}

function readEnvBorkSuffix(): string {
  return process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
}

export function resolveBorkAggReadSuffix(): string {
  const fromNuxt = readNuxtRuntimeBorkSuffix()
  if (fromNuxt !== '') return fromNuxt
  return readEnvBorkSuffix()
}

/** Ordered list for DB reads: env/default first, then common alternates (many installs still use unsuffixed or `_v2` only). */
export function listBorkAggReadSuffixCandidates(): string[] {
  const primary = resolveBorkAggReadSuffix()
  const fallbacks = ['', '_v2']
  const out: string[] = [primary]
  for (const f of fallbacks) {
    if (f !== primary && !out.includes(f)) out.push(f)
  }
  return out
}

export function resolveBorkAggRebuildSuffix(): string {
  const inherit =
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_REBUILD_USE_READ_SUFFIX === 'yes' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === '1' ||
    process.env.BORK_AGG_V2_REBUILD_USE_READ_SUFFIX === 'yes'

  if (inherit) return resolveBorkAggReadSuffix()

  return (
    process.env.BORK_AGG_REBUILD_SUFFIX ??
    process.env.BORK_AGG_V2_REBUILD_SUFFIX ??
    process.env.BORK_AGG_VERSION_SUFFIX ??
    '_v2'
  )
}
