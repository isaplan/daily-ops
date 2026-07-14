/**
 * One-time Open-Meteo backfill for The Hague daily weather (2024-01-01 → today).
 *
 * Usage:
 *   pnpm weather:backfill
 *   pnpm weather:backfill -- --start 2024-01-01 --end 2025-12-31
 */
import { getDb } from '../server/utils/db'
import { backfillWeatherHistory } from '../server/utils/dailyOpsWeather/backfillWeatherHistory'

function arg(name: string): string | undefined {
  const i = process.argv.findIndex((a) => a === `--${name}`)
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]
  return undefined
}

async function main(): Promise<void> {
  const db = await getDb()
  const startDate = arg('start')
  const endDate = arg('end')
  const result = await backfillWeatherHistory(db, { startDate, endDate })
  process.stdout.write(`[weather-backfill] written=${result.written}\n`)
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
