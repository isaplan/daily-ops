import { d as defineEventHandler, s as setResponseHeader, p as parseDailyOpsMetricsQuery, a as getQuery, g as getDb, l as fetchRevenueByDate, m as fetchLaborByDate, i as buildDailyOpsSummaryDto } from '../../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import 'fs';
import 'path';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '@iconify/utils';
import 'consola';

const summary_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  const ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  const [revMap, labMap] = await Promise.all([fetchRevenueByDate(db, ctx), fetchLaborByDate(db, ctx)]);
  return buildDailyOpsSummaryDto(ctx, revMap, labMap);
});

export { summary_get as default };
//# sourceMappingURL=summary.get.mjs.map
