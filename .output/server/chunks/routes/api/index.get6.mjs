import { d as defineEventHandler, a0 as getUnifiedUsersCollection } from '../../nitro/nitro.mjs';
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
