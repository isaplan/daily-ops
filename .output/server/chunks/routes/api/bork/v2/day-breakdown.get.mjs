import { d as defineEventHandler, a as getQuery, c as createError, g as getDb } from '../../../../nitro/nitro.mjs';
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

const dayBreakdown_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const dateStr = query.date;
  const location = query.location || "all";
  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: "date parameter required (YYYY-MM-DD)" });
  }
  const db = await getDb();
  try {
    const startDate = /* @__PURE__ */ new Date(`${dateStr}T08:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];
    const dateQuery = { date: { $gte: startDateStr, $lte: endDateStr } };
    const locationQuery = location === "all" ? {} : { locationName: location };
    const hourly = await db.collection("bork_sales_by_hour").find({ ...dateQuery, ...locationQuery }).sort({ date: 1, hour: 1 }).toArray();
    const worker = await db.collection("bork_sales_by_worker").find({ ...dateQuery, ...locationQuery }).sort({ total_revenue: -1 }).toArray();
    const table = await db.collection("bork_sales_by_table").find({ ...dateQuery, ...locationQuery }).sort({ total_revenue: -1 }).toArray();
    const product = await db.collection("bork_products_master").find({ ...dateQuery, ...locationQuery }).sort({ total_revenue: -1 }).toArray();
    return {
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString()
      },
      location,
      hourly,
      worker,
      table,
      product
    };
  } catch (e) {
    console.error("[borkDayBreakdownApi]", e);
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});

export { dayBreakdown_get as default };
//# sourceMappingURL=day-breakdown.get.mjs.map
