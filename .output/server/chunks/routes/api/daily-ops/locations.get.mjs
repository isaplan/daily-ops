import { d as defineEventHandler, g as getDb } from '../../../nitro/nitro.mjs';
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

const locations_get = defineEventHandler(async () => {
  try {
    const db = await getDb();
    const unifiedLocations = await db.collection("unified_location").find({}).toArray();
    const locations = unifiedLocations.map((doc) => {
      var _a, _b, _c;
      return {
        _id: String(doc._id),
        name: (_a = doc.name) != null ? _a : "",
        abbreviation: (_b = doc.abbreviation) != null ? _b : "",
        eitjeId: (_c = doc.eitjeIds) == null ? void 0 : _c[0]
      };
    });
    return {
      success: true,
      data: locations
    };
  } catch (error) {
    console.error("[daily-ops/locations] Error:", error);
    return {
      success: false,
      data: [],
      error: String(error)
    };
  }
});

export { locations_get as default };
//# sourceMappingURL=locations.get.mjs.map
