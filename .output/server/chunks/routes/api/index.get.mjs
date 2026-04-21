import { d as defineEventHandler, g as getDb } from '../../nitro/nitro.mjs';
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

const index_get = defineEventHandler(async () => {
  const db = await getDb();
  const locations = await db.collection("locations").find({ $or: [{ is_active: true }, { is_active: { $exists: false } }] }).sort({ name: 1 }).toArray();
  const data = locations.map((l) => ({
    _id: String(l._id),
    name: l.name,
    address: l.address,
    city: l.city,
    country: l.country,
    is_active: l.is_active !== false
  }));
  return { success: true, data };
});

export { index_get as default };
//# sourceMappingURL=index.get.mjs.map
