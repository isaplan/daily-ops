import { d as defineEventHandler, s as setResponseHeader, p as parseDailyOpsMetricsQuery, a as getQuery, g as getDb, f as fetchRevenueByCategoryFromHourAggregates, e as fetchBorkHourAggregatesBundle, l as fetchRevenueByDate, m as fetchLaborByDate, j as buildDailyOpsRevenueBreakdownDto } from '../../../../nitro/nitro.mjs';
import 'mongodb';
import 'papaparse';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'fs';
import 'stream';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'path';
import 'googleapis';
import 'node:url';
import '@iconify/utils';
import 'consola';
import 'node:module';

const revenueBreakdown_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  const ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  const [cat, hourBundle, revenueByDate, laborByDate] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchRevenueByDate(db, ctx),
    fetchLaborByDate(db, ctx)
  ]);
  return buildDailyOpsRevenueBreakdownDto(ctx, cat, hourBundle, revenueByDate, laborByDate);
});

export { revenueBreakdown_get as default };
//# sourceMappingURL=revenue-breakdown.get.mjs.map
