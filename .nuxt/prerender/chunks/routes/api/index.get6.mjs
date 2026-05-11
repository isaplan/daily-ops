import { defineEventHandler } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a7 as getUnifiedUsersCollection } from '../../nitro/nitro.mjs';
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

const NAME_KEYS = ["canonicalName", "primaryName", "name", "displayName", "eitjeNames"];
function getDisplayName(doc) {
  for (const k of NAME_KEYS) {
    const v = doc[k];
    if (typeof v === "string" && v.trim().length > 0 && v.length < 200) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  const allIds = doc.allIds;
  if (Array.isArray(allIds) && allIds[0] && typeof allIds[0].name === "string") {
    const n = allIds[0].name.trim();
    if (n) return n;
  }
  for (const [key, val] of Object.entries(doc)) {
    if (key === "_id" || key.startsWith("$") || key === "allIds" || key === "allIdValues") continue;
    if (typeof val === "string" && val.trim().length > 0 && val.length < 200 && !/^[0-9a-f]{24}$/i.test(val)) return val.trim();
    if (Array.isArray(val) && typeof val[0] === "string" && val[0].length < 200) return val[0].trim();
  }
  return "";
}
const index_get = defineEventHandler(async () => {
  try {
    const coll = await getUnifiedUsersCollection();
    const list = await coll.find({
      $or: [
        { isActive: true },
        { is_active: true },
        { isActive: { $exists: false }, is_active: { $exists: false } }
      ]
    }).sort({ canonicalName: 1 }).toArray();
    const data = list.map((u) => {
      var _a, _b;
      const display = getDisplayName(u) || `User ${String(u._id).slice(-6)}`;
      const slack = typeof u.slackUsername === "string" ? u.slackUsername : typeof u.slackusername === "string" ? u.slackusername : null;
      const locId = (_b = (_a = u.location_id) != null ? _a : u.locationId) != null ? _b : u.primaryLocationId;
      const location_id = locId != null ? String(locId) : null;
      return {
        _id: String(u._id),
        canonicalName: display,
        primaryName: display,
        primaryEmail: (typeof u.primaryEmail === "string" ? u.primaryEmail : "") || "",
        slackUsername: slack != null ? slack : null,
        location_id
      };
    });
    return { success: true, data };
  } catch {
    return { success: true, data: [] };
  }
});

export { index_get as default };
//# sourceMappingURL=index.get6.mjs.map
