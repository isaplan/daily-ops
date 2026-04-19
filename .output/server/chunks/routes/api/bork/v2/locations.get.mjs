import { d as defineEventHandler, g as getDb } from '../../../../nitro/nitro.mjs';
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

const locations_get = defineEventHandler(async () => {
  const db = await getDb();
  const unifiedLocations = await db.collection("unified_location").find({}, { projection: { primaryId: 1, name: 1 } }).sort({ name: 1 }).toArray();
  const fallbackLocations = unifiedLocations.length ? [] : await db.collection("locations").find({}, { projection: { _id: 1, name: 1 } }).sort({ name: 1 }).toArray();
  const locations = unifiedLocations.length ? unifiedLocations.map((row) => {
    var _a, _b, _c;
    return {
      _id: String((_a = row.primaryId) != null ? _a : row._id),
      name: String((_c = (_b = row.name) != null ? _b : row.primaryId) != null ? _c : row._id)
    };
  }) : fallbackLocations.map((row) => {
    var _a;
    return {
      _id: String(row._id),
      name: String((_a = row.name) != null ? _a : row._id)
    };
  });
  return { success: true, locations };
});

export { locations_get as default };
//# sourceMappingURL=locations.get.mjs.map
