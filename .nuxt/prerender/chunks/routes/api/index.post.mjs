import { defineEventHandler, readBody, createError } from 'file:///Users/alviniomolina/Documents/GitHub/daily-ops/node_modules/h3/dist/index.mjs';
import { a as getDb } from '../../nitro/nitro.mjs';
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
