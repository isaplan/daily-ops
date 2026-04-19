import { d as defineEventHandler, a as getQuery, b as resolveDailyOpsPeriod } from '../../../nitro/nitro.mjs';
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

const products_get = defineEventHandler((event) => {
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
    section: "products",
    title: "Products",
    message: "Dedicated product mix and performance for this period. Wire to aggregation when ready."
  };
});

export { products_get as default };
//# sourceMappingURL=products.get.mjs.map
