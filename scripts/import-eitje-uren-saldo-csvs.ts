/**
 * Import Eitje monthly plus/min + verlof saldo CSVs into member_eitje_saldo_snapshot.
 *
 * Usage:
 *   npx --yes tsx scripts/import-eitje-uren-saldo-csvs.ts
 *   npx --yes tsx scripts/import-eitje-uren-saldo-csvs.ts --dir path/to/csvs
 */
import { resolve } from 'path'
import { getDb } from '../server/utils/db'
import {
  EITJE_SALDO_MIN_SNAPSHOT_DATE,
  importEitjeSaldoCsvFolder,
} from '../server/utils/memberEitjeSaldoSnapshots'

const DEFAULT_DIR = resolve(
  process.cwd(),
  'dev-docs/validation-data-eitje-bork/eitje-uren-saldo',
)

async function main (): Promise<void> {
  const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length)
  const folder = dirArg ? resolve(dirArg) : DEFAULT_DIR

  const db = await getDb()
  const result = await importEitjeSaldoCsvFolder(db, folder, EITJE_SALDO_MIN_SNAPSHOT_DATE)

  process.stdout.write(
    [
      `Imported Eitje saldo snapshots from ${folder}`,
      `  files: ${result.filesProcessed}`,
      `  upserted: ${result.snapshotsUpserted}`,
      `  skipped (no member): ${result.skippedNoMember}`,
      `  skipped (non uren contract): ${result.skippedNonUren}`,
      `  skipped (bad row): ${result.skippedBadRow}`,
      result.dateRange
        ? `  date range: ${result.dateRange.from} → ${result.dateRange.to}`
        : '  date range: (none)',
    ].join('\n') + '\n',
  )
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
