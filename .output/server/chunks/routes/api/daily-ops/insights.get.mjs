import { d as defineEventHandler, a as getQuery, b as resolveDailyOpsPeriod } from '../../../nitro/nitro.mjs';
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

const insights_get = defineEventHandler((event) => {
  const q = getQuery(event);
  const period = typeof q.period === "string" ? q.period : "today";
  const anchor = typeof q.anchor === "string" ? q.anchor : void 0;
  const range = resolveDailyOpsPeriod(period, anchor);
  return {
    range: {
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate
    },
    section: "insights",
    title: "Insights",
    message: "Dedicated insights and anomalies for this period. Wire to aggregation when ready."
  };
});

export { insights_get as default };
//# sourceMappingURL=insights.get.mjs.map
