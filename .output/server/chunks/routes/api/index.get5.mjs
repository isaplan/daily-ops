import { d as defineEventHandler, a as getQuery, g as getDb } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async (event) => {
  const query = getQuery(event);
  const locationId = query.location_id;
  const db = await getDb();
  const filter = {
    $or: [
      { is_active: true },
      { isActive: true },
      { is_active: { $exists: false }, isActive: { $exists: false } }
    ]
  };
  if (locationId && /^[0-9a-f]{24}$/i.test(locationId)) {
    filter.location_id = new ObjectId(locationId);
  }
  const teams = await db.collection("teams").find(filter).sort({ name: 1 }).toArray();
  const data = teams.map((t) => {
    var _a, _b, _c;
    const locId = (_a = t.location_id) != null ? _a : t.locationId;
    return {
      _id: String(t._id),
      name: (_c = (_b = t.name) != null ? _b : t.Name) != null ? _c : "",
      location_id: locId ? String(locId) : void 0,
      description: t.description,
      is_active: t.is_active !== false && t.isActive !== false
    };
  });
  return { success: true, data };
});

export { index_get as default };
//# sourceMappingURL=index.get5.mjs.map
