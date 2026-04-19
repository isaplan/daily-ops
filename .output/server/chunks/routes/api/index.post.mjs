import { d as defineEventHandler, r as readBody, c as createError, g as getDb } from '../../nitro/nitro.mjs';
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

const index_post = defineEventHandler(async (event) => {
  var _a, _b, _c, _d;
  const body = await readBody(event);
  if (!((_a = body == null ? void 0 : body.name) == null ? void 0 : _a.trim())) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const doc = {
    name: body.name.trim(),
    address: ((_b = body.address) == null ? void 0 : _b.trim()) || void 0,
    city: ((_c = body.city) == null ? void 0 : _c.trim()) || void 0,
    country: ((_d = body.country) == null ? void 0 : _d.trim()) || void 0,
    is_active: true,
    created_at: now,
    updated_at: now
  };
  const result = await db.collection("locations").insertOne(doc);
  const inserted = await db.collection("locations").findOne({ _id: result.insertedId });
  const data = inserted ? { _id: String(inserted._id), name: inserted.name, address: inserted.address, city: inserted.city, country: inserted.country, is_active: inserted.is_active } : { _id: String(result.insertedId), ...doc };
  return { success: true, data };
});

export { index_post as default };
//# sourceMappingURL=index.post.mjs.map
