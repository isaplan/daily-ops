import { defineEventHandler, setResponseHeader, getQuery, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb, l as loadUnifiedLocationGroupResolver } from '../../../nitro/nitro.mjs';
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

const SALES_LIST_SORT = {
  business_date: -1,
  business_hour: -1,
  cron_hour: -1,
  received_at: -1
};
const sales_get = defineEventHandler(async (event) => {
  var _a, _b, _c;
  setResponseHeader(event, "Cache-Control", "no-store");
  try {
    const query = getQuery(event);
    const date = query.date;
    const location = query.location;
    const limit = Math.min(parseInt(query.limit) || 30, 365);
    const db = await getDb();
    const collection = db.collection("inbox-bork-basis-report");
    const filter = {};
    if (date) filter.date = date;
    if (location) filter.location = { $regex: location, $options: "i" };
    const [reports, resolver, unifiedLocations] = await Promise.all([
      collection.find(filter).sort(SALES_LIST_SORT).limit(limit).toArray(),
      loadUnifiedLocationGroupResolver(db),
      db.collection("unified_location").find({}, { projection: { name: 1, primaryName: 1, canonicalName: 1 } }).toArray()
    ]);
    const idToName = /* @__PURE__ */ new Map();
    for (const u of unifiedLocations) {
      const display = (_c = (_b = (_a = u.canonicalName) != null ? _a : u.primaryName) != null ? _b : u.name) != null ? _c : "";
      if (display) idToName.set(`u:${String(u._id)}`, display);
    }
    const enriched = reports.map((r) => {
      var _a2, _b2, _c2, _d, _e, _f;
      const groupKey = (_d = (_c2 = (_a2 = resolver.groupKeyFromBasisLocationId(r.location_id)) != null ? _a2 : resolver.resolveGroupKey(r.location)) != null ? _c2 : resolver.resolveGroupKey((_b2 = r.location_raw) != null ? _b2 : "")) != null ? _d : null;
      const isUnifiedKey = (_e = groupKey == null ? void 0 : groupKey.startsWith("u:")) != null ? _e : false;
      const unifiedId = isUnifiedKey ? groupKey.slice(2) : null;
      const displayName = isUnifiedKey ? (_f = idToName.get(groupKey)) != null ? _f : null : null;
      return {
        ...r,
        unified_location_id: unifiedId,
        unified_location_name: displayName
      };
    });
    return {
      success: true,
      data: enriched,
      count: enriched.length
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Failed to fetch sales reports"
    });
  }
});

export { sales_get as default };
//# sourceMappingURL=sales.get.mjs.map
