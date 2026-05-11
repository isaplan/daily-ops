import { defineEventHandler, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, b as resolveBorkAggReadSuffix } from '../../nitro/nitro.mjs';
import { ObjectId } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/.pnpm/mongodb@7.1.1/node_modules/mongodb/lib/index.js';
import 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/ufo/dist/index.mjs';
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

function parseLocationId(raw) {
  if (!raw || raw === "all") {
    throw createError({ statusCode: 400, message: "locationId is required" });
  }
  try {
    return new ObjectId(raw);
  } catch {
    return raw;
  }
}
function parseWorkerIdForFilter(raw) {
  const wid = raw.trim();
  if (!wid || wid === "unknown") return "unknown";
  try {
    return new ObjectId(wid);
  } catch {
    return wid;
  }
}
const salesAggregatedProducts_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  try {
    const q = getQuery(event);
    const groupBy = String(q.groupBy || "");
    const date = String(q.date || "");
    const hourRaw = q.hour;
    const hour = typeof hourRaw === "string" || typeof hourRaw === "number" ? Number(hourRaw) : NaN;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(hour)) {
      throw createError({ statusCode: 400, message: "date (YYYY-MM-DD) and hour are required" });
    }
    const locationId = parseLocationId(typeof q.locationId === "string" ? q.locationId : void 0);
    const db = await getDb();
    const suffix = resolveBorkAggReadSuffix();
    let collectionName = "";
    const filter = { locationId };
    if (groupBy === "hour" || groupBy === "date_location") {
      filter.calendar_date = date;
      filter.calendar_hour = hour;
      collectionName = `bork_sales_by_hour${suffix}`;
    } else if (groupBy === "table") {
      filter.date = date;
      filter.hour = hour;
      collectionName = `bork_sales_by_table${suffix}`;
      const tn = typeof q.tableNumber === "string" ? q.tableNumber : String((_a = q.tableNumber) != null ? _a : "");
      if (!tn) {
        throw createError({ statusCode: 400, message: "tableNumber is required for table detail" });
      }
      filter.tableNumber = tn;
    } else if (groupBy === "worker") {
      filter.date = date;
      filter.hour = hour;
      collectionName = `bork_sales_by_worker${suffix}`;
      const wid = typeof q.workerId === "string" ? q.workerId : String((_b = q.workerId) != null ? _b : "");
      filter.workerId = parseWorkerIdForFilter(wid.length > 0 ? wid : "unknown");
    } else if (groupBy === "guestAccount") {
      filter.date = date;
      filter.hour = hour;
      collectionName = `bork_sales_by_guest_account${suffix}`;
      const acc = typeof q.accountName === "string" ? q.accountName : "";
      if (!acc) {
        throw createError({ statusCode: 400, message: "accountName is required for guestAccount detail" });
      }
      filter.accountName = acc;
    } else {
      throw createError({ statusCode: 400, message: "Invalid groupBy for product detail" });
    }
    const doc = await db.collection(collectionName).findOne(filter, { projection: { products: 1, _id: 0 } });
    const products = (_c = doc == null ? void 0 : doc.products) != null ? _c : [];
    return { success: true, products, collection: collectionName };
  } catch (err) {
    if (err && typeof err === "object" && "statusCode" in err) throw err;
    throw createError({ statusCode: 500, message: "Failed to load product breakdown" });
  }
});

export { salesAggregatedProducts_get as default };
//# sourceMappingURL=sales-aggregated-products.get.mjs.map
