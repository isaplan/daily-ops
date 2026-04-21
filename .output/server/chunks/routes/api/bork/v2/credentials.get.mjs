import { d as defineEventHandler, g as getDb } from '../../../../nitro/nitro.mjs';
import { ObjectId } from 'mongodb';
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

const credentials_get = defineEventHandler(async () => {
  var _a;
  const db = await getDb();
  const creds = await db.collection("api_credentials").find({ provider: { $in: ["bork", "Bork"] } }).sort({ createdAt: -1 }).toArray();
  const list = [];
  for (const c of creds) {
    const locationId = c.locationId instanceof ObjectId ? c.locationId : new ObjectId(String(c.locationId));
    const loc = await db.collection("locations").findOne({ _id: locationId });
    const storedName = c.locationName;
    const locationName = storedName != null ? storedName : loc && typeof loc.name === "string" ? loc.name : null;
    list.push({
      _id: c._id.toString(),
      locationId: locationId.toString(),
      locationName,
      baseUrl: (_a = c.baseUrl) != null ? _a : "",
      hasApiKey: !!c.apiKey
    });
  }
  return {
    success: true,
    credentials: list
  };
});

export { credentials_get as default };
//# sourceMappingURL=credentials.get.mjs.map
