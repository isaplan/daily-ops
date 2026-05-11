import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { b as resolveBorkAggReadSuffix, a as getDb } from '../../../../nitro/nitro.mjs';
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

const dayBreakdownV2_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const dateStr = query.date;
  const location = query.location || "all";
  const suffix = resolveBorkAggReadSuffix();
  if (!dateStr) {
    throw createError({ statusCode: 400, statusMessage: "date parameter required (YYYY-MM-DD)" });
  }
  const db = await getDb();
  const hourlyCollection = `bork_sales_by_hour${suffix}`;
  const workerCollection = `bork_sales_by_worker${suffix}`;
  const tableCollection = `bork_sales_by_table${suffix}`;
  try {
    const baseQuery = { business_date: dateStr };
    if (location !== "all") baseQuery.locationName = location;
    const [hourly, worker, table, product] = await Promise.all([
      db.collection(hourlyCollection).find(baseQuery).sort({ business_hour: 1 }).toArray(),
      db.collection(workerCollection).find(baseQuery).sort({ total_revenue: -1 }).toArray(),
      db.collection(tableCollection).find(baseQuery).sort({ total_revenue: -1 }).toArray(),
      db.collection(tableCollection).aggregate([
        { $match: baseQuery },
        { $unwind: { path: "$products", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: {
              productId: "$products.productId",
              productName: "$products.productName"
            },
            total_revenue: { $sum: { $ifNull: ["$products.revenue", 0] } },
            total_quantity: { $sum: { $ifNull: ["$products.quantity", 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            productId: "$_id.productId",
            productName: "$_id.productName",
            total_revenue: 1,
            total_quantity: 1
          }
        },
        { $sort: { total_revenue: -1 } }
      ]).toArray()
    ]);
    return {
      businessDate: dateStr,
      location,
      collectionSuffix: suffix || null,
      collections: {
        hourly: hourlyCollection,
        worker: workerCollection,
        table: tableCollection,
        product: tableCollection
      },
      hourly,
      worker,
      table,
      product
    };
  } catch (e) {
    console.error("[borkDayBreakdownV2Api]", e);
    throw createError({ statusCode: 500, statusMessage: String(e) });
  }
});

export { dayBreakdownV2_get as default };
//# sourceMappingURL=day-breakdown-v2.get.mjs.map
