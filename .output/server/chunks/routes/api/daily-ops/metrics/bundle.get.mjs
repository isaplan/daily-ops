import { d as defineEventHandler, s as setResponseHeader, p as parseDailyOpsMetricsQuery, a as getQuery, g as getDb, f as fetchRevenueByCategoryFromHourAggregates, e as fetchBorkHourAggregatesBundle, h as fetchLaborMetricsPipelineInput, i as buildDailyOpsSummaryDto, j as buildDailyOpsRevenueBreakdownDto, k as assembleDailyOpsLaborMetricsDto } from '../../../../nitro/nitro.mjs';
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

const bundle_get = defineEventHandler(async (event) => {
  var _a;
  setResponseHeader(event, "Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  let ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  if (ctx.locationId && typeof ctx.locationId !== "string") {
    try {
      const unifiedDoc = await db.collection("unified_location").findOne({ _id: ctx.locationId });
      if ((_a = unifiedDoc == null ? void 0 : unifiedDoc.eitjeIds) == null ? void 0 : _a[0]) {
        ctx.locationId = String(unifiedDoc.eitjeIds[0]);
      }
    } catch (e) {
      console.error("[bundle] Failed to resolve location:", e);
    }
  }
  const [cat, hourBundle, laborInput] = await Promise.all([
    fetchRevenueByCategoryFromHourAggregates(db, ctx),
    fetchBorkHourAggregatesBundle(db, ctx),
    fetchLaborMetricsPipelineInput(db, ctx)
  ]);
  const summary = buildDailyOpsSummaryDto(ctx, laborInput.revMap, laborInput.labMap);
  const revenue = buildDailyOpsRevenueBreakdownDto(ctx, cat, hourBundle, laborInput.revMap, laborInput.labMap);
  const labor = assembleDailyOpsLaborMetricsDto(ctx, laborInput);
  return { summary, revenue, labor };
});

export { bundle_get as default };
//# sourceMappingURL=bundle.get.mjs.map
