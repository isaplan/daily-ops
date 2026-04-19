import { d as defineEventHandler, r as readBody, c as createError, g as getDb } from '../../nitro/nitro.mjs';
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

const index_post = defineEventHandler(async (event) => {
  var _a, _b;
  const body = await readBody(event);
  if (!((_a = body == null ? void 0 : body.name) == null ? void 0 : _a.trim())) {
    throw createError({ statusCode: 400, statusMessage: "name is required" });
  }
  if (!(body == null ? void 0 : body.location_id)) {
    throw createError({ statusCode: 400, statusMessage: "location_id is required" });
  }
  let locationOid;
  try {
    locationOid = new ObjectId(body.location_id);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "invalid location_id" });
  }
  const db = await getDb();
  const now = /* @__PURE__ */ new Date();
  const doc = {
    name: body.name.trim(),
    location_id: locationOid,
    description: ((_b = body.description) == null ? void 0 : _b.trim()) || void 0,
    is_active: true,
    created_at: now,
    updated_at: now
  };
  const result = await db.collection("teams").insertOne(doc);
  const inserted = await db.collection("teams").findOne({ _id: result.insertedId });
  const data = inserted ? { _id: String(inserted._id), name: inserted.name, location_id: String(inserted.location_id), description: inserted.description, is_active: inserted.is_active } : { _id: String(result.insertedId), ...doc, location_id: body.location_id };
  return { success: true, data };
});

export { index_post as default };
//# sourceMappingURL=index.post4.mjs.map
