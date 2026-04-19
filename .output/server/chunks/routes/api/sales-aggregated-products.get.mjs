import { d as defineEventHandler, a as getQuery, c as createError, g as getDb } from '../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
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
    let collectionName = "";
    const filter = { date, hour, locationId };
    if (groupBy === "hour" || groupBy === "date_location") {
      collectionName = "bork_sales_by_hour";
    } else if (groupBy === "table") {
      collectionName = "bork_sales_by_table";
      const tn = typeof q.tableNumber === "string" ? q.tableNumber : String((_a = q.tableNumber) != null ? _a : "");
      if (!tn) {
        throw createError({ statusCode: 400, message: "tableNumber is required for table detail" });
      }
      filter.tableNumber = tn;
    } else if (groupBy === "worker") {
      collectionName = "bork_sales_by_worker";
      const wid = typeof q.workerId === "string" ? q.workerId : String((_b = q.workerId) != null ? _b : "");
      filter.workerId = parseWorkerIdForFilter(wid.length > 0 ? wid : "unknown");
    } else if (groupBy === "guestAccount") {
      collectionName = "bork_sales_by_guest_account";
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
