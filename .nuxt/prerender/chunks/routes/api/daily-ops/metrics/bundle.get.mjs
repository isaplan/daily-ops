import { defineEventHandler, setResponseHeader, getQuery } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { p as parseDailyOpsMetricsQuery, a as getDb, f as fetchRevenueByCategoryFromHourAggregates, h as fetchBorkHourAggregatesBundle, i as fetchLaborMetricsPipelineInput, j as fetchInboxBasisRevenueTotalExVat, k as fetchTodayDashboardRevenueExtras, m as buildDailyOpsSummaryDto, n as buildDailyOpsRevenueBreakdownDto, o as assembleDailyOpsLaborMetricsDto } from '../../../../nitro/nitro.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/papaparse@5.5.3/node_modules/papaparse/papaparse.js';
import '/Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/dist/cpexcel.js';
import 'node:fs';
import 'node:stream';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/destr/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/nitropack/node_modules/hookable/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ofetch/dist/node.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/node-mock-http/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs.mjs';
import 'node:crypto';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/fs-lite.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unstorage/drivers/lru-cache.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ohash/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/klona/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/defu/dist/defu.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/scule/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/unctx/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/radix3/dist/index.mjs';
import 'node:path';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/googleapis@171.4.0/node_modules/googleapis/build/src/index.js';
import 'node:http';
import 'node:https';
import 'node:url';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/pathe/dist/index.mjs';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/@iconify/utils/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/consola/dist/index.mjs';
import 'node:module';

const bundle_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "no-store");
  const ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  const [cat, hourBundle, laborInput, inboxBasisExVat] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchLaborMetricsPipelineInput(db, ctx),
    fetchInboxBasisRevenueTotalExVat(db, ctx)
  ]);
  const todayExtras = await fetchTodayDashboardRevenueExtras(db, ctx, hourBundle);
  const summary = buildDailyOpsSummaryDto(ctx, laborInput.revMap, laborInput.labMap, {
    apiBusinessDaysTotal: laborInput.revenueSplit.businessDaysPeriodTotal,
    inboxBasisExVat
  });
  const revenue = buildDailyOpsRevenueBreakdownDto(ctx, cat, hourBundle, laborInput.revMap, laborInput.labMap, todayExtras);
  const labor = assembleDailyOpsLaborMetricsDto(ctx, laborInput);
  return { summary, revenue, labor };
});

export { bundle_get as default };
//# sourceMappingURL=bundle.get.mjs.map
