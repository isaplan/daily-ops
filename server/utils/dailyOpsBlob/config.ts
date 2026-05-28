/**
 * @registry-id: dailyOpsBlobConfig
 * @created: 2026-05-28T00:00:00.000Z
 * @last-modified: 2026-05-28T00:00:00.000Z
 * @description: ADR-006 cold-tier env config (DO Spaces + retention flags)
 * @adr-ref: ADR-006
 */

export type DailyOpsBlobConfig = {
  archiveEnabled: boolean
  purgeFatAggregatesEnabled: boolean
  deleteRawAfterArchive: boolean
  spacesEndpoint: string
  spacesBucket: string
  spacesAccessKey: string
  spacesSecretKey: string
  coldPrefix: string
  rawMongoGraceDays: number
}

export function readDailyOpsBlobConfig(): DailyOpsBlobConfig {
  const rawGrace = Number(process.env.DATA_RETENTION_RAW_MONGO_DAYS ?? '0')
  return {
    archiveEnabled: process.env.DATA_RETENTION_ARCHIVE_ENABLED === '1',
    purgeFatAggregatesEnabled: process.env.DATA_RETENTION_PURGE_FAT_AGG === '1',
    deleteRawAfterArchive: rawGrace <= 0,
    spacesEndpoint: String(process.env.DO_SPACES_ENDPOINT ?? '').trim(),
    spacesBucket: String(process.env.DO_SPACES_BUCKET ?? '').trim(),
    spacesAccessKey: String(process.env.DO_SPACES_ACCESS_KEY ?? '').trim(),
    spacesSecretKey: String(process.env.DO_SPACES_SECRET_KEY ?? '').trim(),
    coldPrefix: String(process.env.DO_SPACES_COLD_PREFIX ?? 'cold').replace(/\/+$/, ''),
    rawMongoGraceDays: Number.isFinite(rawGrace) ? rawGrace : 0,
  }
}

export function spacesConfigured(cfg: DailyOpsBlobConfig): boolean {
  return Boolean(
    cfg.spacesEndpoint && cfg.spacesBucket && cfg.spacesAccessKey && cfg.spacesSecretKey,
  )
}
