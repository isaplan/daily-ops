import { d as defineEventHandler, s as setResponseHeader, p as parseDailyOpsMetricsQuery, a as getQuery, g as getDb, h as fetchLaborMetricsPipelineInput, k as assembleDailyOpsLaborMetricsDto } from '../../../../nitro/nitro.mjs';
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

const labor_get = defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, max-age=30, stale-while-revalidate=120");
  const ctx = parseDailyOpsMetricsQuery(getQuery(event));
  const db = await getDb();
  const input = await fetchLaborMetricsPipelineInput(db, ctx);
  return assembleDailyOpsLaborMetricsDto(ctx, input);
});

export { labor_get as default };
//# sourceMappingURL=labor.get.mjs.map
