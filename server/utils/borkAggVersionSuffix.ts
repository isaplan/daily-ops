/**
 * Resolve DB collection suffixes for versioned Bork aggregates.
 *
 * Defaults to `_v2` so V2 reads/writes target versioned collections.
 * Backward compatible fallbacks:
 * - reads: BORK_AGG_V2_SUFFIX
 * - rebuild writes: BORK_AGG_V2_REBUILD_SUFFIX
 */
export function resolveBorkAggReadSuffix(): string {
  const cfg = useRuntimeConfig()
  const fromCfg =
    typeof cfg.borkAggVersionSuffix === 'string'
      ? cfg.borkAggVersionSuffix
      : typeof cfg.borkAggV2Suffix === 'string'
        ? cfg.borkAggV2Suffix
        : ''
  if (fromCfg !== '') return fromCfg
  return process.env.BORK_AGG_VERSION_SUFFIX ?? process.env.BORK_AGG_V2_SUFFIX ?? '_v2'
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
